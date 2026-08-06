package trainingplan

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureSchema creates training_plans if it is missing. The UNIQUE (slug) is
// not decoration — AddPlans upserts ON CONFLICT (slug) and needs the
// constraint to exist.
func EnsureSchema(ctx context.Context, db *pgxpool.Pool) error {
	const ddl = `
		CREATE TABLE IF NOT EXISTS training_plans (
			id          SERIAL PRIMARY KEY,
			name        TEXT NOT NULL,
			slug        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			image_key   TEXT NOT NULL DEFAULT '',
			UNIQUE (slug)
		)`

	if _, err := db.Exec(ctx, ddl); err != nil {
		return fmt.Errorf("trainingplan: ensure schema: %w", err)
	}
	return nil
}

// addPlansQuery upserts the whole batch in one statement. unnest turns the
// four text[] parameters into rows, so the list length stays a runtime detail
// instead of being baked into the SQL.
//
// Being a single statement it is atomic on its own — Postgres wraps it in an
// implicit transaction, so a failure on any row leaves the table untouched.
// No explicit db.Begin is needed unless this grows a second statement.
const addPlansQuery = `
	INSERT INTO training_plans (name, slug, description, image_key)
	SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
	ON CONFLICT (slug) DO UPDATE
	SET name        = EXCLUDED.name,
	    description = EXCLUDED.description,
	    image_key   = EXCLUDED.image_key
	RETURNING id, name, slug, description, image_key`

// AddPlans upserts plans by slug and returns the stored rows, ids included.
//
// Each plan's image_key is taken from PlanAssets rather than from the caller,
// matched on Slug — the request body supplies only the editable half. A slug
// with no asset is an UnknownSlugError and nothing is written.
//
// Returned rows carry ImageKey; call ResolveImageURL on each before encoding a
// response.
//
// Slugs must be unique within plans: Postgres rejects a batch that tries to
// update the same conflicting row twice.
func AddPlans(ctx context.Context, db *pgxpool.Pool, plans []PlanDetails) ([]TrainingPlan, error) {
	if len(plans) == 0 {
		return []TrainingPlan{}, nil
	}

	names := make([]string, len(plans))
	slugs := make([]string, len(plans))
	descs := make([]string, len(plans))
	keys := make([]string, len(plans))
	for i, p := range plans {
		key, ok := ImageKeyFor(p.Slug)
		if !ok {
			return nil, UnknownSlugError{Slug: p.Slug}
		}
		names[i], slugs[i], descs[i], keys[i] = p.Name, p.Slug, p.Description, key
	}

	rows, err := db.Query(ctx, addPlansQuery, names, slugs, descs, keys)
	if err != nil {
		return nil, fmt.Errorf("trainingplan: upsert plans: %w", err)
	}
	defer rows.Close()

	out := make([]TrainingPlan, 0, len(plans))
	for rows.Next() {
		var p TrainingPlan
		if err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.ImageKey); err != nil {
			return nil, fmt.Errorf("trainingplan: scan plan: %w", err)
		}
		out = append(out, p)
	}

	// pgx surfaces most server-side failures here rather than from Query, so a
	// constraint violation would be swallowed without this check.
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("trainingplan: upsert plans: %w", err)
	}
	return out, nil
}
