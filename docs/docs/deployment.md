---
sidebar_position: 3
---

# Deployment

Docker Nexus simplifies the deployment of Docker Compose projects by managing the lifecycle of your containers directly from the UI or via MCP tools.

## How it Works

The application uses a `DockerService` in the backend to interact with the Docker daemon.

### Materialization
When you choose to deploy a project, Docker Nexus first **materializes** the project files to a dedicated deployment directory.
- Default path: `./deployments/{project_id}/` (configurable via `DEPLOY_DIR` env var).

### Commands
- **Deploy**: Runs `docker compose up -d` in the project directory. This starts the containers in detached mode.
- **Stop**: Runs `docker compose down` to stop and remove containers.
- **Logs**: Runs `docker compose logs` to stream or fetch logs.

## Directory Structure

```
Docker Nexus/
├── backend/
├── frontend/
├── deployments/         <-- Materialized projects live here
│   ├── project-uuid-1/
│   │   └── docker-compose.yml
│   └── project-uuid-2/
│       └── docker-compose.yml
└── ...
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEPLOY_DIR` | Directory where projects are materialized | `./deployments` |
| `LLM_PROVIDER` | AI provider for compose modifications | `ollama` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |
| `PORT` | HTTP server port | `8080` |
| `MCP_MODE` | Run in MCP mode instead of HTTP | `false` |
