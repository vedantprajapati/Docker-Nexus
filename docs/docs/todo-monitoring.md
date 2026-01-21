# TODO: Monitoring & Health Dashboard

> **Feature Status**: Planned / In Design
> **Goal**: Provide a persistent, historical view of infrastructure health across all Docker endpoints.

This section outlines the design and implementation plan for the upcoming Monitoring Dashboard.

![Monitoring Dashboard Mockup](/img/monitoring-mockup.png)

## 🎯 Objective
Enable users to:
1.  **Track Health**: Visualize uptime and container health status over time.
2.  **Filter Views**: Drill down by Project Group (e.g., "Media Server Stack") or specific Project.
3.  **Analyze Trends**: See when failures occurred with a time-range selector (Last hour, 24h, 7d).

## 🛠️ Proposed Architecture

### 1. Data Collection (Backend)
Since `docker compose ps` gives only the *current* state, we need a **Collector Service**.
- **Mechanism**: A background Go routine (`Ticker`) running every ~30 seconds.
- **Action**: 
  1. Iterates through all deployed projects.
  2. Runs `docker compose ps --format json`.
  3. Captures: Container ID, Name, State (running/exited), Status string, and Timestamp.
- **Storage**: 
  - *Option A (MVP)*: SQLite database (`monitoring.db`). Very fast, single-file, perfect for time-series queries like "select * where time > now - 24h".
  - *Option B*: Append-only JSON logs (Harder to query).
  - *Decision*: **SQLite**.

### 2. API Endpoints
We need new endpoints to serve this time-series data.

#### `GET /api/monitoring/stats`
Returns aggregated stats for a time window.
- **Query Params**:
  - `start_time`: ISO8601 string
  - `end_time`: ISO8601 string
  - `project_id`: (Optional) Filter by project
- **Response**:
```json
{
  "timestamps": ["10:00", "10:01", ...],
  "series": [
    {
      "container": "nginx-proxy",
      "status_codes": [1, 1, 1, 0, 1] // 1=UP, 0=DOWN
    }
  ]
}
```

#### `GET /api/monitoring/current`
Quick summary of current health for the dashboard header (e.g., "5/6 Services Healthy").

### 3. Frontend Implementation

#### Visualization Library
- **Recharts**: Industry standard for React. Good for composed, responsive line/area charts.
- **Visuals**:
  - **Main Chart**: Stacked Area Chart showing total healthy vs unhealthy containers over time.
  - **Swimlanes**: For specific projects, a "swimlane" heatmap (green/red blocks) showing uptime history.

#### UI Layout
A new top-level sidebar item **"Monitoring"** leading to `/monitoring`.
- **Top Bar**: Global Health Score (%), Active Alerts.
- **Controls**: Time Range Picker (1h, 6h, 24h, 7d).
- **Main View**:
  - **Health Timeline**: A graph showing 'Healthy Container Count' over selected time.
  - **Incident Log**: List of timestamps where status changed from `running` to `exited` (non-zero code).

## 📝 Implementation Checklist

- [ ] **Backend**: Initialize `sqlite` driver and setup `monitoring.db`.
- [ ] **Backend**: Create `HealthCollector` service to poll Docker.
- [ ] **Backend**: Implement `GET /api/monitoring/` endpoints.
- [ ] **Frontend**: Add `recharts` package.
- [ ] **Frontend**: Create `/monitoring` page and connect to API.
