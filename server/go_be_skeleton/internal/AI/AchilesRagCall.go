package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pb "github.com/yourusername/goBackendSkeleton/grpc_template"
	user "github.com/yourusername/goBackendSkeleton/internal/User"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// askAchiles puts one prompt through the RAG service at addr and returns the
// answer it generated. Errors are returned rather than written to a
// ResponseWriter so the caller stays in charge of the status code.
//
// The request context is the parent, so an athlete who closes the tab stops
// the Go side waiting. The deadline on top of it is the RAG budget.
func askAchiles(ctx context.Context, addr string, timeout time.Duration, prompt string) (string, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return "", fmt.Errorf("dial rag service: %w", err)
	}
	defer conn.Close()

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Length only: the prompt carries the athlete's age, weight and health
	// verdict, which has no business sitting in the server logs.
	slog.Info("achiles: asking rag service", "addr", addr, "prompt_chars", len(prompt))
	res, err := pb.NewAiDatServiceClient(conn).ProcessText(ctx, &pb.AiRequest{Data: prompt})
	if err != nil {
		return "", fmt.Errorf("process text: %w", err)
	}

	return res.GetData(), nil
}

// GuideUser answers POST /askAchiles?id=N — the RAG-backed coach that replaces
// /askGroq on the client.
//
// The contract on the way in is deliberately identical to /askGroq's: the id is
// the whole request and the prompt is assembled here from the athlete's stored
// metrics, so nothing about the request had to change on the client. What comes
// back is different — the RAG service generates plain text, so there is no
// provider completion envelope to forward and the answer ships as a string.
//
// The prompt still asks for Markdown markers. They are a structure signal, not
// a display choice: `##` and `-` are the most reliable way to get sections and
// lists out of a model, and the client strips the markers before rendering.
func GuideUser(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AIConfig, limits AchilesLimits) {
	if r.Method != http.MethodPost {
		http.Error(w, "wrong api call", http.StatusBadRequest)
		return
	}

	// The server-wide WriteTimeout (HTTP_WRITE_TIMEOUT, 10s by default) is
	// sized for CRUD and would cut this response off long before the model
	// answers. Lift it for this request only, a little past the RAG budget so
	// a timeout from the RAG call still gets written back as a 502.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(c.RagTimeout + 10*time.Second)); err != nil {
		slog.Warn("achiles: could not extend write deadline", "error", err)
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		fmt.Println("Id issue", err, idStr)
		http.Error(w, "Invalid id", http.StatusBadRequest)
		return
	}

	// The plan comes off the catalog row rather than an id→name table in code,
	// so a plan renamed or added via /addPlans reaches the coach with no edit
	// here. LEFT JOIN because picking a plan is optional.
	query := `SELECT u.id, u.name, u.age, u.weight, u.gender, u.height_cm, p.name,
    s.bmi_value, s.bmr_value, s.verdict
FROM userinfo u
JOIN user_specs s ON u.id = s.user_id
LEFT JOIN training_plans p ON p.id = u.training_plan_id
WHERE u.id = $1`

	var u user.User
	var specs user.Specs
	// Nullable on two counts — training_plan_id is unset until the athlete
	// picks, and the LEFT JOIN yields NULL for a dangling id — so a bare
	// string would fail the scan for anyone who has not chosen a plan yet.
	var planName *string

	err = db.QueryRow(r.Context(), query, id).Scan(
		&u.Id,
		&u.Name,
		&u.Age,
		&u.Weight,
		&u.Gender,
		&u.Height_cm,
		&planName,
		&specs.U_Bmi.Bmi_value,
		&specs.U_Bmr.Bmr_value,
		&specs.Verdict,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// No athlete, or no user_specs row yet (the JOIN needs both).
		http.Error(w, "No athlete profile with computed specs for that id", http.StatusNotFound)
		return
	}
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Could not scan rows", http.StatusInternalServerError)
		return
	}

	// Metered only once the athlete is known to exist, so requests for made-up
	// ids are rejected by the lookup above and never spend the global budget.
	if !limits.allow(w, r, id) {
		return
	}

	plan := "none selected yet"
	if planName != nil && *planName != "" {
		plan = *planName + " Plan"
	}

	clientRequest := fmt.Sprintf(
		"Format the response as Markdown using ## for section headings and - for bullets. "+
			"Which plan am I registered to? How should I train and dial in my nutrition "+
			"according to that plan? Give me detailed guidance for it: "+
			"Age: %d, Weight: %.2f kg, Gender: %s, Height: %.2f cm, Training_Plan: %s, BMI: %.2f, BMR: %.2f, Verdict: %s",
		u.Age,
		u.Weight,
		u.Gender,
		u.Height_cm,
		plan,
		specs.U_Bmi.Bmi_value,
		specs.U_Bmr.Bmr_value,
		specs.Verdict,
	)

	answer, err := askAchiles(r.Context(), c.RagAddr, c.RagTimeout, clientRequest)
	if err != nil {
		fmt.Println("askAchiles:", err)
		// 502, not 500: the Go server did its part and the dependency behind
		// it is what failed, which is also what the client message says.
		http.Error(w, "Could not reach the Achiles model", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"message":          "Responded succesfully",
		"Achiles_Response": answer,
	})
}
