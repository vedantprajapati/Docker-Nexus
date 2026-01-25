# Docker Nexus API Reference

This document outlines the REST API endpoints and MCP Tools available in Docker Nexus.

## Base URL
`http://localhost:8080/api` (default port)

---

## 1. REST API

### Projects

#### `GET /projects`
List all projects.

**Response (200 OK):**
```json
[
  {
    "id": "uuid-string",
    "name": "Project Name",
    "description": "...",
    "compose": "version: '3'...",
    "x": 100,
    "y": 100
  }
]
```

#### `POST /projects`
Create a new project.

**Request Body:**
```json
{
  "name": "My Project",
  "description": "Optional description",
  "compose": "version: '3'...",
  "x": 0,
  "y": 0
}
```

#### `GET /projects/:id`
Get details of a specific project.

#### `PUT /projects/:id`
Update a project. Accepts same body as `POST /projects`.

#### `DELETE /projects/:id`
Delete a project. Returns `204 No Content`.

---

### Groups

#### `POST /projects/group`
Create a new group project containing other projects.

**Request Body:**
```json
{
  "name": "My Group",
  "description": "Group of services",
  "projectIds": ["uuid-1", "uuid-2"]
}
```

#### `POST /projects/:id/group`
Add an existing project to a group.

**Request Body:**
```json
{
  "childProjectId": "uuid-child"
}
```

---

### Docker Operations

#### `POST /projects/:id/deploy`
Deploy a project (or group). Logic: Materializes `docker-compose.yml` to disk and runs `docker compose up -d`.

**Response (200 OK):**
```json
{
  "message": "Deployment started successfully",
  "output": "..."
}
```

#### `POST /projects/:id/stop`
Stop a project. Runs `docker compose down`.

#### `POST /projects/:id/restart`
Restart a project or service.
**Query Params:** `?service=serviceName` (optional)

#### `GET /projects/:id/status`
Get running status of services.

**Response:**
```json
[
  {
    "name": "service-name",
    "status": "running",
    "health": "healthy"
  }
]
```

#### `GET /projects/:id/logs`
Get logs.
**Query Params:**
- `service`: Filter by service name.
- `tail`: Number of lines (default 100).
- `Accept: text/event-stream`: Returns SSE stream of logs.

#### `GET /docker/containers`
List all containers on the host system.

---

## 2. MCP Tools
The backend exposes a Model Context Protocol server over Stdio when run with `MCP_MODE=true`.

### `list_projects`
Lists all available projects.
- **Input**: `{}`

### `deploy_project`
Deploys a project by ID.
- **Input**: `{"id": "uuid"}`

### `stop_project`
Stops a project by ID.
- **Input**: `{"id": "uuid"}`

### `create_group`
Creates a new group with specified child projects.
- **Input**:
  ```json
  {
    "name": "Group Name",
    "projectIds": ["uuid-1", "uuid-2"]
  }
  ```

### `add_to_group`
Adds a project to an existing group.
- **Input**: `{"groupId": "uuid", "childId": "uuid"}`

### `modify_compose`
Modifies a Compose file using an LLM.
- **Input**: `{"compose": "current yaml", "instruction": "add redis service"}`

### `get_logs`
Retrieves logs for a project.
- **Input**: `{"id": "uuid", "service": "optional", "tail": "100"}`
