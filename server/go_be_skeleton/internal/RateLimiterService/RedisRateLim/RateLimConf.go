package redisratelim

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type TokenBucketConfig struct {
	Capacity       int
	RefillRate     float64
	RefillInterval time.Duration
	Client         *redis.Client
}

type TokenBucket struct {
	client         *redis.Client
	capacity       int
	refillRate     float64
	refillInterval float64 // in seconds
	// scriptSHA      string
	// scriptLoaded   bool
}

var tokenBucketLua = redis.NewScript(tokenBucketScript)

func NewTokenBucket(cfg TokenBucketConfig) *TokenBucket {
	// for a new token bucket fill it to max capacity
	if cfg.Capacity <= 0 {
		cfg.Capacity = 10
	}
	if cfg.RefillRate <= 0 {
		cfg.RefillRate = 1.0
	}
	if cfg.RefillInterval <= 0 {
		cfg.RefillInterval = time.Second
	}

	// h := sha1.New()
	// h.Write([]byte(tokenBucketScript))
	// sha := fmt.Sprintf("%x", h.Sum(nil))

	return &TokenBucket{
		client:         cfg.Client,
		capacity:       cfg.Capacity,
		refillRate:     cfg.RefillRate,
		refillInterval: cfg.RefillInterval.Seconds(),
		// scriptSHA:      sha,
	}
}

// func (tb *TokenBucket) ensureScriptLoaded(ctx context.Context) {
// 	if !tb.scriptLoaded {
// 		sha, err := tb.client.ScriptLoad(ctx, tokenBucketScript).Result()
// 		if err == nil {
// 			tb.scriptSHA = sha
// 			tb.scriptLoaded = true
// 		}
// 	}
// }

// Capacity is the burst one key may spend before the refill rate governs.
func (tb *TokenBucket) Capacity() int { return tb.capacity }

// RetryAfter is how long until a bucket earns its next token — the value for
// the Retry-After header on a 429.
func (tb *TokenBucket) RetryAfter() time.Duration {
	return time.Duration(tb.refillInterval * float64(time.Second))
}

func (tb *TokenBucket) Allow(ctx context.Context, key string) (bool, float64, error) {
	now := float64(time.Now().UnixMicro()) / 1e6

	res, err := tokenBucketLua.Run(ctx, tb.client, []string{key},
		tb.capacity, tb.refillRate, tb.refillInterval, now,
	).Int64Slice()
	if err != nil {
		return false, 0, fmt.Errorf("redisratelim: %w", err)
	}
	// A short reply would panic on res[1] inside an HTTP handler otherwise.
	if len(res) < 2 {
		return false, 0, fmt.Errorf("redisratelim: script returned %d values, want 2", len(res))
	}

	return res[0] == 1, float64(res[1]), nil
}
