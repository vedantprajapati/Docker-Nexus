package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"gopkg.in/yaml.v3"

	"docker-nexus/services"
)

// ProjectHandler manages Project-related HTTP requests.
// It handles creating, reading, updating, and deleting projects (Docker Compose configurations).
type ProjectHandler struct {
	Service *services.ProjectService
}

// NewProjectHandler creates a new instance of ProjectHandler with the given service.
func NewProjectHandler(s *services.ProjectService) *ProjectHandler {
	return &ProjectHandler{Service: s}
}

// CreateProjectRequest defines the payload for creating or updating a project.
type CreateProjectRequest struct {
	// Name is the display name of the project. Required.
	Name        string  `json:"name"`
	// Description is an optional text description of the project.
	Description string  `json:"description,omitempty"`
	// Compose is the raw Docker Compose YAML content as a string.
	Compose     string  `json:"compose"`
	// X coordinate for the graph view.
	X           float64 `json:"x,omitempty"`
	// Y coordinate for the graph view.
	Y           float64 `json:"y,omitempty"`
}

// ListProjects retrieves all projects from the store.
//
// GET /api/projects
//
// Response:
//   - 200 OK: Returns a JSON array of Project objects.
//   - 500 Internal Server Error: If the store cannot be read.
func (h *ProjectHandler) ListProjects(c *fiber.Ctx) error {
	projects, err := h.Service.ListProjects()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(projects)
}

// CreateProject creates a new project.
//
// POST /api/projects
//
// Input:
//   - JSON body matching CreateProjectRequest.
//
// Response:
//   - 201 Created: Returns the created Project object.
//   - 400 Bad Request: If Name is missing or YAML is invalid.
//   - 500 Internal Server Error: If the project cannot be saved.
func (h *ProjectHandler) CreateProject(c *fiber.Ctx) error {
	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	project, err := h.Service.CreateProject(req.Name, req.Description, req.Compose, req.X, req.Y)
	if err != nil {
		if _, ok := err.(*yaml.TypeError); ok {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid YAML: " + err.Error()})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(project)
}

// GetProject retrieves a single project by ID.
//
// GET /api/projects/:id
//
// Parameters:
//   - id: The UUID of the project.
//
// Response:
//   - 200 OK: Returns the Project object.
//   - 404 Not Found: If the project is not found.
//   - 500 Internal Server Error: If database error occurs.
func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
	id := c.Params("id")
	project, err := h.Service.LoadProject(id)
	if err != nil {
		if errors.Is(err, services.ErrProjectNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(project)
}

// UpdateProject updates an existing project's details.
//
// PUT /api/projects/:id
//
// Parameters:
//   - id: The UUID of the project.
//
// Input:
//   - JSON body matching CreateProjectRequest (all fields optional, but typically sent fully).
//
// Response:
//   - 200 OK: Returns the updated Project object.
//   - 400 Bad Request: If body is invalid.
//   - 500 Internal Server Error: If update fails.
func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	id := c.Params("id")

	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	project, err := h.Service.UpdateProject(id, req.Name, req.Description, req.Compose, req.X, req.Y)
	if err != nil {
		if errors.Is(err, services.ErrProjectNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(project)
}

// DeleteProject removes a project from the store.
//
// DELETE /api/projects/:id
//
// Parameters:
//   - id: The UUID of the project.
//
// Response:
//   - 204 No Content: Success.
//   - 500 Internal Server Error: If deletion fails.
func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.Service.DeleteProject(id); err != nil {
		if errors.Is(err, services.ErrProjectNotFound) {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
