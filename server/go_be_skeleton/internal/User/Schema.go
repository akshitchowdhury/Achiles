package user

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureSchema creates userinfo and user_specs if they are missing, so a fresh
// database (a new VM, a wiped volume) can serve /addUser on first boot instead
// of every user route 500ing on "relation does not exist".
//
// The columns mirror the tables as they exist in the dev database. Two things
// are deliberately left to other EnsureSchema calls:
//
//   - training_plan_id and its FK are added by trainingplan.EnsureSchema,
//     which runs after training_plans exists. Declaring the FK here would make
//     this depend on that table.
//   - Nothing here is an ALTER, so a database created out-of-band before these
//     statements existed is left exactly as it is.
//
// Call this before auth.EnsureSchema and trainingplan.EnsureSchema.
func EnsureSchema(ctx context.Context, db *pgxpool.Pool) error {
	const userinfo = `
		CREATE TABLE IF NOT EXISTS userinfo (
			id                 SERIAL PRIMARY KEY,
			name               VARCHAR(100) NOT NULL,
			age                INTEGER NOT NULL,
			weight             DOUBLE PRECISION NOT NULL,
			gender             TEXT NOT NULL,
			height_cm          SMALLINT,
			created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			experience         TEXT NOT NULL DEFAULT '',
			goals              TEXT[] NOT NULL DEFAULT '{}',
			injuries           TEXT[] NOT NULL DEFAULT '{}',
			medical_conditions TEXT[] NOT NULL DEFAULT '{}',
			medical_notes      TEXT NOT NULL DEFAULT ''
		)`

	// UNIQUE (user_id) is load-bearing: GetBMI_BMR inserts and falls back to
	// an UPDATE when the insert fails, so without it a second /getBMI call
	// would insert a duplicate row instead of updating the first.
	const userSpecs = `
		CREATE TABLE IF NOT EXISTS user_specs (
			id           SERIAL PRIMARY KEY,
			user_id      INTEGER UNIQUE REFERENCES userinfo(id) ON DELETE CASCADE,
			bmi_value    INTEGER,
			bmr_value    INTEGER,
			verdict      VARCHAR(100),
			water_intake INTEGER
		)`

	for _, stmt := range []string{userinfo, userSpecs} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("user: ensure schema: %w", err)
		}
	}
	return nil
}
