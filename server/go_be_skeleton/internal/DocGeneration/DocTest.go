package docgeneration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gomutex/godocx"
)

// maxPlanBytes caps the request body. A long plan is a few KB; this only
// exists so a junk upload can't make the server buffer megabytes.
const maxPlanBytes = 256 << 10

// ServeDocxHandler answers POST /docgeneration with the plan the client is
// showing, converted to a .docx.
//
// The body is a bare JSON string — `"## Week 1\n- ..."` — which is what
// client/src/api/docs.ts sends.
//
// This used to be a GET that ignored its body and rebuilt the document from
// the Groq response cached in Redis by /askGroq. That broke twice over in
// production: browsers can't send a GET body (a Vite dev-proxy shim papered
// over it locally), and /askAchiles never writes that cache, so every download
// after the coach switch failed. Taking the text from the request removes both
// problems and the document always matches what is on screen.
func ServeDocxHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Wrong api call", http.StatusMethodNotAllowed)
		return
	}

	var content string
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPlanBytes)).Decode(&content); err != nil {
		http.Error(w, "Request body must be the plan as a JSON string", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(content) == "" {
		http.Error(w, "There is no plan to export yet", http.StatusBadRequest)
		return
	}

	document, err := godocx.NewDocument()
	if err != nil {
		http.Error(w, "Failed to create document", http.StatusInternalServerError)
		return
	}

	if err := ConvertMarkdownToDocx(content, document); err != nil {
		http.Error(w, "Failed to process document formatting", http.StatusInternalServerError)
		return
	}

	tempFile, err := os.CreateTemp("", "generated-*.docx")
	if err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
		return
	}
	defer os.Remove(tempFile.Name()) // Clean up temp file when done
	defer tempFile.Close()

	if err := document.SaveTo(tempFile.Name()); err != nil {
		fmt.Println(err)
		http.Error(w, "Failed to save document", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="Achiles.docx"`)

	// ServeFile writes the whole response. Nothing may follow it — the JSON
	// status object that used to be encoded here was appended to the end of
	// the .docx bytes.
	http.ServeFile(w, r, tempFile.Name())
}
