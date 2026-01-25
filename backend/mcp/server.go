package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"sync"

	"docker-nexus/services"
)

// Server implements the Model Context Protocol (MCP) server over standard input/output.
// It exposes functionalities like listing projects, deploying/stopping projects, and manipulating groups to AI agents.
type Server struct {
	ProjectService *services.ProjectService
	DockerService  *services.DockerService
	LLMService     *services.LLMService
	mutex          sync.Mutex
}

// NewServer creates a new MCP Server instance.
func NewServer(p *services.ProjectService, d *services.DockerService, l *services.LLMService) *Server {
	return &Server{
		ProjectService: p,
		DockerService:  d,
		LLMService:     l,
	}
}

// ServeStdio starts the server loop, reading JSON-RPC requests from Stdin and writing responses to Stdout.
func (s *Server) ServeStdio() {
	reader := bufio.NewReader(os.Stdin)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				return
			}
			log.Printf("Error reading input: %v", err)
			continue
		}

		s.handleMessage(line, os.Stdout)
	}
}

// handleMessage dispatches incoming JSON-RPC requests to appropriate handlers.
func (s *Server) handleMessage(data []byte, writer io.Writer) {
	var req JsonRpcRequest
	if err := json.Unmarshal(data, &req); err != nil {
		log.Printf("Invalid JSON: %v", err)
		return
	}

	var res interface{}
	var err *JsonRpcError

	switch req.Method {
	case "initialize":
		res, err = s.handleInitialize(req.Params)
	case "tools/list":
		res, err = s.handleListTools()
	case "tools/call":
		res, err = s.handleCallTool(req.Params)
	case "resources/list":
		res, err = s.handleListResources()
	case "resources/read":
		res, err = s.handleReadResource(req.Params)
	case "ping":
		res = map[string]string{}
	default:
		if req.ID != nil {
			err = &JsonRpcError{Code: -32601, Message: "Method not found"}
		}
	}

	if req.ID != nil {
		response := JsonRpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
		}
		if err != nil {
			response.Error = err
		} else {
			rawRes, _ := json.Marshal(res)
			response.Result = rawRes
		}

		bytes, _ := json.Marshal(response)
		writer.Write(bytes)
		writer.Write([]byte("\n"))
	}
}

// handleInitialize handles the 'initialize' method.
func (s *Server) handleInitialize(params json.RawMessage) (*McpInitializeResult, *JsonRpcError) {
	return &McpInitializeResult{
		ProtocolVersion: "2024-11-05",
		Capabilities: McpServerCapabilities{
			Resources: map[string]interface{}{},
			Tools:     map[string]interface{}{},
		},
		ServerInfo: McpServerInfo{
			Name:    "docker-nexus-mcp",
			Version: "1.0.0",
		},
	}, nil
}

// handleListTools returns the list of available tools for the AI agent.
func (s *Server) handleListTools() (*McpListToolsResult, *JsonRpcError) {
	tools := []McpTool{
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
	return &McpListToolsResult{Tools: tools}, nil
}

// handleCallTool executes a specific tool requested by the AI agent.
func (s *Server) handleCallTool(params json.RawMessage) (*McpCallToolResult, *JsonRpcError) {
	var callParams McpCallToolParams
	if err := json.Unmarshal(params, &callParams); err != nil {
		return nil, &JsonRpcError{Code: -32700, Message: "Parse error"}
	}

	var result string
	var err error

	switch callParams.Name {
	case "list_projects":
		projects, e := s.ProjectService.ListProjects()
		if e != nil {
			err = e
		} else {
			bytes, _ := json.MarshalIndent(projects, "", "  ")
			result = string(bytes)
		}

	case "deploy_project":
		id, _ := callParams.Arguments["id"].(string)
		if id == "" {
			err = fmt.Errorf("id is required")
		} else {
			result, err = s.DockerService.DeployProject(s.context(), id)
		}

	case "stop_project":
		id, _ := callParams.Arguments["id"].(string)
		if id == "" {
			err = fmt.Errorf("id is required")
		} else {
			result, err = s.DockerService.StopProject(s.context(), id)
		}

	case "get_logs":
		id, _ := callParams.Arguments["id"].(string)
		service, _ := callParams.Arguments["service"].(string)
		tail, _ := callParams.Arguments["tail"].(string)
		if tail == "" {
			tail = "100"
		}

		if id == "" {
			err = fmt.Errorf("id is required")
		} else {
			result, err = s.DockerService.GetProjectLogs(id, service, tail)
		}

	case "modify_compose":
		compose, _ := callParams.Arguments["compose"].(string)
		instruction, _ := callParams.Arguments["instruction"].(string)
		provider := os.Getenv("LLM_PROVIDER")

		result, err = s.LLMService.ModifyCompose(compose, instruction, provider)

	case "create_group":
		name, _ := callParams.Arguments["name"].(string)
		desc, _ := callParams.Arguments["description"].(string)
		pIdsInterface, _ := callParams.Arguments["projectIds"].([]interface{})
		var projectIds []string
		for _, v := range pIdsInterface {
			if s, ok := v.(string); ok {
				projectIds = append(projectIds, s)
			}
		}
		
		proj, e := s.ProjectService.CreateGroup(name, desc, projectIds, 0, 0)
		if e != nil {
			err = e
		} else {
			// Return ID
			result = fmt.Sprintf("Group Created. ID: %s", proj.ID)
		}

	case "add_to_group":
		groupId, _ := callParams.Arguments["groupId"].(string)
		childId, _ := callParams.Arguments["childId"].(string)
		
		if groupId == "" || childId == "" {
			err = fmt.Errorf("groupId and childId are required")
		} else {
			_, e := s.ProjectService.AddProjectToGroup(groupId, childId)
			if e != nil {
				err = e
			} else {
				result = "Added to group successfully"
			}
		}

	default:
		return nil, &JsonRpcError{Code: -32601, Message: fmt.Sprintf("Tool not found: %s", callParams.Name)}
	}

	if err != nil {
		return &McpCallToolResult{
			Content: []McpContent{{Type: "text", Text: fmt.Sprintf("Error: %v", err)}},
			IsError: true,
		}, nil
	}

	return &McpCallToolResult{
		Content: []McpContent{{Type: "text", Text: result}},
	}, nil
}

// handleListResources returns valid resources for the AI agent (list of projects as files).
func (s *Server) handleListResources() (*McpListResourcesResult, *JsonRpcError) {
	projects, err := s.ProjectService.ListProjects()
	if err != nil {
		return nil, &JsonRpcError{Code: -32603, Message: err.Error()}
	}

	var resources []McpResource
	for _, p := range projects {
		resources = append(resources, McpResource{
			URI:         fmt.Sprintf("project://%s/docker-compose.yml", p.ID),
			Name:        p.Name,
			Description: p.Description,
			MimeType:    "application/x-yaml",
		})
	}

	return &McpListResourcesResult{Resources: resources}, nil
}

// handleReadResource allows the AI to read the content of a project file via URI project://<ID>/docker-compose.yml
func (s *Server) handleReadResource(params json.RawMessage) (*McpReadResourceResult, *JsonRpcError) {
	var readParams McpReadResourceParams
	if err := json.Unmarshal(params, &readParams); err != nil {
		return nil, &JsonRpcError{Code: -32700, Message: "Parse error"}
	}

	// Basic parsing of URI 'project://{id}/docker-compose.yml'
	var id string
	n, err := fmt.Sscanf(readParams.URI, "project://%s/docker-compose.yml", &id)

	if err != nil || n != 1 {
		// Manual fallback if Sscanf behaves unexpectedly with UUIDs
		if len(readParams.URI) > 10 && readParams.URI[:10] == "project://" {
			// Intentionally empty block, fall through to robust check below
		}
	}

	if id == "" {
		prefix := "project://"
		suffix := "/docker-compose.yml"
		if len(readParams.URI) > len(prefix)+len(suffix) &&
			readParams.URI[:len(prefix)] == prefix &&
			readParams.URI[len(readParams.URI)-len(suffix):] == suffix {
			id = readParams.URI[len(prefix) : len(readParams.URI)-len(suffix)]
		} else {
			return nil, &JsonRpcError{Code: -32602, Message: "Invalid URI format"}
		}
	}

	project, err := s.ProjectService.LoadProject(id)
	if err != nil {
		return nil, &JsonRpcError{Code: -32602, Message: "Project not found: " + err.Error()}
	}

	return &McpReadResourceResult{
		Contents: []McpResourceContent{
			{
				URI:      readParams.URI,
				MimeType: "application/x-yaml",
				Text:     project.Compose,
			},
		},
	}, nil
}

func (s *Server) context() context.Context {
	return context.Background()
}
