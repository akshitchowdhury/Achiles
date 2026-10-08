package ai

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	redisratelim "github.com/yourusername/goBackendSkeleton/internal/RateLimiterService/RedisRateLim"
)

// AchilesLimits meters /askAchiles, which spends real OpenAI money on every
// call. Two buckets, both of which must have a token:
//
//   - PerAthlete is keyed by the athlete id, not by IP. Behind the Vercel
//     rewrite every request arrives from Vercel's edge, so an IP key would put
//     all guests in one bucket.
//   - Global is one shared bucket for the whole server — the cost ceiling,
//     whatever the per-athlete keys add up to.
type AchilesLimits struct {
	PerAthlete *redisratelim.TokenBucket
	Global     *redisratelim.TokenBucket
}

// allow spends one token from each bucket and writes the 429/503 itself when
// the request may not proceed.
//
// It fails CLOSED. /rateTest fails open on a Redis outage because downtime is
// the worse outcome there; here unmetered access is the worse outcome, so a
// dead Redis turns the coach off rather than leaving the bill uncapped.
func (l AchilesLimits) allow(w http.ResponseWriter, r *http.Request, athleteID int) bool {
	checks := []struct {
		bucket *redisratelim.TokenBucket
		key    string
		reason string
	}{
		{l.PerAthlete, fmt.Sprintf("ratelimit:askAchiles:athlete:%d", athleteID),
			"You've asked the coach a lot recently. Try again in a little while."},
		{l.Global, "ratelimit:askAchiles:global",
			"The coach is busy right now. Try again in a minute."},
	}

	for _, c := range checks {
		allowed, _, err := c.bucket.Allow(r.Context(), c.key)
		if err != nil {
			slog.Error("achiles: rate limiter unavailable, refusing request", "error", err)
			http.Error(w, "The coach is temporarily unavailable. Try again shortly.", http.StatusServiceUnavailable)
			return false
		}
		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(int(c.bucket.RetryAfter().Seconds())))
			http.Error(w, c.reason, http.StatusTooManyRequests)
			return false
		}
	}
	return true
}
