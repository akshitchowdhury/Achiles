package trainingplan

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/goBackendSkeleton/internal/db/s3"
)

// AddPlansHandler seeds or refreshes the plan catalogue from a JSON array of
// plan details. Cover images are not part of the payload — each plan's
// image_key is looked up in PlanAssets by slug.
//
//	POST /addPlans
//	[
//	  {"name": "Spartan Plan",   "slug": "spartan",   "description": "..."},
//	  {"name": "Greek God Plan", "slug": "greek-god", "description": "..."}
//	]
//
// Re-posting the same slug updates that plan rather than duplicating it.
func AddPlansHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var details []PlanDetails
	if err := json.NewDecoder(r.Body).Decode(&details); err != nil {
		http.Error(w, "Invalid request body — expected a JSON array of plans", http.StatusBadRequest)
		return
	}

	plans, err := AddPlans(r.Context(), db, details)
	if err != nil {
		// A bad slug is the caller's mistake, and naming it beats a generic 400
		// when the body was hand-written in a REST client.
		var unknown UnknownSlugError
		if errors.As(err, &unknown) {
			http.Error(w, unknown.Error(), http.StatusBadRequest)
			return
		}
		slog.Error("trainingplan: add plans", "error", err)
		http.Error(w, "Failed to save plans", http.StatusInternalServerError)
		return
	}

	for i := range plans {
		plans[i].ResolveURLs(s3.Bucket)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(plans)
}

const plan_details = `id, name, slug, description, image_key, watermark_key`

func collectPlans(rows pgx.Rows, capHint int) ([]TrainingPlan, error) {
	defer rows.Close()

	out := make([]TrainingPlan, 0, capHint)
	for rows.Next() {
		var u TrainingPlan
		if err := scanUser(rows, &u); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func scanUser(row pgx.Row, u *TrainingPlan) error {
	return row.Scan(&u.ID, &u.Name, &u.Slug, &u.Description, &u.ImageKey, &u.WatermarkKey)
}

func GetAllPlansHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// var details []PlanDetails

	const query = `SELECT ` + plan_details + ` FROM training_plans ORDER BY id`

	rows, err := db.Query(r.Context(), query)
	if err != nil {
		slog.Error("users: select all", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	plans, err := collectPlans(rows, 0)
	if err != nil {
		slog.Error("users: select all", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	for i := range plans {
		plans[i].ResolveURLs(s3.Bucket)
	}

	// An empty result must encode as [] and not null, which is why collectUsers
	// returns a made slice rather than a nil one.

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(plans)
}

// SelectTrainingPlanHandler assigns a catalog plan to a user:
// {"user_id": 1, "training_plan_id": 2}.
func SelectTrainingPlanHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		UserID         int `json:"user_id"`
		TrainingPlanID int `json:"training_plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := AssignPlanToUser(r.Context(), db, body.UserID, body.TrainingPlanID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		slog.Error("trainingplan: select plan", "error", err)
		http.Error(w, "Failed to select training plan", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"message":          "Training plan selected",
		"user_id":          body.UserID,
		"training_plan_id": body.TrainingPlanID,
	})
}

// AddNutritionTemplateHandler creates the basic nutrition template for a plan.
func AddNutritionTemplateHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var n NutritionTemplate
	if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := CreateNutritionTemplate(r.Context(), db, &n); err != nil {
		slog.Error("trainingplan: add nutrition template", "error", err)
		http.Error(w, "Failed to insert nutrition template", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(n)
}

// AddWorkoutTemplateHandler creates one training day (e.g. "Push Day") for a plan.
func AddWorkoutTemplateHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var wt WorkoutTemplate
	if err := json.NewDecoder(r.Body).Decode(&wt); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := CreateWorkoutTemplate(r.Context(), db, &wt); err != nil {
		slog.Error("trainingplan: add workout template", "error", err)
		http.Error(w, "Failed to insert workout template", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wt)
}

// AddWorkoutExerciseHandler appends one movement to a workout template.
func AddWorkoutExerciseHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var e WorkoutExercise
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := AddExercise(r.Context(), db, &e); err != nil {
		slog.Error("trainingplan: add exercise", "error", err)
		http.Error(w, "Failed to insert exercise", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

// GetDashboardHandler returns the full plan — plan art, nutrition, and
// workouts/exercises — for whatever a user has selected. This is what the
// dashboard page renders once a user has a training_plan_id.
func GetDashboardHandler(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.URL.Query().Get("id")
	userID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	planID, err := GetUserTrainingPlanID(r.Context(), db, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		slog.Error("trainingplan: get dashboard", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if planID == 0 {
		http.Error(w, "User has not selected a training plan", http.StatusNotFound)
		return
	}

	dash, err := BuildDashboard(r.Context(), db, planID)
	if err != nil {
		slog.Error("trainingplan: get dashboard", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	dash.Plan.ResolveURLs(s3.Bucket)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"dashboard": dash})
}
