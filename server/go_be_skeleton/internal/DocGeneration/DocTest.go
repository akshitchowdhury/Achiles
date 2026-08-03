package docgeneration

import (
	// "log"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/gomutex/godocx"
)

type AiContent struct {
	Content string `json:"content"`
}

func ServeDocxHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Create the godocx document
	document, err := godocx.NewDocument()
	if r.Method != http.MethodGet {
		http.Error(w, "Wrong api call", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, "Failed to create document", http.StatusInternalServerError)
		return
	}

	var content AiContent
	if err := json.NewDecoder(r.Body).Decode(&content.Content); err != nil {
		http.Error(w, "Failed parse in content", http.StatusInternalServerError)
		return
	}

	document.AddHeading("Comprehensive Guide from Coach", 0)

	// Add paragraphs
	p := document.AddParagraph(content.Content)

	// 2. Save document to a temporary file on disk
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

	// 3. Set standard HTTP download headers
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="demo.docx"`)

	// 4. Serve the temp file back over HTTP
	http.ServeFile(w, r, tempFile.Name())

	json.NewEncoder(w).Encode(p)

}
