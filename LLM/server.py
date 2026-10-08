import os
from concurrent import futures

import grpc
from langchain_core.messages import convert_to_messages

import aidata_pb2
import aidata_pb2_grpc

# Imported at module load rather than inside ProcessText: importing main
# connects to Postgres and builds the vectorstore, and doing that lazily made
# the first athlete's request pay for it (and fail on a config error that
# should have stopped the server at boot instead).
from main import ensure_ingested, generate_answer, generate_query_or_respond, retriever_tool

PORT = os.getenv("RAG_PORT", "50051")

# Each request holds a thread for the whole model round trip. Two is plenty on
# a 1 GB VM — the Go side's rate limit keeps concurrency low anyway — and every
# extra worker is memory the box doesn't have.
MAX_WORKERS = int(os.getenv("RAG_MAX_WORKERS", "2"))


class TextServiceServicer(aidata_pb2_grpc.AiDatServiceServicer):
    def ProcessText(self, request, context):
        question = request.data
        # Length only — the prompt carries the athlete's body metrics.
        print(f"[Python Server] Received prompt ({len(question)} chars)", flush=True)

        try:
            decision = generate_query_or_respond(
                {"messages": [{"role": "user", "content": question}]}
            )
            ai_message = decision["messages"][-1]

            # The model may answer without retrieving. Its reply is then the
            # answer; running generate_answer would feed it an empty context.
            if not ai_message.tool_calls:
                return aidata_pb2.AiResponse(data=ai_message.content)

            tool_messages = [
                {
                    "role": "tool",
                    "content": retriever_tool.invoke(call["args"]),
                    "tool_call_id": call["id"],
                }
                for call in ai_message.tool_calls
            ]

            full_state = {
                "messages": convert_to_messages(
                    [{"role": "user", "content": question}, ai_message, *tool_messages]
                )
            }
            response = generate_answer(full_state)
            return aidata_pb2.AiResponse(data=response["messages"][-1].content)
        except Exception as exc:  # noqa: BLE001 — report any failure as a gRPC status
            print(f"[Python Server] ProcessText failed: {exc!r}", flush=True)
            # An explicit status instead of an unhandled exception, so Go
            # sees INTERNAL with a reason rather than UNKNOWN.
            context.abort(grpc.StatusCode.INTERNAL, "rag pipeline failed")


def serve():
    ensure_ingested()

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=MAX_WORKERS))
    aidata_pb2_grpc.add_AiDatServiceServicer_to_server(TextServiceServicer(), server)
    server.add_insecure_port(f"[::]:{PORT}")
    print(f"[Python Server] Running on port {PORT}...", flush=True)
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
