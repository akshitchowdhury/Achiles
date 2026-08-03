// Command authcheck is a temporary probe used to verify the auth store
// against the live database. Delete after verification.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	auth "github.com/yourusername/goBackendSkeleton/internal/Auth"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/db"
)

func main() {
	if err := run(); err != nil {
		fmt.Println("FAIL:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DB)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := auth.EnsureSchema(ctx, pool); err != nil {
		return err
	}
	fmt.Println("ok  EnsureSchema")

	id := auth.Identity{
		Provider: "google",
		Subject:  "probe-subject-0001",
		Email:    "probe@example.com",
		Name:     "Probe User",
		Picture:  "https://example.com/p.png",
	}

	// seed / clean support the HTTP-level checks driven from curl.
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "seed":
			if _, err := auth.UpsertIdentity(ctx, pool, id); err != nil {
				return err
			}
			fmt.Println("ok  seeded identity", id.Subject)
			return nil
		case "clean":
			return cleanup(ctx, pool, id.Subject)
		}
	}

	userID, err := auth.UpsertIdentity(ctx, pool, id)
	if err != nil {
		return err
	}
	fmt.Printf("ok  UpsertIdentity (first sign-in) -> user_id=%d (want 0)\n", userID)

	// Second call must hit ON CONFLICT and stay unlinked.
	id.Name = "Probe Renamed"
	userID, err = auth.UpsertIdentity(ctx, pool, id)
	if err != nil {
		return err
	}
	fmt.Printf("ok  UpsertIdentity (repeat)        -> user_id=%d (want 0)\n", userID)

	// Find any real athlete row to link to.
	var athlete int
	if err := pool.QueryRow(ctx, `SELECT id FROM userinfo ORDER BY id LIMIT 1`).Scan(&athlete); err != nil {
		fmt.Println("--  no rows in userinfo, skipping link checks:", err)
		return cleanup(ctx, pool, id.Subject)
	}

	exists, err := auth.UserExists(ctx, pool, athlete)
	if err != nil {
		return err
	}
	fmt.Printf("ok  UserExists(%d)                 -> %v (want true)\n", athlete, exists)

	missing, err := auth.UserExists(ctx, pool, 987654321)
	if err != nil {
		return err
	}
	fmt.Printf("ok  UserExists(987654321)         -> %v (want false)\n", missing)

	if err := auth.LinkUser(ctx, pool, id.Provider, id.Subject, athlete); err != nil {
		return err
	}
	linked, err := auth.LookupUserID(ctx, pool, id.Provider, id.Subject)
	if err != nil {
		return err
	}
	fmt.Printf("ok  LinkUser + LookupUserID       -> user_id=%d (want %d)\n", linked, athlete)

	// A returning sign-in must not drop the link.
	id.Name = "Probe Third Login"
	again, err := auth.UpsertIdentity(ctx, pool, id)
	if err != nil {
		return err
	}
	fmt.Printf("ok  UpsertIdentity (after link)   -> user_id=%d (want %d)\n", again, athlete)

	unknown, err := auth.LookupUserID(ctx, pool, "google", "no-such-subject")
	if err != nil {
		return err
	}
	fmt.Printf("ok  LookupUserID(unknown)         -> user_id=%d (want 0)\n", unknown)

	return cleanup(ctx, pool, id.Subject)
}

func cleanup(ctx context.Context, pool *pgxpool.Pool, subject string) error {
	_, err := pool.Exec(ctx, `DELETE FROM auth_identity WHERE subject = $1`, subject)
	if err != nil {
		return err
	}
	fmt.Println("ok  cleanup")
	return nil
}
