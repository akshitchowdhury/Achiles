package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	pb "github.com/yourusername/goBackendSkeleton/grpc_template"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func TestRag(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		http.Error(w, "wrong api call", http.StatusBadRequest)
		return
	}

	var clientReq string
	err := json.NewDecoder(r.Body).Decode(&clientReq)
	if err != nil {
		http.Error(w, "could not fetch", http.StatusInternalServerError)
		return
	}
	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("Failed to connect: %v", err)
		http.Error(w, "Failed to connect", http.StatusServiceUnavailable)
		return
	}
	defer conn.Close()

	client := pb.NewAiDatServiceClient(conn)

	// Context timeout for the request
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*120)
	defer cancel()

	// Make the API call
	req := &pb.AiRequest{Data: clientReq}
	fmt.Printf("[Go Client] Sending: '%s'\n", req.Data)

	res, err := client.ProcessText(ctx, req)
	if err != nil {
		fmt.Printf("Error calling ProcessText: %v", err)
		http.Error(w, "Failed to Process text", http.StatusInternalServerError)
		return

	}

	fmt.Printf("[Go Client] Received result: '%v'\n", res.GetData())

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"message": "Responded succesfully",

		// "Info":        c.API_KEY,
		// "Payload":     payload,
		"Response": res,
	})

}

func RagHelper(w http.ResponseWriter, r *http.Request, clientReq string) map[string]any {
	// var clientReq string
	// err := json.NewDecoder(r.Body).Decode(&clientReq)
	// if err != nil {
	// 	http.Error(w, "could not fetch", http.StatusInternalServerError)
	// 	log.Fatalf("could not fetch, turning off")
	// }
	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Printf("Failed to connect: %v", err)
		http.Error(w, "Failed to connect", http.StatusServiceUnavailable)
		log.Printf("Failed to connect, turning off")
	}
	defer conn.Close()

	client := pb.NewAiDatServiceClient(conn)

	// Context timeout for the request
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*120)
	defer cancel()

	// Make the API call
	req := &pb.AiRequest{Data: clientReq}
	fmt.Printf("[Go Client] Sending: '%s'\n", req.Data)

	res, err := client.ProcessText(ctx, req)
	if err != nil {
		fmt.Printf("Error calling ProcessText: %v", err)
		http.Error(w, "Failed to Process text", http.StatusInternalServerError)
		log.Printf("Failed to Process text, turning off")

	}

	RagResponse := res
	return map[string]any{"message": "Responded succesfully",

		// "Info":        c.API_KEY,
		// "Payload":     payload,
		"Response": RagResponse,
	}

}
