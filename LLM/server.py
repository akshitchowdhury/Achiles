from concurrent import futures
import grpc
import textservice_pb2
import textservice_pb2_grpc

class TextServiceServicer(textservice_pb2_grpc.TextServiceServicer):
    def ProcessText(self, request, context):
        print(f"[Python Server] Received text: '{request.text}'")
        
        # Simple text logic (e.g., uppercase processing)
        processed_result = request.text.upper()
        
        return textservice_pb2.TextResponse(result=processed_result)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    textservice_pb2_grpc.add_TextServiceServicer_to_server(TextServiceServicer(), server)
    server.add_insecure_port('[::]:50051')
    print("[Python Server] Running on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()