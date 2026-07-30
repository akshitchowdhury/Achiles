// Package server owns the HTTP net module: building the handler chain,
// listening, and shutting down cleanly.
package server

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/goBackendSkeleton/internal/config"
	"github.com/yourusername/goBackendSkeleton/internal/server/middleware"
)

// Server wraps an http.Server with the app's configured middleware chain.
type Server struct {
	httpServer *http.Server
}

// New builds a Server ready to Start, wiring the router through the
// standard middleware chain: recover -> logging -> CORS -> routes.
func New(cfg *config.Config, pool *pgxpool.Pool, logger *slog.Logger) *Server {
	mux := newRouter(pool)

	handler := middleware.Chain(mux,
		middleware.Recover(logger),
		middleware.Logging(logger),
		middleware.CORS(cfg.CORS),
	)

	return &Server{
		httpServer: &http.Server{
			Addr:         ":" + cfg.HTTP.Port,
			Handler:      handler,
			ReadTimeout:  cfg.HTTP.ReadTimeout,
			WriteTimeout: cfg.HTTP.WriteTimeout,
			IdleTimeout:  cfg.HTTP.IdleTimeout,
		},
	}
}

// Start blocks serving HTTP until the server is shut down. It returns nil
// on a clean shutdown (http.ErrServerClosed is swallowed).
func (s *Server) Start() error {
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// Addr returns the address the server is configured to listen on.
func (s *Server) Addr() string {
	return s.httpServer.Addr
}

// Shutdown gracefully stops the server, waiting for in-flight requests to
// finish or ctx to expire, whichever comes first.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
