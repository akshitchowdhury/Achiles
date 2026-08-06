package trainingplan

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

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
		plans[i].ResolveImageURL(s3.Bucket)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(plans)
}

const plan_details = `id, name, slug, description, image_key`

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
	return row.Scan(&u.ID, &u.Name, &u.Slug, &u.Description, &u.ImageKey)
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
		plans[i].ResolveImageURL(s3.Bucket)
	}

	// An empty result must encode as [] and not null, which is why collectUsers
	// returns a made slice rather than a nil one.

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(plans)
}
