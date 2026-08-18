// Command api is the entrypoint for the HTTP service: it loads config,
// connects to Postgres, starts the HTTP server, and shuts both down
// cleanly on SIGINT/SIGTERM.
package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	pb "github.com/yourusername/goBackendSkeleton"
	auth "github.com/yourusername/goBackendSkeleton/internal/Auth"
	trainingplan "github.com/yourusername/goBackendSkeleton/internal/TrainingPlan"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/db"
	"github.com/yourusername/goBackendSkeleton/internal/db/connect"
	"github.com/yourusername/goBackendSkeleton/internal/db/s3"
	"github.com/yourusername/goBackendSkeleton/internal/server"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {

	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewTextServiceClient(conn)

	// Context timeout for the request
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	// Make the API call
	req := &pb.TextRequest{Text: "hello from go client"}
	fmt.Printf("[Go Client] Sending: '%s'\n", req.Text)

	res, err := client.ProcessText(ctx, req)
	if err != nil {
		log.Fatalf("Error calling ProcessText: %v", err)
	}

	fmt.Printf("[Go Client] Received result: '%s'\n", res.GetResult())

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	connect.RunRedis()

	// Sized for the WORK, not for a round trip. This pushes the whole art set
	// on a cold bucket — currently ~10MB across ten objects — and the previous
	// 10s budget was a single deadline shared by all of them, so a normal home
	// upstream link could not finish in time and every boot died with
	// "context deadline exceeded". SetUp skips objects already in the bucket,
	// so a warm restart returns in well under a second and never comes near
	// this ceiling.
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// The upload list lives beside the plan catalogue so the objects seeded
	// here and the image_key values /addPlans writes cannot drift apart.
	//
	// A seeding failure is logged and stepped over rather than fatal. It used
	// to `return`, which meant a slow upload of a background image took the
	// entire API offline — no auth, no plans, no dashboard — over decoration
	// that the client already degrades gracefully without: a missing key
	// resolves to an empty URL, and PlanWatermark falls back to the cover and
	// then to its gradient.
	if err := s3.SetUp(ctx, trainingplan.UploadMap()); err != nil {
		logger.Error("s3: seeding failed, starting anyway — plan art may be missing",
			"error", err)
	}

	if err := run(logger); err != nil {
		logger.Error("fatal", "error", err)
		os.Exit(1)
	}
	// if err := connect.RunRedis(); err != nil {
	// 	logger.Error("fatal", "error", err)
	// 	os.Exit(1)
	// }
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()

	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPool(ctx, cfg.DB)
	if err != nil {
		return err
	}
	defer pool.Close()

	rdb := redis.NewClient(&redis.Options{

		Addr:     connect.Address(),
		Password: connect.Password(), // no password set
		DB:       connect.Database(), // use default DB
	})

	defer rdb.Close()
	// The OAuth identity table is created here rather than by a migration so
	// a fresh database can serve a Google sign-in on first boot.
	if err := auth.EnsureSchema(ctx, pool); err != nil {
		return err
	}

	// Same reasoning for training_plans: /addPlans upserts ON CONFLICT (slug),
	// which needs the table's UNIQUE (slug) to already exist.
	if err := trainingplan.EnsureSchema(ctx, pool); err != nil {
		return err
	}

	srv := server.New(cfg, pool, logger, rdb, ctx)

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server starting", "addr", srv.Addr(), "env", cfg.Env)
		errCh <- srv.Start()
	}()

	select {
	case err := <-errCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
		logger.Info("shutdown signal received")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTP.ShutdownTimeout)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			return err
		}
		logger.Info("http server stopped cleanly")
	}

	return nil
}
