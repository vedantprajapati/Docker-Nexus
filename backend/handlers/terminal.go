package handlers

import (
	"encoding/json"
	"io"
	"log"
	"os/exec"
	"syscall"

	"docker-nexus/services"

	"github.com/creack/pty"
	"github.com/gofiber/websocket/v2"
)

type TerminalHandler struct {
	Service *services.DockerService
}

func NewTerminalHandler(s *services.DockerService) *TerminalHandler {
	return &TerminalHandler{Service: s}
}

type ResizeMessage struct {
	Type string `json:"type"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
	Data string `json:"data"`
}

func (h *TerminalHandler) HandleTerminal(c *websocket.Conn) {
	projectID := c.Params("id")
	serviceName := c.Query("service")

	if projectID == "" || serviceName == "" {
		log.Println("Missing project ID or service name")
		c.WriteMessage(websocket.TextMessage, []byte("Error: Missing project ID or service name"))
		c.Close()
		return
	}

	containerID, err := h.Service.GetContainerID(projectID, serviceName)
	if err != nil {
		log.Printf("Failed to get container ID: %v", err)
		c.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		c.Close()
		return
	}

	// Prepare docker exec command
	cmd := exec.Command("docker", "exec", "-it", containerID, "/bin/sh")
	
	// Start PTY manually to have control over SysProcAttr
	ptmx, pts, err := pty.Open()
	if err != nil {
		log.Printf("Failed to open pty: %v", err)
		c.WriteMessage(websocket.TextMessage, []byte("Error opening PTY: "+err.Error()))
		c.Close()
		return
	}
	defer pts.Close()

	cmd.Stdin = pts
	cmd.Stdout = pts
	cmd.Stderr = pts
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid:  true,
		Setctty: false,
	}

	if err := cmd.Start(); err != nil {
		ptmx.Close()
		log.Printf("Failed to start pty: %v", err)
		c.WriteMessage(websocket.TextMessage, []byte("Error starting PTY: "+err.Error()))
		c.Close()
		return
	}
	defer func() {
		_ = ptmx.Close()
		_ = cmd.Process.Kill() 
		_ = cmd.Wait()
	}()

	// Handle resize and input from websocket
	go func() {
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				return
			}

			var resizeMsg ResizeMessage
			if err := json.Unmarshal(msg, &resizeMsg); err == nil {
				if resizeMsg.Type == "resize" {
					pty.Setsize(ptmx, &pty.Winsize{
						Rows: uint16(resizeMsg.Rows),
						Cols: uint16(resizeMsg.Cols),
					})
					continue
				}
				if resizeMsg.Type == "input" {
					ptmx.Write([]byte(resizeMsg.Data))
				}
			} else {
				// If not JSON, treat as raw input (legacy/fallback)
				ptmx.Write(msg)
			}
		}
	}()

	// Copy PTY output to websocket
	buf := make([]byte, 1024)
	for {
		n, err := ptmx.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("Read error: %v", err)
			}
			break
		}
		if err := c.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
			break
		}
	}
}
