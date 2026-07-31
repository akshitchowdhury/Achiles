package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

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

func CallGroq(w http.ResponseWriter, r *http.Request, c config.AIConfig) {

	if r.Method != http.MethodPost {
		http.Error(w, "wrong api call", http.StatusBadRequest)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Build and execute request
	var msg Message

	content := "Explain how to build an athletic physique"

	msg.Messages = append(msg.Messages, &Core{Role: "user", Content: content})
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
	resp, _ := client.Do(req)
	defer resp.Body.Close()

	// Read output
	body, _ := io.ReadAll(resp.Body)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"message": "Responded succesfully",
		"Ai_Response": string(body)})

}
