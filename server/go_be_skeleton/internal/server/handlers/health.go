package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// HealthHandler groups handlers that depend on shared server resources
// such as the database pool. Add new dependencies here as the app grows,
// and new handler groups as separate structs following this pattern.
type HealthHandler struct {
	pool *pgxpool.Pool
}

func NewHealthHandler(pool *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{pool: pool}
}

// Live reports whether the process is up. It never checks dependencies —
// use it for a liveness probe that shouldn't restart the pod on a DB blip.
func (h *HealthHandler) Live(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Ready reports whether the service can serve traffic, i.e. the database
// is reachable. Use it for a readiness probe.
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := h.pool.Ping(ctx); err != nil {
		Error(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	JSON(w, http.StatusOK, map[string]string{"status": "ready"})
}
