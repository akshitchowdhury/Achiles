# Go API. Built by the root docker-compose.yml.
FROM golang:1.26-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# -p 1 builds one package at a time. Slower, but the AWS SDK and gRPC compile
# in parallel will push a 1 GB VM into the OOM killer even with swap.
RUN CGO_ENABLED=0 GOOS=linux go build -p 1 -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22
# ca-certificates for Google OAuth and S3 over TLS.
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -s /sbin/nologin api

WORKDIR /app
COPY --from=build /out/api ./api
# s3.SetUp reads the plan art from assets/ relative to the working directory.
COPY assets/ ./assets/

USER api
EXPOSE 8080
ENTRYPOINT ["./api"]
