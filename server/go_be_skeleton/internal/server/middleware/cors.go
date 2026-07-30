package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/yourusername/goBackendSkeleton/internal/config"
)

// CORS returns middleware that applies the given CORS policy to every
// request, and short-circuits preflight (OPTIONS) requests with a 204.
func CORS(cfg config.CORSConfig) func(http.Handler) http.Handler {
	allowAllOrigins := len(cfg.AllowedOrigins) == 1 && cfg.AllowedOrigins[0] == "*"
	allowedOrigins := make(map[string]struct{}, len(cfg.AllowedOrigins))
	for _, o := range cfg.AllowedOrigins {
		allowedOrigins[o] = struct{}{}
	}
	allowedMethods := strings.Join(cfg.AllowedMethods, ", ")
	allowedHeaders := strings.Join(cfg.AllowedHeaders, ", ")
	exposedHeaders := strings.Join(cfg.ExposedHeaders, ", ")
	maxAge := strconv.Itoa(cfg.MaxAge)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			_, isAllowed := allowedOrigins[origin]
			switch {
			case allowAllOrigins && cfg.AllowCredentials:
				// Wildcards can't be combined with credentials per the Fetch
				// spec, so echo the specific origin instead of "*".
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
			case allowAllOrigins:
				w.Header().Set("Access-Control-Allow-Origin", "*")
			case isAllowed:
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
			default:
				// Origin not allowed: fall through without CORS headers so
				// the browser blocks the response.
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			if cfg.AllowCredentials {
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			if exposedHeaders != "" {
				w.Header().Set("Access-Control-Expose-Headers", exposedHeaders)
			}

			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
				w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
				w.Header().Set("Access-Control-Max-Age", maxAge)
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
