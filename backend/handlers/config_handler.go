package handlers

import (
	"docker-nexus/services"

	"github.com/gofiber/fiber/v2"
)

type ConfigHandler struct {
	configService *services.ConfigService
}

func NewConfigHandler(s *services.ConfigService) *ConfigHandler {
	return &ConfigHandler{configService: s}
}

// GetConfig returns the current application configuration
func (h *ConfigHandler) GetConfig(c *fiber.Ctx) error {
	config := h.configService.GetConfig()
	return c.JSON(config)
}

// UpdateConfig updates the application configuration
func (h *ConfigHandler) UpdateConfig(c *fiber.Ctx) error {
	var newConfig services.AppConfig
	if err := c.BodyParser(&newConfig); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.configService.UpdateConfig(newConfig); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save config"})
	}

	return c.JSON(newConfig)
}
