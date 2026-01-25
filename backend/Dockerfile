FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Runtime stage
FROM alpine:latest

RUN apk add --no-cache docker-cli docker-cli-compose ca-certificates

WORKDIR /app
COPY --from=builder /app/server .

# Create deployments directory
RUN mkdir -p /app/deployments

EXPOSE 8080

CMD ["./server"]
