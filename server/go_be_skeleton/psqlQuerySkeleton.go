package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func (h *UserHandler) AddOne(w http.ResponseWriter, r *http.Request) {
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	query := `
		INSERT INTO users (name, age, weight, gender, height_cm)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`

	err := h.DB.QueryRow(r.Context(), query, u.Name, u.Age, u.Weight, u.Gender, u.HeightCm).Scan(&u.ID)
	if err != nil {
		http.Error(w, "Failed to insert user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

func (h *UserHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, name, age, weight, gender, height_cm FROM users`

	rows, err := h.DB.Query(r.Context(), query)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name, &u.Age, &u.Weight, &u.Gender, &u.HeightCm); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *UserHandler) GetOne(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id") // Go 1.22+ path pattern routing

	query := `SELECT id, name, age, weight, gender, height_cm FROM users WHERE id = $1`

	var u User
	err := h.DB.QueryRow(r.Context(), query, id).Scan(
		&u.ID, &u.Name, &u.Age, &u.Weight, &u.Gender, &u.HeightCm,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func GetUserById(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Selected 6 columns
	query := "SELECT id, name, age, weight, gender, height_cm FROM userinfo WHERE id = $1"

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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func (h *UserHandler) EditOne(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	query := `
		UPDATE users 
		SET name = $1, age = $2, weight = $3, gender = $4, height_cm = $5 
		WHERE id = $6`

	commandTag, err := h.DB.Exec(r.Context(), query, u.Name, u.Age, u.Weight, u.Gender, u.HeightCm, id)
	if err != nil {
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "User updated successfully"})
}

// query := `
// SELECT
//     u.id, u.name, u.age, u.weight, u.gender, u.height_cm,
//     s.bmi_value, s.bmr_value, s.verdict
// FROM userinfo u
// JOIN user_specs s ON u.id = s.user_id
// WHERE u.id = $1`

// err := db.QueryRow(ctx, query, userID).Scan(
//     &user.ID,
//     &user.Name,
//     &user.Age,
//     &user.Weight,
//     &user.Gender,
//     &user.HeightCM,
//     &specs.BMIValue,
//     &specs.BMRValue,
//     &specs.Verdict,
// )
