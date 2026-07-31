package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	user "github.com/yourusername/goBackendSkeleton/internal/User"
	"github.com/yourusername/goBackendSkeleton/internal/config"
)

type Core struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// var Messages [] *Core

type Message struct {
	Messages []*Core `json:"messages"`
}

// {

//   "model": "llama-3.3-70b-versatile",
//   "messages": [{
//       "role": "user",
//       "content": "Explain how to build an athletic physique"
//   }]
// }

func CallGroq(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AIConfig) {

	if r.Method != http.MethodPost {
		http.Error(w, "wrong api call", http.StatusBadRequest)
		return
	}

	idStr := r.URL.Query().Get("id")

	id, err := strconv.Atoi(idStr)

	// if err:= json.NewDecoder(r.Body).Decode(&clientRequest); err!=nil{
	// 	http.Error(w, "Could not parse in query of user", http.StatusInternalServerError)
	// }

	if err != nil {
		fmt.Println("Id issue", err, id)
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	query := `SELECT u.id, u.name, u.age, u.weight, u.gender, u.height_cm,
    s.bmi_value, s.bmr_value, s.verdict
FROM userinfo u
JOIN user_specs s ON u.id = s.user_id
WHERE u.id = $1`

	var u user.User
	var specs user.Specs
	err = db.QueryRow(r.Context(), query, id).Scan(
		&u.Id,
		&u.Name,
		&u.Age,
		&u.Weight,
		&u.Gender,
		&u.Height_cm,
		&specs.U_Bmi.Bmi_value,
		&specs.U_Bmr.Bmr_value,
		&specs.Verdict,
	)

	clientRequest := fmt.Sprintf(
		"Help me improve my physique and give me a structured nutrition and workout plan based on my personal data: "+
			"Age: %d, Weight: %.2f kg, Gender: %s, Height: %.2f cm, BMI: %.2f, BMR: %.2f, Verdict: %s",
		u.Age,
		u.Weight,
		u.Gender,
		u.Height_cm,
		specs.U_Bmi.Bmi_value,
		specs.U_Bmr.Bmr_value,
		specs.Verdict,
	)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Could not scan rows", http.StatusInternalServerError)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Build and execute request
	var msg Message

	// content := "Explain how to build an athletic physique"

	msg.Messages = append(msg.Messages, &Core{Role: "user", Content: clientRequest})
	payload := map[string]any{"model": "llama-3.3-70b-versatile",
		"messages": msg.Messages}
	jsonValue, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonValue))
	if err != nil {
		fmt.Println("Could not prceed", err)
		http.Error(w, "Could not mk api call", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.API_KEY))
	// req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.API_KEY))
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	// Read output
	body, _ := io.ReadAll(resp.Body)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"message": "Responded succesfully",
		"Ai_Response": string(body),
	})
	// "Client request": clientRequest})

}
