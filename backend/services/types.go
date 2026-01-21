package services

type DeployResponse struct {
	Message string `json:"message"`
	Output  string `json:"output,omitempty"`
}

type ServiceStatus struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Health string `json:"health,omitempty"`
}

type ContainerInfo struct {
	ID     string            `json:"id"`
	Names  []string          `json:"names"`
	Image  string            `json:"image"`
	Status string            `json:"status"`
	State  string            `json:"state"`
	Labels map[string]string `json:"labels"`
}
