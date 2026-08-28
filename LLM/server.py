from concurrent import futures
import grpc
import aidata_pb2
import aidata_pb2_grpc
# from main import aiResp
# from main import question
print("server called")


class TextServiceServicer(aidata_pb2_grpc.AiDatServiceServicer):
    def ProcessText(self, request, context):
        print(f"[Python Server] Received text: '{request.data}'")
        # question = request.data
        question = request.data
        # print("Question recvd", question)
        # from main import decision
        from main import generate_query_or_respond
        from main import retriever_tool
        decision_state = {"messages": [{"role": "user", "content": question}]}
        
        decision = generate_query_or_respond(decision_state)
        ai_message = decision["messages"][-1]
        tool_messages = []
        for call in ai_message.tool_calls:
            result = retriever_tool.invoke(call["args"])
            tool_messages.append({
                "role": "tool",
                "content": result,
                "tool_call_id": call["id"],
    })

        from main import generate_answer
        from langchain_core.messages import convert_to_messages
        # from main import ai_message
        # from main import tool_messages
        full_state = {
        "messages": convert_to_messages([
        {"role": "user", "content": request.data},
        ai_message,
        *tool_messages,
    ])
}
        response = generate_answer(full_state)
        aiResp = response["messages"][-1].content
        response["messages"][-1].pretty_print()

        # Simple text logic (e.g., uppercase processing)
        # processed_result = "Cortana is an AI. Dummy data"
        processed_result = aiResp
        
        return aidata_pb2.AiResponse(data=processed_result)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
   

    aidata_pb2_grpc.add_AiDatServiceServicer_to_server(TextServiceServicer(), server)
       
    server.add_insecure_port('[::]:50051')
    print("[Python Server] Running on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()