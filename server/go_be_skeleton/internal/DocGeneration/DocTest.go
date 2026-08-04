package docgeneration

import (
	// "log"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gomutex/godocx"
	"github.com/redis/go-redis/v9"
	"github.com/yourusername/goBackendSkeleton/internal/db/connect"
)

// type AiContent struct {
// 	Content string `json:"content"`
// }

type AiContent struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func ServeDocxHandler(w http.ResponseWriter, r *http.Request, rdb *redis.Client) {

	if r.Method != http.MethodGet {
		http.Error(w, "Wrong api call", http.StatusBadRequest)
		return
	}
	document, err := godocx.NewDocument()
	if err != nil {
		http.Error(w, "Failed to create document", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	raw, err := (connect.GetCache(rdb, ctx))

	if err != nil {
		http.Error(w, "Failed to fethc cache", http.StatusInternalServerError)
		return
	}

	var grResponse AiContent

	if err := json.Unmarshal([]byte(raw), &grResponse); err != nil {
		http.Error(w, "Cached payload not valid json", http.StatusInternalServerError)
		return
	}

	if len(grResponse.Choices) == 0 || grResponse.Choices[0].Message.Content == "" {
		http.Error(w, "Cached response has no assistant content", http.StatusInternalServerError)
		return
	}
	if err := ConvertMarkdownToDocx(grResponse.Choices[0].Message.Content, document); err != nil {
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

	// 3. Set standard HTTP download headers
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="Achiles.docx"`)

	// 4. Serve the temp file back over HTTP
	http.ServeFile(w, r, tempFile.Name())

	json.NewEncoder(w).Encode(map[string]any{
		"Status":            "fetched succesfully!",
		"Cached resp":       raw,
		"formatted content": grResponse.Choices[0].Message.Content,
	})

}
