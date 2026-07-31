package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	ai "github.com/yourusername/goBackendSkeleton/internal/AI"
	user "github.com/yourusername/goBackendSkeleton/internal/User"
	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/server/handlers"
)

// newRouter wires up routes to their handlers. Add new route groups here
// as the API grows — e.g. mux.Handle("/api/v1/users/", usersHandler).
func newRouter(pool *pgxpool.Pool, cfg *config.Config) *http.ServeMux {
	mux := http.NewServeMux()
	db := pool

	health := handlers.NewHealthHandler(pool)
	mux.HandleFunc("GET /healthz", health.Live)
	mux.HandleFunc("GET /readyz", health.Ready)
	mux.HandleFunc("/addUser", func(w http.ResponseWriter, r *http.Request) { user.AddUser(db, w, r) })
	mux.HandleFunc("/getUserById", func(w http.ResponseWriter, r *http.Request) { user.GetUserById(db, w, r) })
	mux.HandleFunc("/getBMI", func(w http.ResponseWriter, r *http.Request) { user.GetBMI_BMR(db, w, r) })
	mux.HandleFunc("/askGroq", func(w http.ResponseWriter, r *http.Request) { ai.CallGroq(db, w, r, cfg.AI) })

	return mux
}
