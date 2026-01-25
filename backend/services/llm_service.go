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
}

func NewLLMService(cfg *ConfigService) *LLMService {
	return &LLMService{configService: cfg}
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

func (s *LLMService) ModifyCompose(compose, instruction, provider string) (string, error) {
	config := s.configService.GetConfig()
	if provider == "" {
		provider = config.LLM.Provider
	}
	// Fallback if config is empty
	if provider == "" {
		provider = "ollama"
	}

	switch provider {
	case "openai":
		return s.callOpenAI(compose, instruction, config.LLM.Model)
	case "ollama":
		return s.callOllama(compose, instruction, config.LLM.Model)
	case "anthropic":
		return "", fmt.Errorf("anthropic provider not yet implemented")
	case "gemini":
		return "", fmt.Errorf("gemini provider not yet implemented")
	default:
		return "", fmt.Errorf("unknown LLM provider: %s", provider)
	}
}

func (s *LLMService) CategorizeServices(compose, provider string) (map[string]string, error) {
	config := s.configService.GetConfig()
	if provider == "" {
		provider = config.LLM.Provider
	}
	// Fallback
	if provider == "" {
		provider = "ollama"
	}

	prompt := `Given this docker-compose file:
%s

Categorize each service into one of these types: "Frontend", "Backend", "Database", "Cache", "Queue", or "Other".
Return ONLY a JSON object where keys are service names and values are the categories. No markers, no markdown.`

	userPrompt := fmt.Sprintf(prompt, compose)

	var response string
	var err error

	if provider == "openai" {
		response, err = s.callOpenAIPure(userPrompt, config.LLM.Model)
	} else if provider == "anthropic" || provider == "gemini" {
		return nil, fmt.Errorf("%s provider not yet implemented", provider)
	} else {
		response, err = s.callOllamaPure(userPrompt, config.LLM.Model)
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

func (s *LLMService) callOpenAI(compose, instruction, model string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not set")
	}

	if model == "" {
		model = "gpt-4"
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

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("OpenAI API error: %s", string(body))
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

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
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
