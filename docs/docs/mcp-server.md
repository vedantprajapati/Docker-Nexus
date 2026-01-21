---
sidebar_position: 2
---

# MCP Server

Docker Nexus implements the **Model Context Protocol (MCP)** to expose its capabilities to AI agents and other tools. This allows for programmatic interaction with your Docker Compose projects.

## Overview

The MCP server runs as part of the backend and provides a set of **Tools** and **Resources**.

### Server Info
- **Name**: `docker-nexus-mcp`
- **Version**: `1.0.0`
- **Protocol Version**: `2024-11-05`

## Connecting an Agent

You can connect any MCP-compliant agent (like **Claude Desktop**, **Gemini**, or **Codex**) to Docker Nexus. The agent typically runs the backend binary in **MCP Mode**.

### Claude Desktop Configuration

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docker-nexus": {
      "command": "path/to/backend/quantum-crab",
      "args": [],
      "env": {
        "MCP_MODE": "true"
      }
    }
  }
}
```

> **Note**: Replace `path/to/backend/quantum-crab` with the absolute path to your compiled binary or `go run .` command.
> The `MCP_MODE=true` environment variable is critical—it tells the backend to start in Agent mode instead of Web Server mode.

### Gemini CLI Configuration

Add the following to your `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "docker-nexus": {
      "command": "path/to/backend/quantum-crab",
      "args": [],
      "env": {
        "MCP_MODE": "true"
      }
    }
  }
}
```

## Tools

The following tools are available for agents to use:

### `list_projects`
Lists all Docker Compose projects managed by Docker Nexus.
- **Input**: None
- **Returns**: A JSON list of projects, including their IDs, names, and paths.

### `deploy_project`
Deploys a specific project using `docker compose up`.
- **Input**:
    - `id` (string, required): The ID of the project to deploy.
- **Returns**: The output of the docker compose command.

### `stop_project`
Stops a running project using `docker compose down`.
- **Input**:
    - `id` (string, required): The ID of the project to stop.
- **Returns**: The output of the docker compose command.

### `get_logs`
Retrieves logs for a specific project or service.
- **Input**:
    - `id` (string, required): Project ID.
    - `service` (string, optional): Specific service name.
    - `tail` (string, optional): Number of lines to retrieve (default: "100").
- **Returns**: The log output.

### `modify_compose`
Uses an LLM to modify a Docker Compose file based on natural language instructions.
- **Input**:
    - `compose` (string, required): The current YAML content.
    - `instruction` (string, required): The modification instruction.
- **Returns**: The modified YAML content.

## Resources

Resources allow agents to read the current state of files.

### Project Compose File
- **URI Pattern**: `project://{id}/docker-compose.yml`
- **MimeType**: `application/x-yaml`
- **Description**: The `docker-compose.yml` file for a specific project.
