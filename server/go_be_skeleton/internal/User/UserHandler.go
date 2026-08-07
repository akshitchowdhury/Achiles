package user

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	trainingplan "github.com/yourusername/goBackendSkeleton/internal/TrainingPlan"
	"github.com/yourusername/goBackendSkeleton/internal/db/s3"
)

func AddUser(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		http.Error(w, "Wrong api call", http.StatusBadRequest)
		return
	}

	var newUSer User

	if err := json.NewDecoder(r.Body).Decode(&newUSer); err != nil {
		http.Error(w, "could not parse in Use dertails", http.StatusInternalServerError)
		return
	}

	query := `
		INSERT INTO userinfo (name, age, weight, gender, height_cm)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`

	err := db.QueryRow(r.Context(), query, newUSer.Name, newUSer.Age, newUSer.Weight, newUSer.Gender, newUSer.Height_cm).Scan(&newUSer.Id)

	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to insert user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newUSer)
	w.WriteHeader(http.StatusCreated)
}

func GetBMI_BMR(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	query := `SELECT id, name, age, weight, gender, height_cm FROM userinfo WHERE id = $1`

	var u User

	// Scanned all 6 columns in the exact order as SELECT
	err = db.QueryRow(r.Context(), query, id).Scan(
		&u.Id,
		&u.Name, // Added missing field
		&u.Age,
		&u.Weight,
		&u.Gender,
		&u.Height_cm,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		fmt.Println("Database error:", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	calBmi := (CalculateBmi(&u))

	calBMR := (CalculateBmr(&u))

	u_Verdict := Get_User_verdict(calBmi)

	w_intake := calculateWaterIntake(u.Weight)
	specsQuery := `
		INSERT INTO user_specs (user_id, bmi_value, bmr_value, verdict,water_intake) 
		VALUES ($1, $2, $3, $4, $5)
	`
	commandTag, err := db.Exec(r.Context(), specsQuery, u.Id, calBmi, calBMR, u_Verdict, w_intake)
	if err != nil {
		editQuery := `
		UPDATE user_specs 
SET 
  bmi_value = $2, 
  bmr_value = $3, 
  verdict = $4, 
  water_intake = $5
WHERE user_id = $1;
	`
		commandTag, err := db.Exec(r.Context(), editQuery, u.Id, calBmi, calBMR, u_Verdict, w_intake)

		if err != nil {
			http.Error(w, "could not edit", http.StatusInternalServerError)
			return
		}

		if commandTag.RowsAffected() == 0 {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"Response: ":     "Exisitng user bmi updated",
			"Calculated BMI": calBmi,
			"Calculated BMR": calBMR, "Verict_user": u_Verdict,
			"Water intake": w_intake})
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"Response: ": "NEw user bmi created",
		"Calculated BMI": calBmi,
		"Calculated BMR": calBMR, "Verict_user": u_Verdict,
		"Water intake": w_intake})

}

func GetUserById(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Selected 6 columns, plus the plan the user has selected (if any)
	query := "SELECT id, name, age, weight, gender, height_cm, training_plan_id FROM userinfo WHERE id = $1"
	specs_query := "SELECT user_id, bmi_value, bmr_value, verdict, water_intake FROM user_specs WHERE user_id = $1"
	var u User

	var s Specs

	var planId *int

	// Scanned all 6 columns in the exact order as SELECT, plus training_plan_id
	err = db.QueryRow(r.Context(), query, id).Scan(
		&u.Id,
		&u.Name, // Added missing field
		&u.Age,
		&u.Weight,
		&u.Gender,
		&u.Height_cm,
		&planId,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		fmt.Println("Database error:", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	specErr := db.QueryRow(r.Context(), specs_query, id).Scan(
		&u.Id,
		&s.U_Bmi.Bmi_value,
		&s.U_Bmr.Bmr_value,
		&s.Verdict,
		&s.U_water_intake,
	)

	if specErr != nil {
		if errors.Is(specErr, pgx.ErrNoRows) {
			fmt.Println("Spec Database error:", specErr)

			http.Error(w, "specs not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	specArr := map[string]any{"BMI": s.U_Bmi.Bmi_value, "BMR": s.U_Bmr.Bmr_value, "Verdict": s.Verdict, "WaterIntake": s.U_water_intake}

	userDetails := map[string]any{
		"id":        u.Id, // Replace with your actual user fields
		"name":      u.Name,
		"weight":    u.Weight,
		"age":       u.Age,
		"gender":    u.Gender,
		"height_cm": u.Height_cm,
		"specs":     specArr, // <-- Nested here
	}

	// A user hasn't necessarily picked a plan yet, so this stays absent
	// rather than null when training_plan_id is unset.
	if planId != nil {
		plan, planErr := trainingplan.GetPlanByID(r.Context(), db, *planId)
		if planErr != nil && !errors.Is(planErr, pgx.ErrNoRows) {
			fmt.Println("Plan lookup error:", planErr)
		} else if planErr == nil {
			plan.ResolveURLs(s3.Bucket)
			userDetails["training_plan"] = plan
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"userDetails": userDetails})
}
