package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type LLMService struct {
	configService *ConfigService
	client        *http.Client
}

func NewLLMService(cfg *ConfigService) *LLMService {
	return &LLMService{
		configService: cfg,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

const systemPrompt = `You are a Docker Compose expert. You help users modify their docker-compose.yml files based on natural language instructions.

Rules:
1. Only output valid YAML for docker-compose files
2. Preserve existing configurations unless asked to change them
3. Use best practices for Docker Compose
4. Add appropriate comments to explain changes
5. Return ONLY the modified YAML, no explanations or markdown code blocks

Common modifications you can make:
- Add/remove services
- Change ports, volumes, environment variables
- Add networks and connect services
- Set resource limits (cpu, memory)
- Add healthchecks
- Configure depends_on relationships
- Change images or add build configurations`

// cleanYAMLResponse strips any markdown code blocks or surrounding text if returned by LLMs
func cleanYAMLResponse(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "```") {
		firstLineEnd := strings.Index(trimmed, "\n")
		if firstLineEnd != -1 {
			trimmed = trimmed[firstLineEnd+1:]
		}
		if lastFence := strings.LastIndex(trimmed, "```"); lastFence != -1 {
			trimmed = trimmed[:lastFence]
		}
	}
	return strings.TrimSpace(trimmed)
}

// OpenAI structures
type OpenAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenAIRequest struct {
	Model    string          `json:"model"`
	Messages []OpenAIMessage `json:"messages"`
}

type OpenAIChoice struct {
	Message OpenAIMessage `json:"message"`
}

type OpenAIResponse struct {
	Choices []OpenAIChoice `json:"choices"`
}

// Anthropic structures
type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AnthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []AnthropicMessage `json:"messages"`
}

type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type AnthropicResponse struct {
	Content []AnthropicContentBlock `json:"content"`
}

// Gemini structures
type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []GeminiPart `json:"parts"`
}

type GeminiRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

func (s *LLMService) ModifyCompose(compose, instruction, provider string) (string, error) {
	var cfgModel string
	if s.configService != nil {
		config := s.configService.GetConfig()
		if provider == "" {
			provider = config.LLM.Provider
		}
		cfgModel = config.LLM.Model
	}
	if provider == "" {
		provider = os.Getenv("LLM_PROVIDER")
		if provider == "" {
			provider = "ollama"
		}
	}

	var result string
	var err error

	switch strings.ToLower(provider) {
	case "openai":
		result, err = s.callOpenAI(compose, instruction, cfgModel)
	case "ollama":
		result, err = s.callOllama(compose, instruction, cfgModel)
	case "anthropic":
		result, err = s.callAnthropic(compose, instruction, cfgModel)
	case "gemini":
		result, err = s.callGemini(compose, instruction, cfgModel)
	default:
		return "", fmt.Errorf("unknown LLM provider: %s", provider)
	}

	if err != nil {
		return "", err
	}

	return cleanYAMLResponse(result), nil
}

func (s *LLMService) CategorizeServices(compose, provider string) (map[string]string, error) {
	var cfgModel string
	if s.configService != nil {
		config := s.configService.GetConfig()
		if provider == "" {
			provider = config.LLM.Provider
		}
		cfgModel = config.LLM.Model
	}
	if provider == "" {
		provider = os.Getenv("LLM_PROVIDER")
		if provider == "" {
			provider = "ollama"
		}
	}

	prompt := `Given this docker-compose file:
%s

Categorize each service into one of these types: "Frontend", "Backend", "Database", "Cache", "Queue", or "Other".
Return ONLY a JSON object where keys are service names and values are the categories. No markers, no markdown.`

	userPrompt := fmt.Sprintf(prompt, compose)

	var response string
	var err error

	switch strings.ToLower(provider) {
	case "openai":
		response, err = s.callOpenAIPure(userPrompt, cfgModel)
	case "anthropic":
		response, err = s.callAnthropicPure(userPrompt, cfgModel)
	case "gemini":
		response, err = s.callGeminiPure(userPrompt, cfgModel)
	case "ollama":
		response, err = s.callOllamaPure(userPrompt, cfgModel)
	default:
		response, err = s.callOllamaPure(userPrompt, cfgModel)
	}

	if err != nil {
		fmt.Printf("LLM categorization task failed: %v. Falling back to empty categories.\n", err)
		return map[string]string{}, nil
	}

	// Cleanup response to ensure it's valid JSON
	trimmedResponse := response
	if start := strings.Index(response, "{"); start != -1 {
		if end := strings.LastIndex(response, "}"); end != -1 && end > start {
			trimmedResponse = response[start : end+1]
		}
	}

	var categories map[string]string
	if err := json.Unmarshal([]byte(trimmedResponse), &categories); err != nil {
		return nil, fmt.Errorf("failed to parse LLM response: %w (raw: %s)", err, response)
	}

	return categories, nil
}

// --- OpenAI ---

func (s *LLMService) callOpenAI(compose, instruction, model string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("OPENAI_MODEL")
	}
	if model == "" {
		model = "gpt-4o"
	}

	userPrompt := fmt.Sprintf("Here is the current docker-compose.yml:\n\n%s\n\nModification requested: %s\n\nProvide the modified docker-compose.yml:", compose, instruction)

	reqBody := OpenAIRequest{
		Model: model,
		Messages: []OpenAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	return s.sendOpenAIRequest(apiKey, reqBody)
}

func (s *LLMService) callOpenAIPure(prompt, model string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("OPENAI_MODEL")
	}
	if model == "" {
		model = "gpt-4o"
	}

	reqBody := OpenAIRequest{
		Model: model,
		Messages: []OpenAIMessage{
			{Role: "user", Content: prompt},
		},
	}

	return s.sendOpenAIRequest(apiKey, reqBody)
}

func (s *LLMService) sendOpenAIRequest(apiKey string, reqBody OpenAIRequest) (string, error) {
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI API error (%d): %s", resp.StatusCode, string(body))
	}

	var openAIResp OpenAIResponse
	if err := json.Unmarshal(body, &openAIResp); err != nil {
		return "", err
	}

	if len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return openAIResp.Choices[0].Message.Content, nil
}

// --- Anthropic ---

func (s *LLMService) callAnthropic(compose, instruction, model string) (string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("ANTHROPIC_MODEL")
	}
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	userPrompt := fmt.Sprintf("Here is the current docker-compose.yml:\n\n%s\n\nModification requested: %s\n\nProvide the modified docker-compose.yml:", compose, instruction)

	reqBody := AnthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages: []AnthropicMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	return s.sendAnthropicRequest(apiKey, reqBody)
}

func (s *LLMService) callAnthropicPure(prompt, model string) (string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("ANTHROPIC_MODEL")
	}
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	reqBody := AnthropicRequest{
		Model:     model,
		MaxTokens: 2048,
		Messages: []AnthropicMessage{
			{Role: "user", Content: prompt},
		},
	}

	return s.sendAnthropicRequest(apiKey, reqBody)
}

func (s *LLMService) sendAnthropicRequest(apiKey string, reqBody AnthropicRequest) (string, error) {
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Anthropic API error (%d): %s", resp.StatusCode, string(body))
	}

	var anthropicResp AnthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return "", err
	}

	if len(anthropicResp.Content) == 0 {
		return "", fmt.Errorf("no response from Anthropic")
	}

	return anthropicResp.Content[0].Text, nil
}

// --- Google Gemini ---

func (s *LLMService) callGemini(compose, instruction, model string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("GEMINI_MODEL")
	}
	if model == "" {
		model = "gemini-1.5-flash"
	}

	userPrompt := fmt.Sprintf("%s\n\nHere is the current docker-compose.yml:\n\n%s\n\nModification requested: %s\n\nProvide the modified docker-compose.yml:", systemPrompt, compose, instruction)

	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Role: "user",
				Parts: []GeminiPart{
					{Text: userPrompt},
				},
			},
		},
	}

	return s.sendGeminiRequest(apiKey, model, reqBody)
}

func (s *LLMService) callGeminiPure(prompt, model string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not set")
	}

	if model == "" {
		model = os.Getenv("GEMINI_MODEL")
	}
	if model == "" {
		model = "gemini-1.5-flash"
	}

	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Role: "user",
				Parts: []GeminiPart{
					{Text: prompt},
				},
			},
		},
	}

	return s.sendGeminiRequest(apiKey, model, reqBody)
}

func (s *LLMService) sendGeminiRequest(apiKey, model string, reqBody GeminiRequest) (string, error) {
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini API error (%d): %s", resp.StatusCode, string(body))
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// --- Ollama ---

func (s *LLMService) callOllama(compose, instruction, model string) (string, error) {
	prompt := systemPrompt + "\n\nHere is the current docker-compose.yml:\n\n" + compose + "\n\nModification requested: " + instruction + "\n\nProvide the modified docker-compose.yml:"
	return s.callOllamaPure(prompt, model)
}

func (s *LLMService) callOllamaPure(prompt, model string) (string, error) {
	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}

	if model == "" {
		model = os.Getenv("OLLAMA_MODEL")
	}
	if model == "" {
		model = "llama3.2"
	}

	reqBody := map[string]interface{}{
		"model":  model,
		"prompt": prompt,
		"stream": false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", ollamaURL+"/api/generate", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Ollama API error (%d): %s", resp.StatusCode, string(body))
	}

	var ollamaResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", err
	}

	response, ok := ollamaResp["response"].(string)
	if !ok {
		return "", fmt.Errorf("unexpected Ollama response format")
	}

	return response, nil
}
