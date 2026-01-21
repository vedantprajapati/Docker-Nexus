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

type Server struct {
	ProjectService *services.ProjectService
	DockerService  *services.DockerService
	LLMService     *services.LLMService
	mutex          sync.Mutex
}

func NewServer(p *services.ProjectService, d *services.DockerService, l *services.LLMService) *Server {
	return &Server{
		ProjectService: p,
		DockerService:  d,
		LLMService:     l,
	}
}

// ServeStdio handles JSON-RPC messages from stdin and writes to stdout
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

func (s *Server) handleMessage(data []byte, writer io.Writer) {
	var req JsonRpcRequest
	if err := json.Unmarshal(data, &req); err != nil {
		log.Printf("Invalid JSON: %v", err)
		return
	}

	// Logging for debug (optional, be careful with stdio interference)
	// log.Printf("Received: %s", req.Method)

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
		// Ignore notifications or unknown methods
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
	}
	return &McpListToolsResult{Tools: tools}, nil
}

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

func (s *Server) handleReadResource(params json.RawMessage) (*McpReadResourceResult, *JsonRpcError) {
	var readParams McpReadResourceParams
	if err := json.Unmarshal(params, &readParams); err != nil {
		return nil, &JsonRpcError{Code: -32700, Message: "Parse error"}
	}

	// Basic parsing of URI 'project://{id}/docker-compose.yml'
	var id string
	n, err := fmt.Sscanf(readParams.URI, "project://%s/docker-compose.yml", &id)

	// Handle cases where ID might contain more slashes or parsing is tricky
	if err != nil || n != 1 {
		// Try manual parsing if simple scan fails
		if len(readParams.URI) > 10 && readParams.URI[:10] == "project://" {
			// rest := readParams.URI[10:]
			// Assumes ID is everything up to the next slash
			// But UUID shouldn't have slash.
			// Wait, if scanf fails but manual parsing works?
			// The format is fixed for now.
		}
		// If scanning the ID directly fails because of trailing stuff
		// Using Sscanf with string format might be brittle if id contains / which it shouldn't (UUID).
		// Note that Sscanf stops at space, but %s matches non-whitespace.
		// However, the format string has explicit suffix.
	}

	// A more robust URI parser is better, but let's try a simpler approach if scanf fails
	if id == "" {
		// Assuming URI format: project://<ID>/docker-compose.yml
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
