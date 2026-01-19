package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ServiceStatus struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Health string `json:"health,omitempty"`
}

type DeployResponse struct {
	Message string `json:"message"`
	Output  string `json:"output,omitempty"`
}

func DeployProject(c *fiber.Ctx) error {
	id := c.Params("id")
	projectPath := getProjectPath(id)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "compose", "up", "-d")
	cmd.Dir = projectPath

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Failed to deploy: " + err.Error(),
			"output": string(output),
		})
	}

	return c.JSON(DeployResponse{
		Message: "Deployment started successfully",
		Output:  string(output),
	})
}

func StopProject(c *fiber.Ctx) error {
	id := c.Params("id")
	projectPath := getProjectPath(id)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "compose", "down")
	cmd.Dir = projectPath

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":  "Failed to stop: " + err.Error(),
			"output": string(output),
		})
	}

	return c.JSON(DeployResponse{
		Message: "Stack stopped successfully",
		Output:  string(output),
	})
}

func GetProjectStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	projectPath := getProjectPath(id)

	cmd := exec.Command("docker", "compose", "ps", "--format", "json")
	cmd.Dir = projectPath

	output, err := cmd.Output()
	if err != nil {
		// If no containers running, return empty array
		return c.JSON([]ServiceStatus{})
	}

	// Parse docker compose ps output
	var statuses []ServiceStatus
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Simple parsing - actual format depends on docker compose version
		statuses = append(statuses, ServiceStatus{
			Name:   line,
			Status: "running",
		})
	}

	return c.JSON(statuses)
}

func GetProjectLogs(c *fiber.Ctx) error {
	id := c.Params("id")
	projectPath := getProjectPath(id)
	service := c.Query("service", "")
	tail := c.Query("tail", "100")

	args := []string{"compose", "logs", "--tail", tail}
	if service != "" {
		args = append(args, service)
	}

	cmd := exec.Command("docker", args...)
	cmd.Dir = projectPath

	// Check if SSE requested
	if c.Get("Accept") == "text/event-stream" {
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")

		args = []string{"compose", "logs", "-f", "--tail", tail}
		if service != "" {
			args = append(args, service)
		}

		cmd := exec.Command("docker", args...)
		cmd.Dir = projectPath

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		if err := cmd.Start(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		ctx := c.Context()
		var wg sync.WaitGroup
		wg.Add(1)

		go func() {
			defer wg.Done()
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				select {
				case <-ctx.Done():
					cmd.Process.Kill()
					return
				default:
					fmt.Fprintf(c, "data: %s\n\n", scanner.Text())
				}
			}
		}()

		wg.Wait()
		return nil
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"logs": string(output)})
}

type ContainerInfo struct {
	ID     string            `json:"id"`
	Names  []string          `json:"names"`
	Image  string            `json:"image"`
	Status string            `json:"status"`
	State  string            `json:"state"`
	Labels map[string]string `json:"labels"`
}

func ListAllContainers(c *fiber.Ctx) error {
	cmd := exec.Command("docker", "ps", "-a", "--format", "{{json .}}")
	output, err := cmd.Output()
	if err != nil {
		// Log the error but return a 200 with an empty list if docker is missing
		fmt.Printf("Error running docker ps: %v\n", err)
		return c.JSON([]ContainerInfo{})
	}

	var containers []ContainerInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Docker outputs each container as a JSON object per line
		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		// Map docker's custom JSON format to our struct
		// Docker ps JSON fields are TitleCased
		container := ContainerInfo{
			ID:     fmt.Sprint(raw["ID"]),
			Image:  fmt.Sprint(raw["Image"]),
			Status: fmt.Sprint(raw["Status"]),
			State:  fmt.Sprint(raw["State"]),
			Labels: make(map[string]string),
		}

		if names, ok := raw["Names"].(string); ok {
			container.Names = strings.Split(names, ",")
		}

		// Note: --format {{json .}} doesn't include detailed labels in a simple way
		// We might need 'docker inspect' for deep labels, but compose labels are often in 'Names'
		// or we can try to parse the 'Labels' field if we add it to format.

		containers = append(containers, container)
	}

	return c.JSON(containers)
}
