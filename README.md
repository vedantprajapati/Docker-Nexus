# Docker Nexus ⚓

<p align="center">
  <strong>The definitive visual Docker Compose manager & AI infrastructure co-pilot for your home lab.</strong><br>
  <em>Visualize service topologies, organize stacks with native Compose includes, and edit configurations using natural language.</em>
</p>

<p align="center">
  <a href="https://github.com/vedantprajapati/Docker-Nexus/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  <a href="https://go.dev/"><img src="https://img.shields.io/badge/Go-1.21%2B-00ADD8.svg?style=flat-square&logo=go" alt="Go Version"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black.svg?style=flat-square&logo=next.js" alt="Next.js"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Compose%20v2-2496ED.svg?style=flat-square&logo=docker" alt="Docker"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-Compatible-8A2BE2.svg?style=flat-square" alt="MCP Compatible"></a>
  <a href="https://vedantprajapati.github.io/Docker-Nexus/"><img src="https://img.shields.io/badge/Docs-GitHub%20Pages-informational.svg?style=flat-square" alt="Documentation"></a>
</p>

---

![Docker Nexus Hero](docs/static/img/project-list.png)

---

## 🧭 About Docker Nexus

### What is Docker Nexus?
**Docker Nexus** is a lightweight, self-hosted web control plane and visual orchestration platform designed specifically for home servers and self-hosting enthusiasts. 

Instead of juggling fragmented YAML files across directories or memorizing lengthy terminal commands, Docker Nexus renders your entire infrastructure as an **interactive, graph-based canvas**. It combines visual stack management, live code editing, and a multi-provider AI co-pilot into a single unified dashboard—all without the resource footprint or complexity of enterprise orchestrators like Kubernetes or Nomad.

### The Problem It Solves
Running a home server often turns into operational friction:
* **Terminal Fatigue**: Running `docker compose ps`, `docker compose logs -f`, and `docker compose up -d` across dozens of separate directories.
* **Invisible Topology**: Difficulty tracking which services communicate with each other, what ports are exposed, and how volumes are mounted.
* **YAML Indentation Fragility**: Small syntax or indentation slips silently breaking container rollouts.
* **Orchestrator Overkill**: Tools like Kubernetes, Nomad, or heavyweight enterprise suites demand steep configuration overhead and significant CPU/RAM overhead that small home labs cannot afford.

### The Docker Nexus Solution
Docker Nexus bridges the gap between raw CLI and bulky enterprise managers:
* **Visual-First Canvas**: Every container, network link, and dependency is mapped visually with drag-and-drop hierarchy support.
* **Native Docker Compose `include`**: Organize projects into logical groups (e.g. Media Stack, Monitoring Stack, Web Services) using standard Docker Compose `include` directives—no proprietary abstractions.
* **AI-Assisted Operations**: Chat directly with your infrastructure. Ask your assistant to expose a port, attach persistent storage, or configure health checks.
* **Model Context Protocol (MCP) Server**: Exposes standard JSON-RPC tools and resources so AI agents (like Claude Desktop, Cursor, and Gemini CLI) can query and control your stacks safely.

---

## ⚡ Comparison: Why Docker Nexus?

| Feature | Docker CLI | Portainer | Docker Nexus |
| :--- | :---: | :---: | :---: |
| **Interactive Graph Topology** | ❌ | ❌ | ✅ **Native visual node graph** |
| **Compose `include` Grouping** | Manual | Partial | ✅ **Drag-and-drop hierarchy** |
| **AI Co-pilot (OpenAI/Anthropic/Gemini/Ollama)** | ❌ | ❌ | ✅ **Built-in multi-model assistant** |
| **Model Context Protocol (MCP)** | ❌ | ❌ | ✅ **First-class stdio MCP server** |
| **Live In-Browser YAML Editing** | ❌ | Basic textarea | ✅ **Monaco editor + syntax linting** |
| **Resource Overhead** | None | Moderate | ⚡ **Ultra-lightweight (Single Go binary + Next.js)** |

---

## ✨ Key Features

### 🕸️ Interactive Topology Graph
* Powered by [ReactFlow](https://reactflow.dev/) with a clean, high-contrast NieR-inspired interface.
* See your infrastructure rendered as a reactive network of microservices.
* Inspect container health, mapped ports, volumes, images, and restart policies by selecting any node.

### 📦 Native Stacks & Groups via `include`
* Drag projects onto one another to assemble nested parent-child hierarchies.
* Leverages Docker Compose's native `include:` specification—your YAML remains 100% portable and standard.
* Deploy, stop, or restart an entire stack or individual service with one click.

### 🤖 Multi-Provider AI Infrastructure Assistant
* Supported Providers: **Ollama** (local & private), **Google Gemini**, **Anthropic Claude**, and **OpenAI GPT-4o**.
* Natural-language edits: *"Add a Redis cache with persistent volume"*, *"Attach a healthcheck to the Postgres container"*, or *"Expose port 443 with SSL cert mounts"*.
* Automated service classification: Detects whether containers belong to Frontend, Backend, Database, Cache, or Queue tiers.

### 🔌 Model Context Protocol (MCP) Server
* Run Docker Nexus in headless MCP mode (`MCP_MODE=true`) via stdio JSON-RPC.
* Lets external AI agents inspect running containers, view real-time logs, modify compose files, and execute deployments programmatically.

### 📊 Real-Time Telemetry & SSE Logs
* Stream container stdout/stderr live into the browser using Server-Sent Events (SSE).
* Filter logs by specific container or tail output without locking terminal sessions.

---

## 🏗️ Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │        Browser / UI Dashboard        │
                      │  (Next.js 15, Tailwind, ReactFlow)   │
                      └──────────────────┬───────────────────┘
                                         │  HTTP / REST + SSE
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          Docker Nexus API            │
                      │         (Go Fiber Backend)           │
                      └──┬───────────────┬─────────────────┬─┘
                         │               │                 │
           Local Docker  │               │ LLM Providers   │ AI Agents (Stdio)
                 Socket  ▼               ▼                 ▼
          ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │  Docker Daemon  │  │ Ollama / OpenAI  │  │  MCP Protocol    │
          │  /var/run/      │  │ Gemini/Anthropic │  │  (Claude, Cursor)│
          │  docker.sock    │  └──────────────────┘  └──────────────────┘
          └─────────────────┘
```

---

## 🚀 Quick Start

### 1. Run with Docker Compose (Recommended)

Clone the repository and launch the pre-configured compose stack:

```bash
# Clone the repository
git clone git@github.com:vedantprajapati/Docker-Nexus.git
cd Docker-Nexus

# Create your local environment file
cp .env.example .env

# Start Docker Nexus
docker compose up -d
```

Open your browser to:
* **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
* **API Documentation (Swagger)**: [http://localhost:8080/swagger/index.html](http://localhost:8080/swagger/index.html)

---

### 2. Bare-Metal / Local Development

#### Prerequisites
* [Go](https://go.dev/) 1.21 or newer
* [Node.js](https://nodejs.org/) 18+ and `npm`
* [Docker](https://docs.docker.com/get-docker/) with Compose v2 CLI

#### Backend Setup
```bash
cd backend
cp .env.example .env
go run main.go
# Server listens on http://localhost:8080
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Dashboard available on http://localhost:3000
```

---

## 🤖 Model Context Protocol (MCP) Setup

You can connect Docker Nexus directly to AI tools such as **Claude Desktop**, **Cursor**, or **Gemini CLI** to grant your AI agent direct control over your Docker environment.

### Claude Desktop Configuration

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docker-nexus": {
      "command": "/path/to/backend/server",
      "env": {
        "MCP_MODE": "true",
        "DEPLOY_DIR": "/path/to/deployments",
        "STORE_FILE": "/path/to/store.json"
      }
    }
  }
}
```

### Available MCP Tools
* `list_projects`: Lists all managed Docker Compose projects.
* `get_project`: Fetches raw compose YAML and metadata for a specific project.
* `save_project`: Creates or updates a project's compose configuration.
* `deploy_project`: Triggers `docker compose up -d` for a target stack.
* `stop_project`: Triggers `docker compose down` for a target stack.
* `get_logs`: Reads logs from project containers.
* `list_containers`: Returns real-time host container telemetry.

---

## ⚙️ Configuration Reference

Configure Docker Nexus via `.env` or container environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Backend HTTP API listen port | `8080` |
| `STORE_FILE` | Path to persistent JSON database file | `./store.json` |
| `DEPLOY_DIR` | Directory where active Compose stacks materialize | `./deployments` |
| `MCP_MODE` | Set `true` to run as an MCP stdio server | `false` |
| `LLM_PROVIDER` | Active AI provider: `ollama`, `gemini`, `anthropic`, `openai` | `ollama` |
| `OLLAMA_URL` | Endpoint for Ollama server | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `llama3.2` |
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `GEMINI_MODEL` | Google Gemini model name | `gemini-1.5-flash` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | - |
| `ANTHROPIC_MODEL` | Anthropic model name | `claude-3-5-sonnet-20241022` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o` |

---

## 📂 Repository Structure

```
Docker-Nexus/
├── backend/                  # Go Fiber backend service
│   ├── handlers/             # HTTP & SSE request handlers
│   ├── services/             # Docker engine, LLM client, project store
│   ├── mcp/                  # Model Context Protocol stdio server
│   ├── Dockerfile            # Multi-stage Go production container
│   └── main.go               # Application entry point
├── frontend/                 # Next.js 15 App Router web client
│   ├── app/                  # Pages, layout, and global styling
│   ├── components/           # Graph canvas, Monaco editor, sidebar, modals
│   ├── lib/                  # Zustand store and TypeScript definitions
│   └── Dockerfile            # Standalone Next.js production container
├── docs/                     # Docusaurus documentation website
├── docker-compose.yml        # Production-ready full-stack orchestration
└── .env.example              # Template environment configuration
```

---

## 📚 Documentation

Detailed documentation and guides are available at:
* **[Online Documentation](https://vedantprajapati.github.io/Docker-Nexus/)**
* **[Deployment Guide](https://vedantprajapati.github.io/Docker-Nexus/docs/deployment)**
* **[MCP Server Specification](https://vedantprajapati.github.io/Docker-Nexus/docs/mcp-server)**
* **[UI & Workflow Walkthrough](https://vedantprajapati.github.io/Docker-Nexus/docs/ui-walkthrough)**

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m "Add amazing feature"`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

© [Vedant Prajapati](https://github.com/vedantprajapati)
