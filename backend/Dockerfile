FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# Runtime stage
FROM alpine:latest

RUN apk add --no-cache docker-cli docker-cli-compose ca-certificates

WORKDIR /app
COPY --from=builder /app/server .

# Create projects directory
RUN mkdir -p /app/projects

EXPOSE 8080

CMD ["./server"]
