package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

const projectsDir = "./projects"

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Compose     string    `json:"compose"` // Raw YAML content
	X           float64   `json:"x"`
	Y           float64   `json:"y"`
}
type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Compose     string  `json:"compose"`
	X           float64 `json:"x,omitempty"`
	Y           float64 `json:"y,omitempty"`
}

func getProjectPath(id string) string {
	return filepath.Join(projectsDir, id)
}

func getProjectMetaPath(id string) string {
	return filepath.Join(getProjectPath(id), "meta.json")
}

func getComposePath(id string) string {
	return filepath.Join(getProjectPath(id), "docker-compose.yml")
}

func ListProjects(c *fiber.Ctx) error {
	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return c.JSON([]Project{})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var projects []Project
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		project, err := loadProject(e.Name())
		if err != nil {
			continue
		}
		projects = append(projects, *project)
	}

	if projects == nil {
		projects = []Project{}
	}
	return c.JSON(projects)
}

func loadProject(id string) (*Project, error) {
	metaData, err := os.ReadFile(getProjectMetaPath(id))
	if err != nil {
		return nil, err
	}

	var project Project
	if err := json.Unmarshal(metaData, &project); err != nil {
		return nil, err
	}

	composeData, err := os.ReadFile(getComposePath(id))
	if err == nil {
		project.Compose = string(composeData)
	}

	return &project, nil
}

func saveProject(project *Project) error {
	projectPath := getProjectPath(project.ID)
	if err := os.MkdirAll(projectPath, 0755); err != nil {
		return err
	}

	// Save metadata
	metaData, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(getProjectMetaPath(project.ID), metaData, 0644); err != nil {
		return err
	}

	// Save compose file
	if err := os.WriteFile(getComposePath(project.ID), []byte(project.Compose), 0644); err != nil {
		return err
	}

	return nil
}

func CreateProject(c *fiber.Ctx) error {
	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	// Validate YAML
	var composeContent interface{}
	if err := yaml.Unmarshal([]byte(req.Compose), &composeContent); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid YAML: " + err.Error()})
	}

	now := time.Now()
	project := &Project{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
		Compose:     req.Compose,
		X:           req.X,
		Y:           req.Y,
	}

	if err := saveProject(project); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(project)
}

func GetProject(c *fiber.Ctx) error {
	id := c.Params("id")
	project, err := loadProject(id)
	if err != nil {
		if os.IsNotExist(err) {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(project)
}

func UpdateProject(c *fiber.Ctx) error {
	id := c.Params("id")
	project, err := loadProject(id)
	if err != nil {
		if os.IsNotExist(err) {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var req CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate YAML if provided
	if req.Compose != "" {
		var composeContent interface{}
		if err := yaml.Unmarshal([]byte(req.Compose), &composeContent); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid YAML: " + err.Error()})
		}
		project.Compose = req.Compose
	}

	if req.Name != "" {
		project.Name = req.Name
	}
	if req.Description != "" {
		project.Description = req.Description
	}

	// Update position if provided
	project.X = req.X
	project.Y = req.Y

	project.UpdatedAt = time.Now()

	if err := saveProject(project); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(project)
}

func DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	projectPath := getProjectPath(id)

	if _, err := os.Stat(projectPath); os.IsNotExist(err) {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	if err := os.RemoveAll(projectPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(204)
}
