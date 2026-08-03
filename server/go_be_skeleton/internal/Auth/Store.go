package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Identity is one external account (today: one Google account) and the
// athlete row it has been attached to.
type Identity struct {
	Provider string
	Subject  string
	Email    string
	Name     string
	Picture  string
	// UserID is 0 until the person finishes onboarding and gets a userinfo row.
	UserID int
}

// EnsureSchema creates the identity table if it isn't there yet. Called once
// at startup so a fresh database can serve a login without a manual migration.
//
// user_id is a plain integer rather than a foreign key into userinfo: the
// existing tables are created out-of-band, so a REFERENCES clause here would
// make startup depend on that having happened first.
func EnsureSchema(ctx context.Context, db *pgxpool.Pool) error {
	const ddl = `
		CREATE TABLE IF NOT EXISTS auth_identity (
			id         BIGSERIAL PRIMARY KEY,
			provider   TEXT NOT NULL,
			subject    TEXT NOT NULL,
			email      TEXT NOT NULL DEFAULT '',
			name       TEXT NOT NULL DEFAULT '',
			picture    TEXT NOT NULL DEFAULT '',
			user_id    INTEGER,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (provider, subject)
		)`

	if _, err := db.Exec(ctx, ddl); err != nil {
		return fmt.Errorf("auth: ensure schema: %w", err)
	}
	return nil
}

// UpsertIdentity records the profile Google returned and hands back the
// athlete id already linked to it, or 0 if this is a first sign-in.
//
// The link is preserved on conflict — a returning user keeps their athlete
// row even though their display name or avatar may have changed.
func UpsertIdentity(ctx context.Context, db *pgxpool.Pool, in Identity) (int, error) {
	const query = `
		INSERT INTO auth_identity (provider, subject, email, name, picture)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (provider, subject) DO UPDATE
		SET email      = EXCLUDED.email,
		    name       = EXCLUDED.name,
		    picture    = EXCLUDED.picture,
		    updated_at = now()
		RETURNING user_id`

	var userID *int
	err := db.QueryRow(ctx, query, in.Provider, in.Subject, in.Email, in.Name, in.Picture).Scan(&userID)
	if err != nil {
		return 0, fmt.Errorf("auth: upsert identity: %w", err)
	}
	if userID == nil {
		return 0, nil
	}
	return *userID, nil
}

// LookupUserID returns the athlete id linked to an identity, or 0 if the
// identity exists but hasn't been linked yet.
func LookupUserID(ctx context.Context, db *pgxpool.Pool, provider, subject string) (int, error) {
	const query = `SELECT user_id FROM auth_identity WHERE provider = $1 AND subject = $2`

	var userID *int
	err := db.QueryRow(ctx, query, provider, subject).Scan(&userID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return 0, nil
	case err != nil:
		return 0, fmt.Errorf("auth: lookup identity: %w", err)
	case userID == nil:
		return 0, nil
	}
	return *userID, nil
}

// LinkUser attaches an athlete row to an identity, so the next sign-in with
// the same Google account resumes that profile instead of asking again.
func LinkUser(ctx context.Context, db *pgxpool.Pool, provider, subject string, userID int) error {
	const query = `
		UPDATE auth_identity SET user_id = $3, updated_at = now()
		WHERE provider = $1 AND subject = $2`

	tag, err := db.Exec(ctx, query, provider, subject, userID)
	if err != nil {
		return fmt.Errorf("auth: link user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("auth: link user: no identity for %s/%s", provider, subject)
	}
	return nil
}

// UserExists guards the link endpoint against pointing an identity at an
// athlete number that was never issued.
func UserExists(ctx context.Context, db *pgxpool.Pool, userID int) (bool, error) {
	var exists bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM userinfo WHERE id = $1)`, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("auth: check user: %w", err)
	}
	return exists, nil
}