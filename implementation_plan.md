# Architecture Review & Implementation Plan

## 1. Current Status
The **Docker Nexus** system manages Docker Compose projects. We have recently added "Group" functionality, allowing projects to include other projects as dependencies using the Docker Compose `include` feature.

### Recent Changes
- **Backend API**: Added `POST /projects/group` and `POST /projects/:id/group`.
- **MCP Server**: Added tools `create_group` and `add_to_group` for AI agents.
- **Frontend**: Existing graph view supports grouping via drag-and-drop (mapped to API).

## 2. Identified Flaws & Risks

### A. Referential Integrity (Critical)
*   **Issue**: Groups rely on relative paths (`include: - ../child-id/docker-compose.yml`).
*   **Risk**: If a user/agent deletes a Child Project, the Parent Group's `docker-compose.yml` becomes invalid. Deployment of the Group will fail with a "file not found" error.
*   **Mitigation**: 
    1.  *Short Term*: Warning on delete.
    2.  *Long Term*: Backend should check if a project is referenced by others before allowing deletion, or cascade updates to remove the reference.

### B. Deployment Atomicity
*   **Issue**: Deploying a Group triggers `docker compose up` on the group file. Docker handles the ordering.
*   **Risk**: If one child fails (e.g., port conflict), the partial state might be confusing. The system treats "Deploy" as a single shell command execution.

### C. File System Dependency
*   **Issue**: The implementation assumes a flat deployment directory (`deployments/{project_id}`).
*   **Risk**: If the `DEPLOY_DIR` structure changes, the relative `../{id}` paths break. Code is tightly coupled to this specific disk layout.
- **[NEW] `components/layout/FlowEditor.tsx`**: Isolate the React Flow logic.

## Phase 1.1: UI Polish & Accessibility

### Sidebar Refinement
- **Collapsible Sidebar**: Implement a toggle to collapse the left sidebar to an icon-only view.
- **Button Alignment**: Fix the "New Composition" and "New Group" buttons in the sidebar header to prevent overlap/cutoff.
- **Settings Visibility**: Ensure the settings entry point is discoverable.

### D. MCP Server Stability
*   **Issue**: Recent edits introduced syntax errors in `backend/mcp/server.go`.
*   **Action**: Immediate fix required to restore backend functionality.

## 3. Implementation Plan

### Step 1: Fix MCP Server Code
- **Task**: correct the `handleCallTool` switch statement in `backend/mcp/server.go`.
- **Detail**: Restore `case "modify_compose":` and fix variable scope for `create_group` and `add_to_group`.

### Step 2: Architecture Documentation
- **Task**: Create/Update `docs/ARCHITECTURE.md`.
- **Detail**: Document the "Project as Group" pattern, the `include` mechanism, and the file structure assumptions.

### Step 3: Validate and Verify
- **Task**: Run the `test_groups.py` script again (after fixing the MCP build) to ensure the API implementation is totally solid.
- **Task**: Verify MCP tools are registered correctly by querying the MCP endpoint (optional/manual).

## 4. Proposed Logical Improvements (Future)
*   **Dependency Graph**: Maintain a real graph in memory/DB to track "Project A includes Project B".
*   **Recursive Status**: When querying a Group's status, recursively fetch status of included services.

## Next Step
Fix the compilation error in `backend/mcp/server.go`.
