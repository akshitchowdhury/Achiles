# Python RAG service (gRPC on 50051). Built by the root docker-compose.yml.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Only what the service runs — not the venv, .env, or the unused textservice
# stubs.
COPY server.py main.py aidata_pb2.py aidata_pb2_grpc.py ./
COPY trainingDoc/ ./trainingDoc/

RUN useradd --system --no-create-home rag
USER rag

EXPOSE 50051
CMD ["python", "server.py"]
