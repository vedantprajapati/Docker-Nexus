package services

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type FeatureFlags struct {
	AIEnabled     bool `json:"aiEnabled"`
	DockerControl bool `json:"dockerControl"`
	EditCompose   bool `json:"editCompose"`
}

type LLMSettings struct {
	Provider string `json:"provider"` // ollama, openai
	Model    string `json:"model"`    // e.g. llama3.2, gtp-4o
}

type ThemeConfig struct {
	Name   string            `json:"name"`
	Colors map[string]string `json:"colors"`
}

type AppConfig struct {
	Features FeatureFlags `json:"features"`
	LLM      LLMSettings  `json:"llm"`
	Theme    ThemeConfig  `json:"theme"`
}

type ConfigService struct {
	config     AppConfig
	configPath string
	mu         sync.RWMutex
}

func NewConfigService() *ConfigService {
	s := &ConfigService{
		configPath: "config.json", // Default path
	}
	s.loadConfig()
	return s
}

func (s *ConfigService) loadConfig() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Default config
	s.config = AppConfig{
		Features: FeatureFlags{
			AIEnabled:     true,
			DockerControl: true,
			EditCompose:   true,
		},
		LLM: LLMSettings{
			Provider: "ollama",
			Model:    "llama3.2",
		},
		Theme: ThemeConfig{
			Name: "Nier Default",
			Colors: map[string]string{
				"background":  "#BAB5A1",
				"foreground":  "#454138",
				"nier-beige":  "#BAB5A1",
				"nier-paper":  "#CDCAB2",
				"nier-dark":   "#454138",
				"nier-muted":  "#8A8775",
				"nier-accent": "#B25037",
				"nier-border": "#444139",
			},
		},
	}

	file, err := os.ReadFile(s.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Save default config if it doesn't exist
			s.saveConfigInternal()
		} else {
			fmt.Printf("Error reading config file: %v\n", err)
		}
		return
	}

	if err := json.Unmarshal(file, &s.config); err != nil {
		fmt.Printf("Error parsing config file: %v\n", err)
	}
}

func (s *ConfigService) saveConfigInternal() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.configPath, data, 0644)
}

func (s *ConfigService) GetConfig() AppConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *ConfigService) UpdateConfig(newConfig AppConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = newConfig
	return s.saveConfigInternal()
}
