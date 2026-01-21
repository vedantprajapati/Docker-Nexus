---
sidebar_position: 10
---

# News

## Blog Post: Medium Draft

*Copy this content for your Medium post.*

---

# Introducing Docker Nexus: A Visual Docker Compose Manager for Your Home Server

If you're running a home server with Docker, you know the pain. Dozens of `docker-compose.yml` files scattered across directories. `docker compose ps` in a terminal to check what's running. Editing YAML by hand hoping you don't break indentation.

**Docker Nexus** is my solution to this chaos.

## What is Docker Nexus?

Docker Nexus is an open-source tool that gives you a **visual interface** for managing Docker Compose projects. It's designed for:

- **Home server enthusiasts** running Plex, Nextcloud, Home Assistant, etc.
- **Self-hosters** who want to see their infrastructure at a glance
- **Anyone tired of jumping between terminals and text editors**

## Key Features

### 🕸️ Interactive Graph View
See all your services as nodes on a canvas. Dependencies show as edges. Drag to organize. It's like having a whiteboard for your infrastructure.

![Docker Nexus Dashboard](/img/project-list.png)
*The main dashboard showing all your Docker Compose projects*

### 📦 Groups with Docker Compose `include`
This is my favorite feature. Drag one project onto another to create a **group**. Under the hood, Docker Nexus uses the `include:` directive to create parent-child hierarchies. Deploy the parent, and all children come up together.

Perfect for organizing your "Media Stack" (Plex + Sonarr + Radarr) or "Web Stack" (Nginx + App + Database).

### 🤖 AI-Powered Compose Editing
Forget YAML syntax. Just tell Docker Nexus: *"Add a healthcheck to the nginx service"* or *"Expose port 443"*. It modifies your Compose file automatically.

![Compose Editor](/img/compose-editor.png)
*The live Compose editor with AI-powered modifications*

Supports **OpenAI**, **Anthropic**, **Gemini**, and **Ollama** (local LLM).

### 🔌 MCP Integration
Docker Nexus implements the **Model Context Protocol (MCP)**, so AI agents like Claude Desktop or Gemini CLI can control it directly. Your AI assistant can deploy containers, check logs, and modify configs—all programmatically.

### 📊 Real-Time Logs & Status
Stream container logs directly in the browser. See which containers are running, stopped, or unhealthy.

## Tech Stack

- **Frontend**: Next.js 14 + React Flow + Tailwind CSS
- **Backend**: Go (Fiber) + Single JSON file storage
- **No database required** — just a portable `store.json`

## Getting Started

```bash
git clone git@github.com:vedantprajapati/Docker-Nexus.git
cd Docker-Nexus
docker compose up -d
# Open http://localhost:3000
```

That's it. One command to run a Docker management tool... in Docker. 🐳

## What's Next?

- **Monitoring Dashboard**: Historical health tracking with charts
- **Export/Import**: Bundle stacks as portable archives
- **Alerts**: Get notified when containers go down

## Try It Out

GitHub: [github.com/vedantprajapati/Docker-Nexus](https://github.com/vedantprajapati/Docker-Nexus)

Documentation: [vedantprajapati.github.io/Docker-Nexus](https://vedantprajapati.github.io/Docker-Nexus/)

---

*Docker Nexus is MIT licensed and open for contributions. Star the repo if you find it useful!*
