# Quantum Crab 🦀

> Docker Compose AI Manager - Upload, visualize, deploy, and manage Docker Compose stacks with LLM-powered modifications.

## Features

- **Upload** - Import multiple docker-compose.yml files as projects
- **Visualize** - Interactive graph showing services, networks, volumes, and dependencies
- **Deploy** - Start, stop, restart stacks with one click
- **AI Modify** - Use natural language to modify your compose files

## Quick Start

```bash
# Clone and run
docker compose up -d

# Open the UI
open http://localhost:3000
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | `openai`, `ollama`, `anthropic`, or `gemini` | `ollama` |
| `OPENAI_API_KEY` | OpenAI API key (if using openai) | - |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using anthropic) | - |
| `GEMINI_API_KEY` | Google Gemini API key (if using gemini) | - |
| `OLLAMA_URL` | Ollama server URL | `http://host.docker.internal:11434` |

## Development

```bash
# Frontend (Next.js)
cd frontend && npm run dev

# Backend (Go)
cd backend && go run .
```

## License

MIT
