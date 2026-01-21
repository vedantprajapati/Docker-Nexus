---
sidebar_position: 1
---

# UI Walkthrough

Welcome to the Docker Nexus interface. This guide walks you through the main features of the application.

## Dashboard

The dashboard provides an overview of all your managed Docker Compose projects.

![Project List](/img/project-list.png)

## Graph Visualization

Visualize your services and their dependencies in an interactive graph.
- **Nodes**: Represent services defined in your Compose file.
- **Edges**: Represent dependencies (`depends_on`, links, shared networks).
- **Drag & Drop**: Arrange nodes to organize your view.

*(Graph view available in project details)*

## Groups

Groups let you organize related projects into parent-child hierarchies using Docker Compose's `include` field.

**How it works:**
- **Create a Group**: Drag one project onto another. The parent Compose file gets an `include:` directive referencing the child.
- **Hierarchy**: When you deploy the parent, Docker Compose automatically includes all children.
- **Expand/Collapse**: Click a group to see individual services.
- **Ungroup**: Right-click to split back into separate projects.

**Example:** A "Media Stack" group might include Plex, Sonarr, and Radarr as children. Deploying the parent deploys all three.

**Export:** Group Compose files (with `include` directives) can be exported as portable YAML to use on other servers.

## Compose Editor

Edit your `docker-compose.yml` files directly in the browser with syntax highlighting.
You can also use the **AI Assistant** to modify the configuration using natural language.

![Compose Editor](/img/compose-editor.png)

## Deployment & Logs

Monitor the status of your deployments and view real-time logs from your containers.

*(Deployment logs are available in the logs tab)*
