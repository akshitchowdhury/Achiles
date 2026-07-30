package user

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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
	specsQuery := `
		INSERT INTO user_specs (user_id, bmi_value, bmr_value, verdict) 
		VALUES ($1, $2, $3, $4)
	`
	commandTag, err := db.Exec(r.Context(), specsQuery, u.Id, calBmi, calBMR, u_Verdict)
	if err != nil {

		fmt.Println(calBmi, calBMR, u_Verdict, err)
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"Calculated BMI": calBmi,
		"Calculated BMR": calBMR, "Verict_user": u_Verdict})

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

	// Selected 6 columns
	query := "SELECT id, name, age, weight, gender, height_cm FROM userinfo WHERE id = $1"
	specs_query := "SELECT user_id, bmi_value, bmr_value, verdict FROM user_specs WHERE user_id = $1"
	var u User

	var s Specs

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

	specErr := db.QueryRow(r.Context(), specs_query, id).Scan(
		&u.Id,
		&s.U_Bmi.Bmi_value,
		&s.U_Bmr.Bmr_value,
		&s.Verdict,
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

	specArr := map[string]any{"BMI": s.U_Bmi.Bmi_value, "BMR": s.U_Bmr.Bmr_value, "Verdict": s.Verdict}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"userDetails": map[string]any{
			"id":        u.Id, // Replace with your actual user fields
			"name":      u.Name,
			"age":       u.Age,
			"gender":    u.Gender,
			"height_cm": u.Height_cm,
			"specs":     specArr, // <-- Nested here
		}})
}
