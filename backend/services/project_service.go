package services

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"gopkg.in/yaml.v3"
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Compose     string    `json:"compose"`
	HostPath    string    `json:"hostPath,omitempty"`
	X           float64   `json:"x"`
	Y           float64   `json:"y"`
}

type ProjectService struct {
	db    *sql.DB
	mutex sync.RWMutex
}

func NewProjectService(db *sql.DB) *ProjectService {
	// Initialize Schema
	initSchema(db)
	return &ProjectService{db: db}
}

func initSchema(db *sql.DB) {
	query := `
	CREATE TABLE IF NOT EXISTS projects (
		id UUID PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		compose TEXT,
		host_path TEXT,
		x FLOAT DEFAULT 0,
		y FLOAT DEFAULT 0,
		created_at TIMESTAMP,
		updated_at TIMESTAMP
	);`
	if _, err := db.Exec(query); err != nil {
		fmt.Printf("Error creating schema: %v\n", err)
	}
}

func (s *ProjectService) ListProjects() ([]Project, error) {
	rows, err := s.db.Query("SELECT id, name, description, compose, host_path, x, y, created_at, updated_at FROM projects")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Compose, &p.HostPath, &p.X, &p.Y, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func (s *ProjectService) LoadProject(id string) (*Project, error) {
	var p Project
	err := s.db.QueryRow("SELECT id, name, description, compose, host_path, x, y, created_at, updated_at FROM projects WHERE id = $1", id).Scan(
		&p.ID, &p.Name, &p.Description, &p.Compose, &p.HostPath, &p.X, &p.Y, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("project not found")
		}
		return nil, err
	}
	return &p, nil
}

func (s *ProjectService) CreateProject(name, description, compose string, x, y float64) (*Project, error) {
	// Validate YAML
	var composeContent interface{}
	if err := yaml.Unmarshal([]byte(compose), &composeContent); err != nil {
		return nil, err
	}

	now := time.Now()
	id := uuid.New().String()

	_, err := s.db.Exec(`
		INSERT INTO projects (id, name, description, compose, host_path, x, y, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, name, description, compose, "", x, y, now, now,
	)
	if err != nil {
		return nil, err
	}

	return &Project{
		ID:          id,
		Name:        name,
		Description: description,
		CreatedAt:   now,
		UpdatedAt:   now,
		Compose:     compose,
		X:           x,
		Y:           y,
	}, nil
}

func (s *ProjectService) UpdateProject(id string, name, description, compose string, x, y float64) (*Project, error) {
	// 1. Fetch existing
	current, err := s.LoadProject(id)
	if err != nil {
		return nil, err
	}

	// 2. Prepare updates
	if name != "" {
		current.Name = name
	}
	if description != "" {
		current.Description = description
	}
	if compose != "" {
		// Verify YAML
		var tmp interface{}
		if err := yaml.Unmarshal([]byte(compose), &tmp); err != nil {
			return nil, err
		}
		current.Compose = compose
	}
	current.X = x
	current.Y = y
	current.UpdatedAt = time.Now()

	// 3. Exec SQL
	_, err = s.db.Exec(`
		UPDATE projects 
		SET name=$2, description=$3, compose=$4, host_path=$5, x=$6, y=$7, updated_at=$8
		WHERE id=$1`,
		current.ID, current.Name, current.Description, current.Compose, current.HostPath, current.X, current.Y, current.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return current, nil
}

func (s *ProjectService) DeleteProject(id string) error {
	res, err := s.db.Exec("DELETE FROM projects WHERE id = $1", id)
	if err != nil {
		return err
	}
	count, _ := res.RowsAffected()
	if count == 0 {
		return fmt.Errorf("project not found")
	}
	return nil
}

// Materialize writes files to disk. If HostPath is set, it returns the directory of HostPath.
func (s *ProjectService) Materialize(id, baseDir string) (string, error) {
	project, err := s.LoadProject(id)
	if err != nil {
		return "", err
	}

	// If project has an external host path, just return its directory
	if project.HostPath != "" {
		return filepath.Dir(project.HostPath), nil
	}

	// Internal project: materialize to baseDir/id
	pDir := filepath.Join(baseDir, project.ID)
	if err := os.MkdirAll(pDir, 0755); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(pDir, "docker-compose.yml"), []byte(project.Compose), 0644); err != nil {
		return "", err
	}

	return pDir, nil
}

func (s *ProjectService) CreateGroup(name, description string, projectIds []string, x, y float64) (*Project, error) {
	includes := []string{}
	for _, pid := range projectIds {
		if _, err := s.LoadProject(pid); err == nil {
			includes = append(includes, fmt.Sprintf("../%s/docker-compose.yml", pid))
		}
	}

	composeMap := map[string]interface{}{
		"include":  includes,
		"services": map[string]interface{}{},
	}

	composeBytes, err := yaml.Marshal(composeMap)
	if err != nil {
		return nil, fmt.Errorf("failed to generate group yaml: %w", err)
	}

	return s.CreateProject(name, description, string(composeBytes), x, y)
}

func (s *ProjectService) AddProjectToGroup(parentId, childId string) (*Project, error) {
	parent, err := s.LoadProject(parentId)
	if err != nil {
		return nil, fmt.Errorf("parent project not found: %w", err)
	}
	child, err := s.LoadProject(childId)
	if err != nil {
		return nil, fmt.Errorf("child project not found: %w", err)
	}

	var doc map[string]interface{}
	if err := yaml.Unmarshal([]byte(parent.Compose), &doc); err != nil {
		return nil, fmt.Errorf("failed to parse parent yaml: %w", err)
	}

	includes := []interface{}{}
	if existing, ok := doc["include"]; ok {
		if list, ok := existing.([]interface{}); ok {
			includes = list
		}
	}

	childPath := fmt.Sprintf("../%s/docker-compose.yml", child.ID)
	for _, inc := range includes {
		if str, ok := inc.(string); ok && str == childPath {
			return nil, fmt.Errorf("project is already in this group")
		}
	}

	includes = append(includes, childPath)
	doc["include"] = includes

	newBytes, err := yaml.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated yaml: %w", err)
	}

	return s.UpdateProject(parentId, "", "", string(newBytes), parent.X, parent.Y)
}
