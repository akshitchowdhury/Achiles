package server

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	ai "github.com/yourusername/goBackendSkeleton/internal/AI"
	auth "github.com/yourusername/goBackendSkeleton/internal/Auth"
	docgeneration "github.com/yourusername/goBackendSkeleton/internal/DocGeneration"
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

	// Google OAuth. The client reaches /login, /auth/me, /auth/link and
	// /auth/logout through the Vite proxy, which strips the /api prefix.
	// The callback is the exception: Google redirects the browser straight
	// at the Go server, so its path must match the registered redirect URI
	// (REDIRECTURI) character for character, /api included.
	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) { auth.HandleAuth(w, r, cfg.AUTH) })
	mux.HandleFunc("/api/auth/oauth/google/callback", func(w http.ResponseWriter, r *http.Request) {
		auth.HandleCallback(db, w, r, cfg.AUTH)
	})
	mux.HandleFunc("/auth/me", func(w http.ResponseWriter, r *http.Request) { auth.HandleMe(db, w, r, cfg.AUTH) })
	mux.HandleFunc("/auth/link", func(w http.ResponseWriter, r *http.Request) { auth.HandleLink(db, w, r, cfg.AUTH) })
	mux.HandleFunc("/auth/logout", func(w http.ResponseWriter, r *http.Request) { auth.HandleLogout(w, r, cfg.AUTH) })
	mux.HandleFunc("/docgeneration", func(w http.ResponseWriter, r *http.Request) { docgeneration.ServeDocxHandler(w, r) })

	return mux
}
