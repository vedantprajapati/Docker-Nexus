package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

const StoreFile = "./store.json"

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Compose     string    `json:"compose"` // Raw YAML content
	X           float64   `json:"x"`
	Y           float64   `json:"y"`
}

type ProjectStore struct {
	Projects []Project `json:"projects"`
}

type ProjectService struct {
	mutex sync.RWMutex
}

func NewProjectService() *ProjectService {
	return &ProjectService{}
}

func (s *ProjectService) loadStore() (*ProjectStore, error) {
	data, err := os.ReadFile(StoreFile)
	if err != nil {
		if os.IsNotExist(err) {
			return &ProjectStore{Projects: []Project{}}, nil
		}
		return nil, err
	}

	var store ProjectStore
	if err := json.Unmarshal(data, &store); err != nil {
		return nil, err
	}
	return &store, nil
}

func (s *ProjectService) saveStore(store *ProjectStore) error {
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(StoreFile, data, 0644)
}

func (s *ProjectService) ListProjects() ([]Project, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	store, err := s.loadStore()
	if err != nil {
		return nil, err
	}
	return store.Projects, nil
}

func (s *ProjectService) LoadProject(id string) (*Project, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	store, err := s.loadStore()
	if err != nil {
		return nil, err
	}

	for _, p := range store.Projects {
		if p.ID == id {
			// Return a copy
			return &p, nil
		}
	}
	return nil, fmt.Errorf("project not found")
}

func (s *ProjectService) CreateProject(name, description, compose string, x, y float64) (*Project, error) {
	// Validate YAML
	var composeContent interface{}
	if err := yaml.Unmarshal([]byte(compose), &composeContent); err != nil {
		return nil, err
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	store, err := s.loadStore()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	project := Project{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		CreatedAt:   now,
		UpdatedAt:   now,
		Compose:     compose,
		X:           x,
		Y:           y,
	}

	store.Projects = append(store.Projects, project)

	if err := s.saveStore(store); err != nil {
		return nil, err
	}

	return &project, nil
}

func (s *ProjectService) UpdateProject(id string, name, description, compose string, x, y float64) (*Project, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	store, err := s.loadStore()
	if err != nil {
		return nil, err
	}

	var found *Project
	for i := range store.Projects {
		if store.Projects[i].ID == id {
			found = &store.Projects[i]
			break
		}
	}

	if found == nil {
		return nil, fmt.Errorf("project not found")
	}

	if compose != "" {
		var composeContent interface{}
		if err := yaml.Unmarshal([]byte(compose), &composeContent); err != nil {
			return nil, err
		}
		found.Compose = compose
	}

	if name != "" {
		found.Name = name
	}
	if description != "" {
		found.Description = description
	}

	found.X = x
	found.Y = y
	found.UpdatedAt = time.Now()

	if err := s.saveStore(store); err != nil {
		return nil, err
	}

	return found, nil
}

func (s *ProjectService) DeleteProject(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	store, err := s.loadStore()
	if err != nil {
		return err
	}

	newProjects := []Project{}
	found := false
	for _, p := range store.Projects {
		if p.ID == id {
			found = true
			continue
		}
		newProjects = append(newProjects, p)
	}

	if !found {
		return fmt.Errorf("project not found")
	}

	store.Projects = newProjects
	return s.saveStore(store)
}

// Materialize writes the project files to disk in the specified base directory.
// Returns the path to the directory containing the docker-compose.yml for this project.
func (s *ProjectService) Materialize(id, baseDir string) (string, error) {
	project, err := s.LoadProject(id)
	if err != nil {
		return "", err
	}

	// We need to recursively materialize dependencies if they exist (groups)
	// But first let's just write this project
	projectDir := filepath.Join(baseDir, id)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", err
	}

	composePath := filepath.Join(projectDir, "docker-compose.yml")
	// Check if content changed? For now just overwrite to ensure freshness
	if err := os.WriteFile(composePath, []byte(project.Compose), 0644); err != nil {
		return "", err
	}

	// If this project includes other projects, we MUST materialize them too
	// The frontend uses relative paths like "../{childId}/docker-compose.yml"
	// So we need to parse the YAML and find includes.
	// OR we can just eagerly materialize ALL projects to the baseDir to be safe and simple.
	// Eager materialization is safer for "includes" to work without complex parsing logic here.

	// Let's optimize slightly: Materialize ALL projects if we are deploying one?
	// Or just trust the caller?
	// Better: The caller (DockerService) handles the deployment.
	// If I modify Materialize to just write THIS project, the dependencies might be missing.

	// Let's implement a helper "MaterializeAll" or similar if needed.
	// But `DeployedProject` might recursively need others.
	// Since "includes" use `../{id}/...`, all projects basically live as siblings in `baseDir`.
	// So if Project A includes Project B, both `/baseDir/A` and `/baseDir/B` must exist.

	// Implementation decision: When deploying ID, we should probably ensure ALL (or at least related) projects exist.
	// For simplicity, let's just materialize ALL projects from the store into baseDir.
	// This is fast enough for <100 projects and ensures consistency.

	allProjects, err := s.ListProjects()
	if err != nil {
		return "", err
	}

	for _, p := range allProjects {
		pDir := filepath.Join(baseDir, p.ID)
		if err := os.MkdirAll(pDir, 0755); err != nil {
			return "", err
		}
		if err := os.WriteFile(filepath.Join(pDir, "docker-compose.yml"), []byte(p.Compose), 0644); err != nil {
			return "", err
		}
	}

	return projectDir, nil
}
