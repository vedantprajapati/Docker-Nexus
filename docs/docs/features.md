---
sidebar_position: 0
---

# Features

Docker Nexus is a **Docker Compose manager** designed for simple home server setups and personal app hosting. It provides a visual interface to manage, monitor, and organize your containers.

## Purpose

| Goal | Description |
|------|-------------|
| **Simplify Management** | Control Docker Compose stacks without memorizing CLI commands. |
| **Visual Organization** | See your entire infrastructure at a glance with an interactive graph. |
| **AI-Powered Edits** | Modify Compose files using natural language prompts. |
| **Home Server Ready** | Lightweight, single-binary backend that runs anywhere Docker runs. |

## Key Features

| Feature | Description |
|---------|-------------|
| **Project Dashboard** | View all your Docker Compose projects in one place. See status, last deployed time, and quick actions. |
| **Graph Visualization** | Interactive node-based view of services. Drag to arrange, see dependencies as edges. |
| **Groups** | Organize related projects by dragging one onto another. Uses Docker Compose's `include` field to create parent-child hierarchies. |
| **Live Compose Editor** | Edit `docker-compose.yml` directly in the browser with syntax highlighting. |
| **One-Click Deploy** | Deploy or stop entire projects with a single button click. |
| **Hybrid Deployment** | Run projects from their original location on your drive or let Nexus manage them in `data/deployments`. |
| **Custom Theming** | Personalize your dashboard with presets (Nier, Dark Machine) or custom color hex codes. |
| **Real-Time Logs** | Stream container logs via SSE or open an interactive WebSocket terminal. |
| **AI Assistant** | Ask the LLM to "add a healthcheck" or "expose port 443" and it modifies your YAML. |
| **MCP Integration** | Connect AI agents (Claude, Gemini) to control Docker Nexus programmatically. |

## Supported AI Providers

| Provider | Status | Notes |
|----------|--------|-------|
| OpenAI | ✅ Supported | GPT-4 / GPT-4o |
| Ollama | ✅ Supported | Local LLM (default) |
| Anthropic | ✅ Supported | Claude models |
| Gemini | ✅ Supported | Google AI |

## Coming Soon

| Feature | Description |
|---------|-------------|
| **Auto-Scan** | Automatically discover existing Docker Compose projects on your system and import them. |
| **Monitoring Dashboard** | Track container health over time with charts and alerts. |
| **Export/Import** | Bundle your entire stack into a portable archive. |
