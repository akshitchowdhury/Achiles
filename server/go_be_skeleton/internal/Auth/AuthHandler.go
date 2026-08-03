// Package auth implements Google OAuth 2.0 sign-in: it sends the browser to
// Google's consent screen, exchanges the returned code for tokens, and turns
// the resulting profile into a signed session cookie the React client reads
// back over GET /auth/me.
package auth

import (
	"context"
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/goBackendSkeleton/internal/config"
)

const (
	providerGoogle = "google"

	googleAuthURL     = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL    = "https://oauth2.googleapis.com/token"
	googleUserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
)

var httpClient = &http.Client{Timeout: 15 * time.Second}

// HandleAuth starts the flow: it mints a CSRF nonce, remembers where to land
// afterwards, and redirects to Google's consent screen.
//
// GET /login[?return=/some/ui/path]
func HandleAuth(w http.ResponseWriter, r *http.Request, c config.AuthConfig) {
	if r.Method != http.MethodGet {
		http.Error(w, "Wrong api call", http.StatusMethodNotAllowed)
		return
	}
	if !c.Configured() {
		http.Error(w, "Google sign-in is not configured on this server", http.StatusServiceUnavailable)
		return
	}

	state, err := randomToken()
	if err != nil {
		http.Error(w, "Failed to start sign-in", http.StatusInternalServerError)
		return
	}
	writeShortCookie(w, c, stateCookie, state)
	writeShortCookie(w, c, returnCookie, safeReturnPath(r.URL.Query().Get("return")))

	params := url.Values{}
	params.Add("client_id", c.ClientID)
	params.Add("redirect_uri", c.RedirectURI)
	params.Add("response_type", "code")
	params.Add("scope", "openid profile email")
	params.Add("state", state)
	// Consent every time so a re-login always yields a refresh_token; drop
	// both of these if you start persisting refresh tokens.
	params.Add("access_type", "offline")
	params.Add("prompt", "consent")

	http.Redirect(w, r, fmt.Sprintf("%s?%s", googleAuthURL, params.Encode()), http.StatusFound)
}

// HandleCallback finishes the flow: verify state, swap the code for tokens,
// read the profile, upsert the identity, and hand the browser back to the UI
// carrying a session cookie.
//
// GET /api/auth/oauth/google/callback — the path Google is configured to
// redirect to, so it keeps the /api prefix even though the Vite proxy strips
// that from XHR calls. The browser reaches this one directly.
func HandleCallback(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AuthConfig) {
	// Everything below lands the user back in the UI rather than on a bare
	// Go error page — the browser is mid-navigation, not mid-XHR.
	returnPath := safeReturnPath(cookieValue(r, returnCookie))
	clearCookie(w, c, returnCookie)

	if errParam := r.URL.Query().Get("error"); errParam != "" {
		// User hit "cancel" on the consent screen, most commonly.
		failCallback(w, r, c, returnPath, errParam)
		return
	}

	state := r.URL.Query().Get("state")
	expected := cookieValue(r, stateCookie)
	clearCookie(w, c, stateCookie)
	if state == "" || expected == "" || !hmac.Equal([]byte(state), []byte(expected)) {
		failCallback(w, r, c, returnPath, "Sign-in state did not match. Please try again.")
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		failCallback(w, r, c, returnPath, "Code not found in request")
		return
	}

	token, err := exchangeCode(r.Context(), code, c)
	if err != nil {
		slog.Error("auth: token exchange failed", "error", err)
		failCallback(w, r, c, returnPath, "Failed to exchange code for token")
		return
	}

	profile, err := fetchProfile(r.Context(), token)
	if err != nil {
		slog.Error("auth: profile lookup failed", "error", err)
		failCallback(w, r, c, returnPath, "Failed to read your Google profile")
		return
	}

	identity := Identity{
		Provider: providerGoogle,
		Subject:  profile.Sub,
		Email:    profile.Email,
		Name:     profile.Name,
		Picture:  profile.Picture,
	}
	userID, err := UpsertIdentity(r.Context(), db, identity)
	if err != nil {
		slog.Error("auth: could not store identity", "error", err)
		failCallback(w, r, c, returnPath, "Could not save your sign-in")
		return
	}

	writeSession(w, c, Session{
		Provider: providerGoogle,
		Subject:  profile.Sub,
		Email:    profile.Email,
		Name:     profile.Name,
		Picture:  profile.Picture,
		UserID:   userID,
	})

	http.Redirect(w, r, c.FrontendURL+returnPath, http.StatusFound)
}

// HandleMe reports who is signed in. The client calls this once on landing
// and treats a 200 with authenticated=false as "show the sign-in screen".
//
// GET /auth/me
func HandleMe(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AuthConfig) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session, err := SessionFrom(r, c)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
		return
	}

	// The cookie's copy of user_id goes stale the moment the athlete row is
	// linked from another tab, so the table wins.
	userID, err := LookupUserID(r.Context(), db, session.Provider, session.Subject)
	if err != nil {
		slog.Error("auth: could not read identity", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	body := map[string]any{
		"authenticated": true,
		"provider":      session.Provider,
		"email":         session.Email,
		"name":          session.Name,
		"picture":       session.Picture,
		"user_id":       nil,
	}
	if userID != 0 {
		body["user_id"] = userID
	}
	writeJSON(w, http.StatusOK, body)
}

// HandleLink attaches a freshly created athlete row to the signed-in Google
// account, so the next sign-in resumes it instead of re-onboarding.
//
// POST /auth/link {"user_id": 7}
func HandleLink(db *pgxpool.Pool, w http.ResponseWriter, r *http.Request, c config.AuthConfig) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session, err := SessionFrom(r, c)
	if err != nil {
		http.Error(w, "Not signed in", http.StatusUnauthorized)
		return
	}

	var body struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID <= 0 {
		http.Error(w, "Invalid user id", http.StatusBadRequest)
		return
	}

	exists, err := UserExists(r.Context(), db, body.UserID)
	if err != nil {
		slog.Error("auth: could not verify user", "error", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	if !exists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := LinkUser(r.Context(), db, session.Provider, session.Subject, body.UserID); err != nil {
		slog.Error("auth: could not link user", "error", err)
		http.Error(w, "Could not link your profile", http.StatusInternalServerError)
		return
	}

	session.UserID = body.UserID
	writeSession(w, c, session)
	writeJSON(w, http.StatusOK, map[string]any{"linked": true, "user_id": body.UserID})
}

// HandleLogout drops the session cookie. The Google grant itself is left
// alone — signing out here does not revoke the app's access at Google.
//
// POST /auth/logout
func HandleLogout(w http.ResponseWriter, r *http.Request, c config.AuthConfig) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	clearCookie(w, c, SessionCookie)
	writeJSON(w, http.StatusOK, map[string]any{"signedOut": true})
}

// tokenResponse is the subset of Google's token payload we use.
type tokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

// profile is the identity we care about, from either the id_token claims or
// the userinfo endpoint — both use these field names.
type profileClaims struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func exchangeCode(ctx context.Context, code string, c config.AuthConfig) (tokenResponse, error) {
	form := url.Values{}
	form.Set("client_id", c.ClientID)
	form.Set("client_secret", c.ClientSecret)
	form.Set("code", code)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", c.RedirectURI)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return tokenResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(req)
	if err != nil {
		return tokenResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Google explains refusals (redirect_uri_mismatch, invalid_client…)
		// in the body, and that detail is what makes them fixable.
		return tokenResponse{}, fmt.Errorf("token endpoint returned %s: %s", resp.Status, readSnippet(resp))
	}

	var token tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return tokenResponse{}, fmt.Errorf("decode token response: %w", err)
	}
	if token.AccessToken == "" && token.IDToken == "" {
		return tokenResponse{}, fmt.Errorf("token response carried no tokens")
	}
	return token, nil
}

// fetchProfile prefers the id_token — it arrives with the exchange, so it
// costs no extra round-trip — and falls back to the userinfo endpoint.
func fetchProfile(ctx context.Context, token tokenResponse) (profileClaims, error) {
	if token.IDToken != "" {
		claims, err := claimsFromIDToken(token.IDToken)
		if err == nil && claims.Sub != "" {
			return claims, nil
		}
	}
	if token.AccessToken == "" {
		return profileClaims{}, fmt.Errorf("no id_token claims and no access_token to fall back on")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return profileClaims{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	resp, err := httpClient.Do(req)
	if err != nil {
		return profileClaims{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return profileClaims{}, fmt.Errorf("userinfo returned %s: %s", resp.Status, readSnippet(resp))
	}

	var claims profileClaims
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		return profileClaims{}, fmt.Errorf("decode userinfo: %w", err)
	}
	if claims.Sub == "" {
		return profileClaims{}, fmt.Errorf("userinfo carried no subject")
	}
	return claims, nil
}

// claimsFromIDToken reads the JWT payload without verifying its signature.
//
// That is safe here and only here: the token came back over TLS on our own
// direct call to Google's token endpoint, which OpenID Connect §3.1.3.7
// treats as sufficient. An id_token arriving by any other route (a client
// posting one to us, say) would have to be signature-verified against
// Google's JWKS first.
func claimsFromIDToken(idToken string) (profileClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return profileClaims{}, fmt.Errorf("id_token is not a JWT")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return profileClaims{}, fmt.Errorf("decode id_token payload: %w", err)
	}
	var claims profileClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return profileClaims{}, fmt.Errorf("parse id_token claims: %w", err)
	}
	return claims, nil
}

// failCallback returns the browser to the UI with a readable reason attached.
func failCallback(w http.ResponseWriter, r *http.Request, c config.AuthConfig, returnPath, reason string) {
	target := fmt.Sprintf("%s%s?%s", c.FrontendURL, returnPath, url.Values{"error": {reason}}.Encode())
	http.Redirect(w, r, target, http.StatusFound)
}

// safeReturnPath keeps the post-login redirect on our own origin: only a
// site-relative path is accepted, never "//evil.example" or a full URL.
func safeReturnPath(path string) string {
	if path == "" || !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") {
		return "/auth/callback"
	}
	return path
}

func cookieValue(r *http.Request, name string) string {
	cookie, err := r.Cookie(name)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// readSnippet pulls a bounded slice of an error body for logging.
func readSnippet(resp *http.Response) string {
	buf := make([]byte, 512)
	n, _ := resp.Body.Read(buf)
	return strings.TrimSpace(string(buf[:n]))
}