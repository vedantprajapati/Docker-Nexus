package mcp

import (
	"encoding/json"
	"fmt"
	"os"
)

// GetToolList returns the static list of tools supported by the server.
func GetToolList() []McpTool {
	return []McpTool{
		{
			Name:        "list_projects",
			Description: "List all Docker Compose projects",
			InputSchema: json.RawMessage(`{"type": "object", "properties": {}}`),
		},
		{
			Name:        "deploy_project",
			Description: "Deploy a Docker Compose project",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"id": {"type": "string", "description": "Project ID"}
				},
				"required": ["id"]
			}`),
		},
		{
			Name:        "stop_project",
			Description: "Stop a Docker Compose project",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"id": {"type": "string", "description": "Project ID"}
				},
				"required": ["id"]
			}`),
		},
		{
			Name:        "get_logs",
			Description: "Get logs for a project or service",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"id": {"type": "string", "description": "Project ID"},
					"service": {"type": "string", "description": "Service name (optional)"},
					"tail": {"type": "string", "description": "Number of lines to tail (default 100)"}
				},
				"required": ["id"]
			}`),
		},
		{
			Name:        "modify_compose",
			Description: "Modify a Docker Compose file using AI",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"compose": {"type": "string", "description": "Current YAML content"},
					"instruction": {"type": "string", "description": "Instructions for modification"}
				},
				"required": ["compose", "instruction"]
			}`),
		},
		{
			Name:        "create_group",
			Description: "Create a new project group with child projects",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"name": {"type": "string", "description": "Group Name"},
					"description": {"type": "string", "description": "Group Description"},
					"projectIds": {"type": "array", "items": {"type": "string"}, "description": "List of child project IDs to include"}
				},
				"required": ["name", "projectIds"]
			}`),
		},
		{
			Name:        "add_to_group",
			Description: "Add a project to an existing group",
			InputSchema: json.RawMessage(`{
				"type": "object", 
				"properties": {
					"groupId": {"type": "string", "description": "ID of the parent group"},
					"childId": {"type": "string", "description": "ID of the child project to add"}
				},
				"required": ["groupId", "childId"]
			}`),
		},
	}
}

func (s *Server) handleListProjects(args map[string]interface{}) (string, error) {
	projects, err := s.ProjectService.ListProjects()
	if err != nil {
		return "", err
	}
	bytes, _ := json.MarshalIndent(projects, "", "  ")
	return string(bytes), nil
}

func (s *Server) handleDeployProject(args map[string]interface{}) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id is required")
	}
	return s.DockerService.DeployProject(s.context(), id)
}

func (s *Server) handleStopProject(args map[string]interface{}) (string, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return "", fmt.Errorf("id is required")
	}
	return s.DockerService.StopProject(s.context(), id)
}

func (s *Server) handleGetLogs(args map[string]interface{}) (string, error) {
	id, _ := args["id"].(string)
	service, _ := args["service"].(string)
	tail, _ := args["tail"].(string)
	if tail == "" {
		tail = "100"
	}
	if id == "" {
		return "", fmt.Errorf("id is required")
	}
	return s.DockerService.GetProjectLogs(id, service, tail)
}

func (s *Server) handleModifyCompose(args map[string]interface{}) (string, error) {
	compose, _ := args["compose"].(string)
	instruction, _ := args["instruction"].(string)
	provider := os.Getenv("LLM_PROVIDER")
	return s.LLMService.ModifyCompose(compose, instruction, provider)
}

func (s *Server) handleCreateGroup(args map[string]interface{}) (string, error) {
	name, _ := args["name"].(string)
	desc, _ := args["description"].(string)
	pIdsInterface, _ := args["projectIds"].([]interface{})
	var projectIds []string
	for _, v := range pIdsInterface {
		if str, ok := v.(string); ok {
			projectIds = append(projectIds, str)
		}
	}
	proj, err := s.ProjectService.CreateGroup(name, desc, projectIds, 0, 0)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Group Created. ID: %s", proj.ID), nil
}

func (s *Server) handleAddToGroup(args map[string]interface{}) (string, error) {
	groupId, _ := args["groupId"].(string)
	childId, _ := args["childId"].(string)
	if groupId == "" || childId == "" {
		return "", fmt.Errorf("groupId and childId are required")
	}
	_, err := s.ProjectService.AddProjectToGroup(groupId, childId)
	if err != nil {
		return "", err
	}
	return "Added to group successfully", nil
}
