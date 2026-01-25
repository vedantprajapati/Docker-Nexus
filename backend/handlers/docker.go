package handlers

import (
	"context"
	"fmt"
	"time"

	"docker-nexus/services"

	"github.com/gofiber/fiber/v2"
)

type DockerHandler struct {
	Service        *services.DockerService
	ProjectService *services.ProjectService
	configService  *services.ConfigService
}

func NewDockerHandler(s *services.DockerService, p *services.ProjectService, c *services.ConfigService) *DockerHandler {
	return &DockerHandler{
		Service:        s,
		ProjectService: p,
		configService:  c,
	}
}

// DeployProject godoc
// @Summary Deploy project
// @Description Deploy a Docker Compose project
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 200 {object} services.DeployResponse
// @Router /projects/{id}/deploy [post]
func (h *DockerHandler) DeployProject(c *fiber.Ctx) error {
	config := h.configService.GetConfig()
	if !config.Features.DockerControl {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Docker control is disabled by administrator",
		})
	}

	id := c.Params("id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	output, err := h.Service.DeployProject(ctx, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Failed to deploy: " + err.Error(),
			"output": output,
		})
	}

	return c.JSON(services.DeployResponse{
		Message: "Deployment started successfully",
		Output:  output,
	})
}

// StopProject godoc
// @Summary Stop project
// @Description Stop a Docker Compose project
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 200 {object} services.DeployResponse
// @Router /projects/{id}/stop [post]
func (h *DockerHandler) StopProject(c *fiber.Ctx) error {
	config := h.configService.GetConfig()
	if !config.Features.DockerControl {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Docker control is disabled by administrator",
		})
	}

	id := c.Params("id")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	output, err := h.Service.StopProject(ctx, id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Failed to stop: " + err.Error(),
			"output": output,
		})
	}

	return c.JSON(services.DeployResponse{
		Message: "Stack stopped successfully",
		Output:  output,
	})
}

// RestartProject godoc
// @Summary Restart project or service
// @Description Restart a Docker Compose project or a specific service
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param service query string false "Service Name"
// @Success 200 {object} services.DeployResponse
// @Router /projects/{id}/restart [post]
func (h *DockerHandler) RestartProject(c *fiber.Ctx) error {
	config := h.configService.GetConfig()
	if !config.Features.DockerControl {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Docker control is disabled by administrator",
		})
	}

	id := c.Params("id")
	service := c.Query("service", "")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	output, err := h.Service.RestartProject(ctx, id, service)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Failed to restart: " + err.Error(),
			"output": output,
		})
	}

	return c.JSON(services.DeployResponse{
		Message: "Restart successful",
		Output:  output,
	})
}

// GetProjectStatus godoc
// @Summary Get project status
// @Description Get status of services in a project
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Success 200 {array} services.ServiceStatus
// @Router /projects/{id}/status [get]
func (h *DockerHandler) GetProjectStatus(c *fiber.Ctx) error {
	id := c.Params("id")

	statuses, err := h.Service.GetProjectStatus(id)
	if err != nil {
		// Log error?
		return c.JSON([]services.ServiceStatus{})
	}

	return c.JSON(statuses)
}

// GetProjectLogs godoc
// @Summary Get project logs
// @Description Get logs for a project or specific service
// @Tags docker
// @Accept json
// @Produce json
// @Param id path string true "Project ID"
// @Param service query string false "Service Name"
// @Param tail query string false "Number of lines to tail" default(100)
// @Success 200 {object} map[string]string
// @Router /projects/{id}/logs [get]
func (h *DockerHandler) GetProjectLogs(c *fiber.Ctx) error {
	id := c.Params("id")
	service := c.Query("service", "")
	tail := c.Query("tail", "100")

	// Check if SSE requested
	if c.Get("Accept") == "text/event-stream" {
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")

		ctx := c.Context()
		logChan, err := h.Service.StreamProjectLogs(ctx, id, service, tail)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		// Stream logs
		// Fiber's context is cancelled when client disconnects
		for line := range logChan {
			fmt.Fprintf(c, "data: %s\n\n", line)
		}
		return nil
	}

	output, err := h.Service.GetProjectLogs(id, service, tail)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"logs": output})
}

// ListAllContainers godoc
// @Summary List all containers
// @Description List all accessible Docker containers
// @Tags docker
// @Accept json
// @Produce json
// @Success 200 {array} string
// @Router /docker/containers [get]
func (h *DockerHandler) ListAllContainers(c *fiber.Ctx) error {
	containers, err := h.Service.ListAllContainers()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(containers)
}
