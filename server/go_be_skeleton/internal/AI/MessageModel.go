package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	auth "github.com/yourusername/goBackendSkeleton/internal/Auth"
	redisratelim "github.com/yourusername/goBackendSkeleton/internal/RateLimiterService/RedisRateLim"
	user "github.com/yourusername/goBackendSkeleton/internal/User"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/db/connect"
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

func CallGroq(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AIConfig, rdb *redis.Client) {

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

	query := `SELECT u.id, u.name, u.age, u.weight, u.gender, u.height_cm, u.training_plan_id,
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
		&u.TrainingPlanId,
		&specs.U_Bmi.Bmi_value,
		&specs.U_Bmr.Bmr_value,
		&specs.Verdict,
	)

	TrainingPlans := make(map[int]string)

	TrainingPlans[1] = "Spartan"
	TrainingPlans[2] = "Greek God"
	TrainingPlans[3] = "Superhero"
	TrainingPlans[4] = "Athlete"
	TrainingPlans[5] = "Manga"

	clientRequest := fmt.Sprintf(
		" Format the response as Markdown using ## for section headings and - for bullets.Help me improve my physique and give me a structured nutrition and workout plan based on my personal data and on most importantly on my Subscribed Training plan: "+
			"Age: %d, Weight: %.2f kg, Gender: %s, Height: %.2f cm, Training_Plan: %v Plan, BMI: %.2f, BMR: %.2f, Verdict: %s",
		u.Age,
		u.Weight,
		u.Gender,
		u.Height_cm,
		TrainingPlans[u.TrainingPlanId],
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

	if specs.Verdict != "Healthy" {
		resp, _ := client.Do(req)
		defer resp.Body.Close()

		// Read output
		body, _ := io.ReadAll(resp.Body)

		connect.AddCache(rdb, string(body), ctx)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{"message": "Responded succesfully",
			"Ai_Response": string(body),
			// "Info":        c.API_KEY,
			// "Payload":     payload,
		})
	} else {

		resp, err := connect.GetCache(rdb, ctx)
		if err != nil {
			http.Error(w, "Could not fetch Cache", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"message": "Cached response fetched succesfully",
			"Ai_Response": resp,
			// "Info":        c.API_KEY,
			// "Payload":     payload,
		})

	}

	// "Client request": clientRequest})
}

// rateLimitKey names the bucket a request spends from. One key is one
// independent budget, so this function is what decides *who* gets throttled.
//
// A signed-in caller is keyed by account: that survives an IP change and
// cannot be dodged by reconnecting. Everyone else falls back to source IP.
// The route name is part of the key so an expensive endpoint's budget stays
// separate from the rest of the API.
func rateLimitKey(r *http.Request, route string, authCfg config.AuthConfig) string {
	if s, err := auth.SessionFrom(r, authCfg); err == nil {
		if s.UserID != 0 {
			return fmt.Sprintf("ratelimit:%s:user:%d", route, s.UserID)
		}
		// Signed in with Google but not yet linked to an athlete row —
		// provider+subject is still a stable identity.
		return fmt.Sprintf("ratelimit:%s:sub:%s:%s", route, s.Provider, s.Subject)
	}

	// RemoteAddr is "host:port" and the port is different on every TCP
	// connection. Keying on it unsplit would hand each request a brand new
	// bucket, which reads as working code that never limits anything.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return fmt.Sprintf("ratelimit:%s:ip:%s", route, host)
}

func TestRateLimit(w http.ResponseWriter, r *http.Request, tb *redisratelim.TokenBucket, authCfg config.AuthConfig) {
	if r.Method != http.MethodPost {
		http.Error(w, "wrong api call", http.StatusBadRequest)
		return
	}

	allowed, remaining, err := tb.Allow(r.Context(), rateLimitKey(r, "rateTest", authCfg))
	if err != nil {
		// Fail open: a Redis outage degrades the limiter rather than the API.
		// Flip this to a 503 for any route where unmetered access is worse
		// than downtime — /askGroq spends real money, so it likely should.
		slog.Error("ratelimit: redis unavailable, allowing request", "error", err)
		allowed, remaining = true, 0
	}

	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(tb.Capacity()))
	w.Header().Set("X-RateLimit-Remaining", strconv.FormatFloat(remaining, 'f', 0, 64))

	if !allowed {
		w.Header().Set("Retry-After", strconv.Itoa(int(tb.RetryAfter().Seconds())))
		http.Error(w, "rate limit exceeded, retry later", http.StatusTooManyRequests)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"message":   "Responded succesfully",
		"remaining": remaining,
		"Response":  "called succesfully",
	})
}

func GuideUser(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AIConfig, rdb *redis.Client) {

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

	query := `SELECT u.id, u.name, u.age, u.weight, u.gender, u.height_cm, u.training_plan_id,
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
		&u.TrainingPlanId,
		&specs.U_Bmi.Bmi_value,
		&specs.U_Bmr.Bmr_value,
		&specs.Verdict,
	)

	TrainingPlans := make(map[int]string)

	TrainingPlans[1] = "Spartan"
	TrainingPlans[2] = "Greek God"
	TrainingPlans[3] = "Superhero"
	TrainingPlans[4] = "Athlete"
	TrainingPlans[5] = "Manga"

	clientRequest := fmt.Sprintf(
		" Format the response as Markdown using ## for section headings and - for bullets. Which Plan I have registered to? How i should I train and dial in my nutrition according to that plan? Give me a detailed guidance for it: "+
			"Age: %d, Weight: %.2f kg, Gender: %s, Height: %.2f cm, Training_Plan: %v Plan, BMI: %.2f, BMR: %.2f, Verdict: %s",
		u.Age,
		u.Weight,
		u.Gender,
		u.Height_cm,
		TrainingPlans[u.TrainingPlanId],
		specs.U_Bmi.Bmi_value,
		specs.U_Bmr.Bmr_value,
		specs.Verdict,
	)
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Could not scan rows", http.StatusInternalServerError)
		return
	}

	// content := "Explain how to build an athletic physique"

	RagRes := RagHelper(w, r, clientRequest)

	json.NewEncoder(w).Encode(RagRes)
	// "Client request": clientRequest})
}
