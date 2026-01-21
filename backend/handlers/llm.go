package handlers

import (
	"os"

	"quantum-crab/services"

	"github.com/gofiber/fiber/v2"
)

type LLMHandler struct {
	Service *services.LLMService
}

func NewLLMHandler(s *services.LLMService) *LLMHandler {
	return &LLMHandler{Service: s}
}

type ModifyRequest struct {
	ProjectID   string `json:"projectId"`
	Instruction string `json:"instruction"`
	Compose     string `json:"compose"`
}

type ModifyResponse struct {
	ModifiedCompose string `json:"modifiedCompose"`
	Explanation     string `json:"explanation"`
}

type CategorizeRequest struct {
	Compose string `json:"compose"`
}

type CategorizeResponse struct {
	Categories map[string]string `json:"categories"`
}

// ModifyWithLLM godoc
// @Summary Modify compose with LLM
// @Description Use AI to modify a Docker Compose file
// @Tags llm
// @Accept json
// @Produce json
// @Param request body ModifyRequest true "Modification Request"
// @Success 200 {object} ModifyResponse
// @Router /llm/modify [post]
func (h *LLMHandler) ModifyWithLLM(c *fiber.Ctx) error {
	var req ModifyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Instruction == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Instruction is required"})
	}

	provider := os.Getenv("LLM_PROVIDER")
	modifiedYAML, err := h.Service.ModifyCompose(req.Compose, req.Instruction, provider)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "LLM call failed: " + err.Error()})
	}

	return c.JSON(ModifyResponse{
		ModifiedCompose: modifiedYAML,
		Explanation:     "Successfully modified the compose file based on your instruction.",
	})
}

// CategorizeServices godoc
// @Summary Categorize services
// @Description Categorize services in a Docker Compose file using AI
// @Tags llm
// @Accept json
// @Produce json
// @Param request body CategorizeRequest true "Categorization Request"
// @Success 200 {object} CategorizeResponse
// @Router /llm/categorize [post]
func (h *LLMHandler) CategorizeServices(c *fiber.Ctx) error {
	var req CategorizeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	provider := os.Getenv("LLM_PROVIDER")
	categories, err := h.Service.CategorizeServices(req.Compose, provider)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "LLM categorization failed: " + err.Error()})
	}

	return c.JSON(CategorizeResponse{Categories: categories})
}
