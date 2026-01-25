package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// AddToGroupRequest defines the payload adding a child project to a group.
type AddToGroupRequest struct {
	// ChildProjectID is the UUID of the project to add. Required.
	ChildProjectID string `json:"childProjectId"`
}

// AddProjectToGroup adds an existing project (child) to another project (parent).
// It does this by appending the child's path to the 'include' list of the parent's docker-compose.yml.
//
// POST /api/projects/:id/group
//
// Parameters:
//   - id: The UUID of the parent project (the Group).
//
// Input:
//   - JSON body matching AddToGroupRequest.
//
// Response:
//   - 200 OK: Returns the updated Parent Project object.
//   - 400 Bad Request: If ID is missing, child is already in group, or parent YAML is malformed.
//   - 404 Not Found: If parent or child project does not exist.
//   - 500 Internal Server Error: If YAML parsing or saving fails.
func (h *ProjectHandler) AddProjectToGroup(c *fiber.Ctx) error {
	parentID := c.Params("id")
	var req AddToGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ChildProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "childProjectId is required"})
	}

	updatedProject, err := h.Service.AddProjectToGroup(parentID, req.ChildProjectID)
	if err != nil {
		// Differentiate errors? For simplicity return 500 or 400
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updatedProject)
}

// CreateGroupRequest body for creating a new group
type CreateGroupRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	ProjectIDs  []string `json:"projectIds"` 
	X           float64  `json:"x,omitempty"`
	Y           float64  `json:"y,omitempty"`
}

// CreateGroup creates a new project that acts as a container for other projects.
// It generates a docker-compose.yml with an 'include' list pointing to the specified child projects.
//
// POST /api/projects/group
//
// Input:
//   - JSON body matching CreateGroupRequest.
//
// Response:
//   - 201 Created: Returns the created Group Project object.
//   - 400 Bad Request: If name is missing or request is invalid.
//   - 500 Internal Server Error: If creation fails.
func (h *ProjectHandler) CreateGroup(c *fiber.Ctx) error {
	var req CreateGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	project, err := h.Service.CreateGroup(req.Name, req.Description, req.ProjectIDs, req.X, req.Y)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(project)
}
