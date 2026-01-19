package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"

	"quantum-crab/handlers"
)

func main() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	app := fiber.New(fiber.Config{
		AppName: "Quantum Crab API",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// API Routes
	api := app.Group("/api")

	// Projects
	api.Get("/projects", handlers.ListProjects)
	api.Post("/projects", handlers.CreateProject)
	api.Get("/projects/:id", handlers.GetProject)
	api.Put("/projects/:id", handlers.UpdateProject)
	api.Delete("/projects/:id", handlers.DeleteProject)

	// Docker operations
	api.Post("/projects/:id/deploy", handlers.DeployProject)
	api.Post("/projects/:id/stop", handlers.StopProject)
	api.Get("/projects/:id/status", handlers.GetProjectStatus)
	api.Get("/projects/:id/logs", handlers.GetProjectLogs)

	// LLM
	api.Post("/llm/modify", handlers.ModifyWithLLM)
	api.Post("/llm/categorize", handlers.CategorizeServices)

	// Global Docker Status
	api.Get("/docker/containers", handlers.ListAllContainers)

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
