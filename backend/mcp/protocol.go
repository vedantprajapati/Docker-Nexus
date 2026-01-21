package mcp

import (
	"encoding/json"
)

// JSON-RPC 2.0 Types

type JsonRpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id,omitempty"` // String, Number, or Null
}

type JsonRpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JsonRpcError   `json:"error,omitempty"`
	ID      interface{}     `json:"id"`
}

type JsonRpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// MCP Types

type McpInitializeParams struct {
	ProtocolVersion string          `json:"protocolVersion"`
	Capabilities    McpCapabilities `json:"capabilities"`
	ClientInfo      McpClientInfo   `json:"clientInfo"`
}

type McpCapabilities struct {
	Experimental map[string]interface{} `json:"experimental,omitempty"`
	Roots        *struct {
		ListChanged bool `json:"listChanged,omitempty"`
	} `json:"roots,omitempty"`
	Sampling map[string]interface{} `json:"sampling,omitempty"`
}

type McpClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type McpInitializeResult struct {
	ProtocolVersion string                `json:"protocolVersion"`
	Capabilities    McpServerCapabilities `json:"capabilities"`
	ServerInfo      McpServerInfo         `json:"serverInfo"`
	Instructions    string                `json:"instructions,omitempty"`
}

type McpServerCapabilities struct {
	Logging   map[string]interface{} `json:"logging,omitempty"`
	Prompts   map[string]interface{} `json:"prompts,omitempty"`
	Resources map[string]interface{} `json:"resources,omitempty"`
	Tools     map[string]interface{} `json:"tools,omitempty"`
}

type McpServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type McpTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

type McpListToolsResult struct {
	Tools []McpTool `json:"tools"`
}

type McpCallToolParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

type McpCallToolResult struct {
	Content []McpContent `json:"content"`
	IsError bool         `json:"isError,omitempty"`
}

type McpContent struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type McpResource struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
}

type McpListResourcesResult struct {
	Resources []McpResource `json:"resources"`
}

type McpReadResourceParams struct {
	URI string `json:"uri"`
}

type McpReadResourceResult struct {
	Contents []McpResourceContent `json:"contents"`
}

type McpResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType,omitempty"`
	Text     string `json:"text,omitempty"`
	Blob     string `json:"blob,omitempty"`
}
