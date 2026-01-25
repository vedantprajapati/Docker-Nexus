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
	return &McpListToolsResult{Tools: GetToolList()}, nil
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
		result, err = s.handleListProjects(callParams.Arguments)
	case "deploy_project":
		result, err = s.handleDeployProject(callParams.Arguments)
	case "stop_project":
		result, err = s.handleStopProject(callParams.Arguments)
	case "get_logs":
		result, err = s.handleGetLogs(callParams.Arguments)
	case "modify_compose":
		result, err = s.handleModifyCompose(callParams.Arguments)
	case "create_group":
		result, err = s.handleCreateGroup(callParams.Arguments)
	case "add_to_group":
		result, err = s.handleAddToGroup(callParams.Arguments)
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
