# API Changelog

## [Unreleased] - 2026-01-25

### Added
- **Group Management Support**: Added new endpoints to create and manage project groups using Docker Compose `include`.
    - `POST /api/projects/group`: Create a new group with a list of initial child project IDs.
    - `POST /api/projects/{id}/group`: Add an existing project to a group.
- **MCP Tools**: Updated the Model Context Protocol (MCP) server to support group operations.
    - `create_group`: Tool to create a new group.
    - `add_to_group`: Tool to add a project to an existing group.

### Changed
- **Container Naming**: Enforced explicit container names for `docker-nexus` stack services (`docker-nexus-frontend`, `docker-nexus-backend`, `docker-nexus-docs`) to prevent numeric suffixes.
- **Environment**: Removed `COMPOSE_PROJECT_NAME` override in `.env` to standardize on `docker-nexus`.

### Notes
- Group functionality leverages Docker Compose `include` feature. Parent references children via relative paths (`../{id}/docker-compose.yml`).
- Terminal and Logs endpoints (`/api/projects/:id/terminal`, `/api/projects/:id/logs`) now support Group IDs to manage the entire stack or individual services within a group.
