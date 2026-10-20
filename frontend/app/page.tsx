'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore, API_URL } from '@/lib/store';
import Sidebar from '@/components/sidebar/Sidebar';
import NewProjectModal from '@/components/modals/NewProjectModal';
import { parse, stringify } from 'yaml';
import WorkloadDetail from '@/components/detail/WorkloadDetail';

type ViewMode = 'graph' | 'editor';

import TopBar from '@/components/layout/TopBar';
import FlowEditor from '@/components/layout/FlowEditor';
import AINexusSidebar from '@/components/layout/AINexusSidebar';

export default function Home() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [editedCompose, setEditedCompose] = useState('');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Record<string, Record<string, string>>>({});
  const graphRef = useRef<any>(null);
  const {
    projects,
    currentProject,
    isLiveMode,
    updateProject,
    fetchProjects,
    fetchLiveContainers,
    setIsLiveMode,
    selectedNodeId,
  } = useStore();

  useEffect(() => {
    fetchProjects();
    fetchLiveContainers();
  }, [fetchProjects, fetchLiveContainers]);

  useEffect(() => {
    if (isLiveMode) {
      const interval = setInterval(fetchLiveContainers, 5000);
      return () => clearInterval(interval);
    }
  }, [isLiveMode, fetchLiveContainers]);

  useEffect(() => {
    if (currentProject) {
      setEditedCompose(currentProject.compose);
      setYamlError(null);
    }
  }, [currentProject]);

  useEffect(() => {
    if (!editedCompose) {
      setYamlError(null);
      return;
    }
    try {
      parse(editedCompose);
      setYamlError(null);
    } catch (e: unknown) {
      setYamlError((e as Error).message || 'Invalid YAML');
    }
  }, [editedCompose]);

  // Automated categorization
  useEffect(() => {
    let isCancelled = false;
    const fetchCategories = async () => {
      const newCategories: Record<string, Record<string, string>> = {};

      for (const project of projects) {
        if (allCategories[project.id]) continue;

        if (project.compose.includes('include:')) {
          newCategories[project.id] = {};
          continue;
        }

        try {
          const res = await fetch(`${API_URL}/llm/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compose: project.compose }),
          });

          if (res.ok) {
            const data = await res.json();
            newCategories[project.id] = data?.categories || {};
          } else {
            newCategories[project.id] = {};
          }
        } catch {
          newCategories[project.id] = {};
        }
      }

      if (!isCancelled && Object.keys(newCategories).length > 0) {
        setAllCategories(prev => ({ ...prev, ...newCategories }));
      }
    };

    if (projects.length > 0) {
      fetchCategories();
    }

    return () => {
      isCancelled = true;
    };
  }, [projects, allCategories]);

  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-nier-beige">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onNewProject={() => setShowNewProject(true)}
        onTitleClick={() => graphRef.current?.fitView()}
        onProjectSelect={(id) => graphRef.current?.zoomToProject(id)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative transition-all duration-300">
        <TopBar
          currentProject={currentProject}
          hasChanges={currentProject ? editedCompose !== currentProject.compose : false}
          viewMode={viewMode}
          yamlError={yamlError}
          isLiveMode={isLiveMode}
          setIsLiveMode={setIsLiveMode}
          setViewMode={setViewMode}
          onFormatYaml={() => {
            try {
              const parsed = parse(editedCompose);
              setEditedCompose(stringify(parsed, { indent: 2 }));
            } catch {
              alert('Invalid YAML');
            }
          }}
          onSave={async () => {
            if (!currentProject) return;
            await updateProject(currentProject.id, { compose: editedCompose });
          }}
        />

        <FlowEditor
          ref={graphRef}
          viewMode={viewMode}
          editedCompose={editedCompose}
          setEditedCompose={setEditedCompose}
          yamlError={yamlError}
          allCategories={allCategories}
          onShowNewProject={() => setShowNewProject(true)}
        />

        <AINexusSidebar
          isExpanded={isChatExpanded}
          onToggle={() => setIsChatExpanded(!isChatExpanded)}
          onApplyModification={(yaml) => {
            setEditedCompose(yaml);
            setViewMode('editor');
          }}
        />
      </main>

      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
      />

      {selectedNodeId && <WorkloadDetail />}
    </div>
  );
}
