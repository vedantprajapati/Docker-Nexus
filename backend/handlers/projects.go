package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gopkg.in/yaml.v3"

	"quantum-crab/services"
)

type ProjectHandler struct {
	Service *services.ProjectService
}

func NewProjectHandler(s *services.ProjectService) *ProjectHandler {
	return &ProjectHandler{Service: s}
}

type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Compose     string  `json:"compose"`
	X           float64 `json:"x,omitempty"`
	Y           float64 `json:"y,omitempty"`
}

// ListProjects godoc
// @Summary List all projects
// @Description Get a list of all Docker Compose projects
// @Tags projects
// @Accept json
// @Produce json
// @Success 200 {array} services.Project
// @Router /projects [get]
func (h *ProjectHandler) ListProjects(c *fiber.Ctx) error {
	projects, err := h.Service.ListProjects()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(projects)
}

// CreateProject godoc
// @Summary Create a new project
// @Description Create a new Docker Compose project
// @Tags projects
// @Accept json
// @Produce json
// @Param project body CreateProjectRequest true "Project Data"
// @Success 201 {object} services.Project
// @Router /projects [post]
func (h *ProjectHandler) CreateProject(c *fiber.Ctx) error {
	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	// Double check YAML here or trust service? Service does it.
	// But service returns generalized error.
	// We'll duplicate YAML check if we want specific "Invalid YAML" message or check err.
	// Service unmarshals YAML.

	project, err := h.Service.CreateProject(req.Name, req.Description, req.Compose, req.X, req.Y)
	if err != nil {
		// Try to detect if it's a YAML error
		if _, ok := err.(*yaml.TypeError); ok {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid YAML: " + err.Error()})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(project)
}

// GetProject godoc
// @Summary Get project by ID
// @Description Get details of a specific project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 200 {object} services.Project
// @Router /projects/{id} [get]
func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
	id := c.Params("id")
	project, err := h.Service.LoadProject(id)
	if err != nil {
		// Need better way to check NotExist, maybe service should return specific error
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(project)
}

// UpdateProject godoc
// @Summary Update project
// @Description Update an existing project
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param project body CreateProjectRequest true "Project Data"
// @Success 200 {object} services.Project
// @Router /projects/{id} [put]
func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	id := c.Params("id")

	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	project, err := h.Service.UpdateProject(id, req.Name, req.Description, req.Compose, req.X, req.Y)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(project)
}

// DeleteProject godoc
// @Summary Delete project
// @Description Delete a project by ID
// @Tags projects
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 204 "No Content"
// @Router /projects/{id} [delete]
func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.Service.DeleteProject(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
