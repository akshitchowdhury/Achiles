package ratelimiterservice

import (
	"fmt"
	"sync"
	"time"
)

type TokenBucket struct {
	capacity   int        // Maximum number of tokens the bucket can hold
	rate       int        // Number of tokens to add per second
	tokens     int        // Current number of tokens in the bucket
	lastRefill time.Time  // Timestamp of the last token refill
	mutex      sync.Mutex // Mutex to protect concurrent access
}

func NewTokenBucket(capacity, rate int) *TokenBucket {
	return &TokenBucket{
		capacity:   capacity,
		rate:       rate,
		tokens:     capacity, // Start with a full bucket
		lastRefill: time.Now(),
	}
}

func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := time.Since(tb.lastRefill)
	// elapsed := now.Sub(tb.lastRefill)

	// Calculate how many tokens should be added

	tokensToAdd := int(elapsed.Seconds() * float64(tb.rate))

	if tokensToAdd > 0 {
		tb.lastRefill = now
		// Add tokens, but don't exceed the bucket's capacity
		tb.tokens = min(tb.tokens+tokensToAdd, tb.capacity)
	}
}

// min is a helper function to find the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Take attempts to take a specified number of tokens from the bucket
// Returns true if successful, false otherwise
func (tb *TokenBucket) Take(tokens int) bool {
	tb.mutex.Lock()
	defer tb.mutex.Unlock()

	// First, refill the bucket with tokens based on elapsed time
	tb.refill()

	// Check if we have enough tokens
	if tb.tokens >= tokens {
		tb.tokens -= tokens
		return true
	}

	// Not enough tokens available
	return false
}

func (tb *TokenBucket) GetRemainingTokens() map[string]any {
	return map[string]any{
		"capacity":         tb.capacity,
		"tokens remaining": tb.tokens,
	}
}

func (tb *TokenBucket) TakeWithTimeout(tokens int, timeout time.Duration) bool {
	// Calculate the earliest time we can stop waiting
	deadline := time.Now().Add(timeout)

	for {
		tb.mutex.Lock()

		// Refill the bucket
		tb.refill()

		// Check if we have enough tokens now
		if tb.tokens >= tokens {
			tb.tokens -= tokens
			tb.mutex.Unlock()
			return true
		}

		// Calculate how long we need to wait for more tokens
		tokensNeeded := tokens - tb.tokens
		timeNeeded := time.Duration(tokensNeeded) * time.Second / time.Duration(tb.rate)

		// If we can get the tokens before the deadline, wait and try again
		if time.Now().Add(timeNeeded).Before(deadline) {
			// Unlock before waiting to allow other operations
			tb.mutex.Unlock()

			// Wait for the required time, but no longer than the remaining timeout
			waitTime := minDuration(timeNeeded, deadline.Sub(time.Now()))
			time.Sleep(waitTime)
		} else {
			// Not enough time to get the required tokens
			tb.mutex.Unlock()
			return false
		}
	}
}

func (tb *TokenBucket) TakeWithTimeoutMod(tokensReq int, timeout time.Duration) bool {
	tb.mutex.Lock()
	defer tb.mutex.Unlock()
	tb.refill()
	if tokensReq <= tb.tokens {

		tb.tokens -= tokensReq

		return true

	}

	fmt.Println("under cooldown of 3 sec", tb.tokens)

	return false
}

// minDuration is a helper function to find the minimum of two durations
func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
