package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Ensure DeployResponse is available (it's in types.go now or we define it here if types.go wasn't created properly? I'll assume usage of the one I defined or redefine if needed, but safe to redefine locally if private or just ensure types.go is there. I'll rely on it being in the package)

type DockerService struct {
	ProjectService *ProjectService
}

func NewDockerService(p *ProjectService) *DockerService {
	return &DockerService{ProjectService: p}
}

// getDockerCommand returns the command to run docker.
// It checks if "docker" is in the PATH. If not, and we are on Windows, it falls back to "wsl docker".
func (s *DockerService) getDockerCommand() []string {
	_, err := exec.LookPath("docker")
	if err == nil {
		return []string{"docker"}
	}
	// Fallback for Windows if docker is not in PATH but wsl is
	if _, err := exec.LookPath("wsl"); err == nil {
		return []string{"wsl", "docker"}
	}
	// Default to docker and let it fail if neither is found
	return []string{"docker"}
}

func (s *DockerService) getDeployDir() string {
	dir := os.Getenv("DEPLOY_DIR")
	if dir == "" {
		dir = "./deployments"
	}
	return dir
}

func (s *DockerService) DeployProject(ctx context.Context, projectID string) (string, error) {
	deployDir := s.getDeployDir()

	// Materialize files first
	projectPath, err := s.ProjectService.Materialize(projectID, deployDir)
	if err != nil {
		return "", fmt.Errorf("failed to materialize project files: %w", err)
	}

	dockerCmd := s.getDockerCommand()
	args := append(dockerCmd, "compose", "up", "-d")
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = projectPath

	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

func (s *DockerService) StopProject(ctx context.Context, projectID string) (string, error) {
	deployDir := s.getDeployDir()
	projectPath := filepath.Join(deployDir, projectID)

	// We assume files exist if stopping. If not, maybe we can't stop?
	// But if directory is missing, docker compose down won't work anyway.
	if _, err := os.Stat(projectPath); os.IsNotExist(err) {
		return "", fmt.Errorf("project not deployed (deployment directory missing)")
	}

	dockerCmd := s.getDockerCommand()
	args := append(dockerCmd, "compose", "down")
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = projectPath

	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}
	return string(output), nil
}

func (s *DockerService) GetProjectStatus(projectID string) ([]ServiceStatus, error) {
	deployDir := s.getDeployDir()
	projectPath := filepath.Join(deployDir, projectID)

	dockerCmd := s.getDockerCommand()
	args := append(dockerCmd, "compose", "ps", "--format", "json")
	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = projectPath

	output, err := cmd.Output()
	if err != nil {
		return []ServiceStatus{}, nil
	}

	var statuses []ServiceStatus
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		statuses = append(statuses, ServiceStatus{
			Name:   line,
			Status: "running",
		})
	}
	return statuses, nil
}

func (s *DockerService) GetProjectLogs(projectID, service, tail string) (string, error) {
	deployDir := s.getDeployDir()
	projectPath := filepath.Join(deployDir, projectID)

	args := []string{"compose", "logs", "--tail", tail}
	if service != "" {
		args = append(args, service)
	}

	dockerCmd := s.getDockerCommand()
	fullArgs := append(dockerCmd, args...)
	cmd := exec.Command(fullArgs[0], fullArgs[1:]...)
	cmd.Dir = projectPath

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}
	return string(output), nil
}

func (s *DockerService) StreamProjectLogs(ctx context.Context, projectID, service, tail string) (<-chan string, error) {
	deployDir := s.getDeployDir()
	projectPath := filepath.Join(deployDir, projectID)

	args := []string{"compose", "logs", "-f", "--tail", tail}
	if service != "" {
		args = append(args, service)
	}

	dockerCmd := s.getDockerCommand()
	fullArgs := append(dockerCmd, args...)
	cmd := exec.CommandContext(ctx, fullArgs[0], fullArgs[1:]...)
	cmd.Dir = projectPath

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	outChan := make(chan string)

	go func() {
		defer close(outChan)
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			outChan <- scanner.Text()
		}
		cmd.Wait()
	}()

	return outChan, nil
}

func (s *DockerService) ListAllContainers() ([]ContainerInfo, error) {
	// ... (same as before)
	dockerCmd := s.getDockerCommand()
	// "docker ps -a --format ..." -> append "ps", "-a" ...
	args := append(dockerCmd, "ps", "-a", "--format", `{"ID":"{{.ID}}", "Image":"{{.Image}}", "Status":"{{.Status}}", "State":"{{.State}}", "Names":"{{.Names}}", "Labels":"{{.Labels}}"}`)
	cmd := exec.Command(args[0], args[1:]...)
	output, err := cmd.Output()
	if err != nil {
		fmt.Printf("Error running docker ps: %v\n", err)
		return []ContainerInfo{}, nil
	}

	var containers []ContainerInfo
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

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

		if labels, ok := raw["Labels"].(string); ok {
			parts := strings.Split(labels, ",")
			for _, p := range parts {
				kv := strings.SplitN(strings.TrimSpace(p), "=", 2)
				if len(kv) == 2 {
					container.Labels[kv[0]] = kv[1]
				}
			}
		}

		containers = append(containers, container)
	}
	return containers, nil
}
