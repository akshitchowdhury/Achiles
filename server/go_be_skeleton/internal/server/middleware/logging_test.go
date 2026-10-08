package middleware

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// A handler behind Logging must still be able to lift the server's
// WriteTimeout — /askAchiles depends on it to answer after more than 10s.
func TestLoggingKeepsWriteDeadlineControllable(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	handler := Logging(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(time.Second)); err != nil {
			t.Errorf("SetWriteDeadline through Logging: %v", err)
		}
		// Past the server's WriteTimeout below: only arrives if the deadline
		// was really extended.
		time.Sleep(300 * time.Millisecond)
		w.Write([]byte("ok"))
	}))

	srv := httptest.NewUnstartedServer(handler)
	srv.Config.WriteTimeout = 100 * time.Millisecond
	srv.Start()
	defer srv.Close()

	res, err := http.Get(srv.URL)
	if err != nil {
		t.Fatalf("response dropped — write deadline was not extended: %v", err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if string(body) != "ok" {
		t.Fatalf("body = %q, want %q", body, "ok")
	}
}
