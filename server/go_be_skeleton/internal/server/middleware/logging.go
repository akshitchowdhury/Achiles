package middleware

import (
	"log/slog"
	"net/http"
	"time"
)

// statusRecorder captures the status code written by the wrapped handler so
// it can be logged after the request completes.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// Unwrap exposes the real writer to http.ResponseController. Without it,
// SetWriteDeadline fails with "feature not supported", and /askAchiles can't
// lift the server-wide 10s WriteTimeout: the coach's answer was computed and
// logged as a 200, then dropped on the wire.
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

// Logging returns middleware that logs method, path, status, and duration
// for every request using the given structured logger.
func Logging(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(rec, r)

			logger.Info("http_request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"duration_ms", time.Since(start).Milliseconds(),
				"remote_addr", r.RemoteAddr,
			)
		})
	}
}
