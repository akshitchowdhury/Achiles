package trainingplan

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureSchema creates training_plans if it is missing. The UNIQUE (slug) is
// not decoration — AddPlans upserts ON CONFLICT (slug) and needs the
// constraint to exist.
func EnsureSchema(ctx context.Context, db *pgxpool.Pool) error {
	const ddl = `
		CREATE TABLE IF NOT EXISTS training_plans (
			id            SERIAL PRIMARY KEY,
			name          TEXT NOT NULL,
			slug          TEXT NOT NULL,
			description   TEXT NOT NULL DEFAULT '',
			image_key     TEXT NOT NULL DEFAULT '',
			watermark_key TEXT NOT NULL DEFAULT '',
			UNIQUE (slug)
		)`

	// CREATE TABLE IF NOT EXISTS is a no-op against a database seeded before
	// watermark_key existed, so the column has to be added separately. The
	// DEFAULT '' is what makes this safe to run on a populated table: existing
	// rows get an empty key, the client falls back to the cover art, and
	// nothing 500s while /addPlans is re-posted.
	const addWatermarkKey = `
		ALTER TABLE training_plans
		ADD COLUMN IF NOT EXISTS watermark_key TEXT NOT NULL DEFAULT ''`

	// Nutrition/workout templates and the userinfo link are additive to the
	// plan catalog above, so they're ensured in the same call rather than a
	// second EnsureSchema that callers would have to remember to also invoke.
	const nutritionTemplates = `
		CREATE TABLE IF NOT EXISTS nutrition_templates (
			id                BIGSERIAL PRIMARY KEY,
			training_plan_id  INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
			calorie_guidance  TEXT NOT NULL DEFAULT '',
			protein_pct       DOUBLE PRECISION NOT NULL DEFAULT 0,
			carbs_pct         DOUBLE PRECISION NOT NULL DEFAULT 0,
			fats_pct          DOUBLE PRECISION NOT NULL DEFAULT 0,
			meal_frequency    INTEGER NOT NULL DEFAULT 0,
			notes             TEXT NOT NULL DEFAULT '',
			UNIQUE (training_plan_id)
		)`

	const workoutTemplates = `
		CREATE TABLE IF NOT EXISTS workout_templates (
			id               BIGSERIAL PRIMARY KEY,
			training_plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
			split_name       TEXT NOT NULL,
			day_order        INTEGER NOT NULL DEFAULT 1,
			notes            TEXT NOT NULL DEFAULT ''
		)`

	const workoutExercises = `
		CREATE TABLE IF NOT EXISTS workout_exercises (
			id                   BIGSERIAL PRIMARY KEY,
			workout_template_id  BIGINT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
			name                 TEXT NOT NULL,
			sets                 INTEGER NOT NULL DEFAULT 0,
			reps                 TEXT NOT NULL DEFAULT '',
			rest_seconds         INTEGER NOT NULL DEFAULT 0,
			exercise_order       INTEGER NOT NULL DEFAULT 1
		)`

	// userinfo is created out-of-band (see auth.EnsureSchema's note on the
	// same tradeoff), but by this point training_plans is guaranteed to
	// exist, so the FK is safe to add here.
	const userPlanLink = `
		ALTER TABLE userinfo ADD COLUMN IF NOT EXISTS training_plan_id INTEGER REFERENCES training_plans(id)`

	for _, stmt := range []string{ddl, addWatermarkKey, nutritionTemplates, workoutTemplates, workoutExercises, userPlanLink} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("trainingplan: ensure schema: %w", err)
		}
	}
	return nil
}

// GetPlanByID returns pgx.ErrNoRows if no plan has that id.
func GetPlanByID(ctx context.Context, db *pgxpool.Pool, id int) (*TrainingPlan, error) {
	const query = `SELECT ` + plan_details + ` FROM training_plans WHERE id = $1`

	var p TrainingPlan
	if err := db.QueryRow(ctx, query, id).Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.ImageKey, &p.WatermarkKey); err != nil {
		return nil, err
	}
	return &p, nil
}

// AssignPlanToUser sets which plan a user has selected. Returns
// pgx.ErrNoRows if the user doesn't exist.
func AssignPlanToUser(ctx context.Context, db *pgxpool.Pool, userID, planID int) error {
	const query = `UPDATE userinfo SET training_plan_id = $2 WHERE id = $1`

	tag, err := db.Exec(ctx, query, userID, planID)
	if err != nil {
		return fmt.Errorf("trainingplan: assign plan: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// GetUserTrainingPlanID returns the plan id a user has selected, or 0 if
// they haven't picked one yet. Returns pgx.ErrNoRows if the user doesn't
// exist.
func GetUserTrainingPlanID(ctx context.Context, db *pgxpool.Pool, userID int) (int, error) {
	const query = `SELECT training_plan_id FROM userinfo WHERE id = $1`

	var planID *int
	if err := db.QueryRow(ctx, query, userID).Scan(&planID); err != nil {
		return 0, err
	}
	if planID == nil {
		return 0, nil
	}
	return *planID, nil
}

// CreateNutritionTemplate inserts the (single) nutrition template for a plan.
func CreateNutritionTemplate(ctx context.Context, db *pgxpool.Pool, n *NutritionTemplate) error {
	const query = `
		INSERT INTO nutrition_templates
			(training_plan_id, calorie_guidance, protein_pct, carbs_pct, fats_pct, meal_frequency, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`

	err := db.QueryRow(ctx, query,
		n.TrainingPlanID, n.CalorieGuidance, n.ProteinPct, n.CarbsPct, n.FatsPct, n.MealFrequency, n.Notes,
	).Scan(&n.ID)
	if err != nil {
		return fmt.Errorf("trainingplan: create nutrition template: %w", err)
	}
	return nil
}

// GetNutritionTemplateByPlan returns pgx.ErrNoRows if the plan has none yet.
func GetNutritionTemplateByPlan(ctx context.Context, db *pgxpool.Pool, planID int) (*NutritionTemplate, error) {
	const query = `
		SELECT id, training_plan_id, calorie_guidance, protein_pct, carbs_pct, fats_pct, meal_frequency, notes
		FROM nutrition_templates WHERE training_plan_id = $1`

	n := &NutritionTemplate{}
	err := db.QueryRow(ctx, query, planID).Scan(
		&n.ID, &n.TrainingPlanID, &n.CalorieGuidance, &n.ProteinPct, &n.CarbsPct, &n.FatsPct, &n.MealFrequency, &n.Notes,
	)
	if err != nil {
		return nil, err
	}
	return n, nil
}

// CreateWorkoutTemplate inserts one training day for a plan.
func CreateWorkoutTemplate(ctx context.Context, db *pgxpool.Pool, wt *WorkoutTemplate) error {
	const query = `
		INSERT INTO workout_templates (training_plan_id, split_name, day_order, notes)
		VALUES ($1, $2, $3, $4)
		RETURNING id`

	if err := db.QueryRow(ctx, query, wt.TrainingPlanID, wt.SplitName, wt.DayOrder, wt.Notes).Scan(&wt.ID); err != nil {
		return fmt.Errorf("trainingplan: create workout template: %w", err)
	}
	return nil
}

// AddExercise appends one movement to a workout template.
func AddExercise(ctx context.Context, db *pgxpool.Pool, e *WorkoutExercise) error {
	const query = `
		INSERT INTO workout_exercises (workout_template_id, name, sets, reps, rest_seconds, exercise_order)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`

	err := db.QueryRow(ctx, query,
		e.WorkoutTemplateID, e.Name, e.Sets, e.Reps, e.RestSeconds, e.ExerciseOrder,
	).Scan(&e.ID)
	if err != nil {
		return fmt.Errorf("trainingplan: add exercise: %w", err)
	}
	return nil
}

// GetWorkoutTemplatesByPlan returns every training day for a plan, in day
// order, each with its exercises nested in.
func GetWorkoutTemplatesByPlan(ctx context.Context, db *pgxpool.Pool, planID int) ([]*WorkoutTemplate, error) {
	const query = `
		SELECT id, training_plan_id, split_name, day_order, notes
		FROM workout_templates WHERE training_plan_id = $1 ORDER BY day_order`

	rows, err := db.Query(ctx, query, planID)
	if err != nil {
		return nil, fmt.Errorf("trainingplan: list workout templates: %w", err)
	}
	defer rows.Close()

	templates := []*WorkoutTemplate{}
	for rows.Next() {
		wt := &WorkoutTemplate{}
		if err := rows.Scan(&wt.ID, &wt.TrainingPlanID, &wt.SplitName, &wt.DayOrder, &wt.Notes); err != nil {
			return nil, fmt.Errorf("trainingplan: scan workout template: %w", err)
		}
		templates = append(templates, wt)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, wt := range templates {
		exercises, err := getExercisesByTemplate(ctx, db, wt.ID)
		if err != nil {
			return nil, err
		}
		wt.Exercises = exercises
	}
	return templates, nil
}

func getExercisesByTemplate(ctx context.Context, db *pgxpool.Pool, templateID int) ([]*WorkoutExercise, error) {
	const query = `
		SELECT id, workout_template_id, name, sets, reps, rest_seconds, exercise_order
		FROM workout_exercises WHERE workout_template_id = $1 ORDER BY exercise_order`

	rows, err := db.Query(ctx, query, templateID)
	if err != nil {
		return nil, fmt.Errorf("trainingplan: list exercises: %w", err)
	}
	defer rows.Close()

	exercises := []*WorkoutExercise{}
	for rows.Next() {
		e := &WorkoutExercise{}
		if err := rows.Scan(&e.ID, &e.WorkoutTemplateID, &e.Name, &e.Sets, &e.Reps, &e.RestSeconds, &e.ExerciseOrder); err != nil {
			return nil, fmt.Errorf("trainingplan: scan exercise: %w", err)
		}
		exercises = append(exercises, e)
	}
	return exercises, rows.Err()
}

// BuildDashboard assembles everything a user's dashboard needs for the plan
// they've selected: the plan, its nutrition template (nil if none has been
// authored yet), and its workout templates with exercises.
func BuildDashboard(ctx context.Context, db *pgxpool.Pool, planID int) (*Dashboard, error) {
	plan, err := GetPlanByID(ctx, db, planID)
	if err != nil {
		return nil, err
	}

	dash := &Dashboard{Plan: *plan}

	nutrition, err := GetNutritionTemplateByPlan(ctx, db, planID)
	switch {
	case err == nil:
		dash.Nutrition = nutrition
	case errors.Is(err, pgx.ErrNoRows):
		// No nutrition template authored yet — leave it nil.
	default:
		return nil, err
	}

	workouts, err := GetWorkoutTemplatesByPlan(ctx, db, planID)
	if err != nil {
		return nil, err
	}
	dash.Workouts = workouts

	return dash, nil
}

// addPlansQuery upserts the whole batch in one statement. unnest turns the
// five text[] parameters into rows, so the list length stays a runtime detail
// instead of being baked into the SQL.
//
// Being a single statement it is atomic on its own — Postgres wraps it in an
// implicit transaction, so a failure on any row leaves the table untouched.
// No explicit db.Begin is needed unless this grows a second statement.
const addPlansQuery = `
	INSERT INTO training_plans (name, slug, description, image_key, watermark_key)
	SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
	ON CONFLICT (slug) DO UPDATE
	SET name          = EXCLUDED.name,
	    description   = EXCLUDED.description,
	    image_key     = EXCLUDED.image_key,
	    watermark_key = EXCLUDED.watermark_key
	RETURNING id, name, slug, description, image_key, watermark_key`

// AddPlans upserts plans by slug and returns the stored rows, ids included.
//
// Each plan's image_key and watermark_key are taken from PlanAssets rather
// than from the caller, matched on Slug — the request body supplies only the
// editable half. A slug with no asset is an UnknownSlugError and nothing is
// written.
//
// Because the keys come from the table rather than the body, re-posting the
// same plan list is how a deployment picks up new or renamed art. That is the
// intended migration path for rows written before watermark_key existed.
//
// Returned rows carry the keys; call ResolveURLs on each before encoding a
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
	marks := make([]string, len(plans))
	for i, p := range plans {
		asset, ok := AssetFor(p.Slug)
		if !ok {
			return nil, UnknownSlugError{Slug: p.Slug}
		}
		names[i], slugs[i], descs[i] = p.Name, p.Slug, p.Description
		keys[i], marks[i] = asset.ImageKey, asset.WatermarkKey
	}

	rows, err := db.Query(ctx, addPlansQuery, names, slugs, descs, keys, marks)
	if err != nil {
		return nil, fmt.Errorf("trainingplan: upsert plans: %w", err)
	}
	defer rows.Close()

	out := make([]TrainingPlan, 0, len(plans))
	for rows.Next() {
		var p TrainingPlan
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Slug, &p.Description, &p.ImageKey, &p.WatermarkKey,
		); err != nil {
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
