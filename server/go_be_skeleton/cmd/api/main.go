// Command api is the entrypoint for the HTTP service: it loads config,
// connects to Postgres, starts the HTTP server, and shuts both down
// cleanly on SIGINT/SIGTERM.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	auth "github.com/yourusername/goBackendSkeleton/internal/Auth"
	trainingplan "github.com/yourusername/goBackendSkeleton/internal/TrainingPlan"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/db"
	"github.com/yourusername/goBackendSkeleton/internal/db/connect"
	"github.com/yourusername/goBackendSkeleton/internal/db/s3"
	"github.com/yourusername/goBackendSkeleton/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	connect.RunRedis()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// The upload list lives beside the plan catalogue so the objects seeded
	// here and the image_key values /addPlans writes cannot drift apart.
	if err := s3.SetUp(ctx, trainingplan.UploadMap()); err != nil {
		fmt.Println("could nt run s3", err)
		return
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
