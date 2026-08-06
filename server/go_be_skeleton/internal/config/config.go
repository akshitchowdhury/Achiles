// Package config loads application configuration from environment variables
// (optionally backed by a .env file) into strongly typed structs.
package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"time"

	"github.com/joho/godotenv"
	ratelimiterservice "github.com/yourusername/goBackendSkeleton/internal/RateLimiterService"
)

// Config is the root application configuration.
type Config struct {
	Env     string
	HTTP    HTTPConfig
	DB      DBConfig
	CORS    CORSConfig
	AI      AIConfig
	AUTH    AuthConfig
	RATELIM *ratelimiterservice.TokenBucket
}

// AuthConfig holds the Google OAuth client credentials plus everything the
// session cookie minted after a successful callback needs.
type AuthConfig struct {
	ClientID     string
	ClientSecret string
	// RedirectURI must match a redirect URI registered on the Google client
	// exactly — the browser is sent straight to the Go server, not through
	// the Vite proxy, so it carries the full /api/... path.
	RedirectURI string
	// FrontendURL is where the callback sends the browser once the code has
	// been exchanged. No trailing slash.
	FrontendURL   string
	SessionSecret string
	SessionTTL    time.Duration
	CookieSecure  bool
}

// Configured reports whether Google sign-in can be attempted at all.
func (c AuthConfig) Configured() bool {
	return c.ClientID != "" && c.ClientSecret != "" && c.RedirectURI != ""
}

// HTTPConfig controls the HTTP server.
type HTTPConfig struct {
	Port            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// DBConfig controls the Postgres connection pool.
type DBConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	SSLMode         string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
}

// ConnString builds a libpq-style connection string for pgx.
func (c DBConfig) ConnString() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode,
	)
}

// CORSConfig controls the CORS middleware.
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int // seconds
}

type AIConfig struct {
	API_KEY string
}

// type TokenBucket struct {
// 	capacity   int        // Maximum number of tokens the bucket can hold
// 	rate       int        // Number of tokens to add per second
// 	tokens     int        // Current number of tokens in the bucket
// 	lastRefill time.Time  // Timestamp of the last token refill
// 	mutex      sync.Mutex // Mutex to protect concurrent access
// }

// Load reads a .env file if present (ignored silently if missing — real
// deployments provide env vars directly) and builds a Config from the
// environment, falling back to sensible defaults.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Env: getEnv("APP_ENV", "development"),
		HTTP: HTTPConfig{
			Port:            getEnv("HTTP_PORT", "8080"),
			ReadTimeout:     getEnvDuration("HTTP_READ_TIMEOUT", 5*time.Second),
			WriteTimeout:    getEnvDuration("HTTP_WRITE_TIMEOUT", 10*time.Second),
			IdleTimeout:     getEnvDuration("HTTP_IDLE_TIMEOUT", 60*time.Second),
			ShutdownTimeout: getEnvDuration("HTTP_SHUTDOWN_TIMEOUT", 10*time.Second),
		},
		DB: DBConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", ""),
			Name:            getEnv("DB_NAME", "postgres"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			MaxConns:        int32(getEnvInt("DB_MAX_CONNS", 10)),
			MinConns:        int32(getEnvInt("DB_MIN_CONNS", 2)),
			MaxConnLifetime: getEnvDuration("DB_MAX_CONN_LIFETIME", time.Hour),
			MaxConnIdleTime: getEnvDuration("DB_MAX_CONN_IDLE_TIME", 30*time.Minute),
		},
		CORS: CORSConfig{
			AllowedOrigins:   getEnvSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
			AllowedMethods:   getEnvSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}),
			AllowedHeaders:   getEnvSlice("CORS_ALLOWED_HEADERS", []string{"Content-Type", "Authorization"}),
			ExposedHeaders:   getEnvSlice("CORS_EXPOSED_HEADERS", []string{}),
			AllowCredentials: getEnvBool("CORS_ALLOW_CREDENTIALS", false),
			MaxAge:           getEnvInt("CORS_MAX_AGE", 300),
		},

		AI: AIConfig{
			API_KEY: getEnv("GROQ_KEY", "")},

		AUTH: AuthConfig{
			ClientID:      getEnv("CLIENTID", ""),
			ClientSecret:  getEnv("CLIENTSECRET", ""),
			RedirectURI:   getEnv("REDIRECTURI", "http://localhost:8080/api/auth/oauth/google/callback"),
			FrontendURL:   strings.TrimRight(getEnv("FRONTEND_URL", "http://localhost:5173"), "/"),
			SessionSecret: getEnv("SESSION_SECRET", ""),
			SessionTTL:    getEnvDuration("SESSION_TTL", 24*time.Hour),
			CookieSecure:  getEnvBool("SESSION_COOKIE_SECURE", false)},

		RATELIM: ratelimiterservice.NewTokenBucket(7, 1),
	}

	if cfg.AUTH.SessionSecret == "" {
		// Outside development an unset secret is a deployment mistake; in dev
		// an ephemeral one is fine — it only means sessions die on restart.
		if cfg.Env != "development" {
			return nil, fmt.Errorf("config: SESSION_SECRET must be set when APP_ENV=%s", cfg.Env)
		}
		secret, err := randomSecret()
		if err != nil {
			return nil, err
		}
		cfg.AUTH.SessionSecret = secret
		slog.Warn("config: SESSION_SECRET is unset, generated an ephemeral one — sessions will not survive a restart")
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.DB.Name == "" {
		return fmt.Errorf("config: DB_NAME must not be empty")
	}
	if c.CORS.AllowCredentials {
		for _, o := range c.CORS.AllowedOrigins {
			if o == "*" {
				return fmt.Errorf("config: CORS_ALLOW_CREDENTIALS cannot be used with a wildcard origin")
			}
		}
	}
	return nil
}

// randomSecret produces a 32-byte hex key used to HMAC-sign the session
// cookie. It is not a credential store — it only stops a browser from
// forging the identity the Google callback wrote into that cookie.
func randomSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("config: generate session secret: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

// getEnvSlice parses a comma-separated env var into a trimmed string slice.
func getEnvSlice(key string, fallback []string) []string {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}
