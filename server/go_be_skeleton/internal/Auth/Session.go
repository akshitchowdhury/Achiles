package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/yourusername/goBackendSkeleton/internal/config"
)

const (
	// SessionCookie carries the signed identity minted by the Google callback.
	SessionCookie = "achiles_session"
	// stateCookie carries the one-shot CSRF nonce for a login round-trip.
	stateCookie = "achiles_oauth_state"
	// returnCookie remembers where in the UI to land after the callback.
	returnCookie = "achiles_oauth_return"
)

var errBadSession = errors.New("auth: session cookie is missing or invalid")

// Session is what the callback writes into the cookie: who Google says this
// is, plus the Achiles athlete row they've been linked to (0 until they
// finish onboarding).
type Session struct {
	Provider string `json:"provider"`
	Subject  string `json:"sub"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture,omitempty"`
	UserID   int    `json:"user_id,omitempty"`
	Expires  int64  `json:"exp"`
}

// Expired reports whether the session has aged out.
func (s Session) Expired() bool { return time.Now().Unix() > s.Expires }

// encodeSession renders a session as `<base64url payload>.<base64url hmac>`.
// The payload is readable by anyone holding the cookie — it carries no secret,
// only the profile Google already handed the browser — but the signature stops
// it being edited.
func encodeSession(s Session, secret string) string {
	payload, _ := json.Marshal(s)
	body := base64.RawURLEncoding.EncodeToString(payload)
	return body + "." + sign(body, secret)
}

// decodeSession verifies the signature and expiry before returning the claims.
func decodeSession(raw, secret string) (Session, error) {
	body, sig, found := strings.Cut(raw, ".")
	if !found {
		return Session{}, errBadSession
	}
	if !hmac.Equal([]byte(sig), []byte(sign(body, secret))) {
		return Session{}, errBadSession
	}

	payload, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return Session{}, errBadSession
	}

	var s Session
	if err := json.Unmarshal(payload, &s); err != nil {
		return Session{}, errBadSession
	}
	if s.Expired() {
		return Session{}, errBadSession
	}
	return s, nil
}

func sign(body, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// SessionFrom reads and verifies the session cookie on a request.
func SessionFrom(r *http.Request, c config.AuthConfig) (Session, error) {
	cookie, err := r.Cookie(SessionCookie)
	if err != nil {
		return Session{}, errBadSession
	}
	return decodeSession(cookie.Value, c.SessionSecret)
}

// writeSession stamps a fresh expiry on the session and sets the cookie.
//
// SameSite=Lax is deliberate: the browser arrives at the callback via a
// top-level redirect from accounts.google.com, and Lax is the strictest mode
// that still sends cookies on that navigation.
func writeSession(w http.ResponseWriter, c config.AuthConfig, s Session) {
	s.Expires = time.Now().Add(c.SessionTTL).Unix()
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    encodeSession(s, c.SessionSecret),
		Path:     "/",
		MaxAge:   int(c.SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   c.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// writeShortCookie sets a 10-minute cookie used only across one login
// round-trip (the CSRF nonce and the post-login return path).
func writeShortCookie(w http.ResponseWriter, c config.AuthConfig, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   c.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// clearCookie expires a cookie in the browser.
func clearCookie(w http.ResponseWriter, c config.AuthConfig, name string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   c.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// randomToken returns a URL-safe random string for the CSRF state nonce.
func randomToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}