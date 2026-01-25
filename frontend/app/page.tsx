'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/sidebar/Sidebar';
import NewProjectModal from '@/components/modals/NewProjectModal';
import {
  Loader2,
  FileCode,
} from 'lucide-react';
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
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [allCategories, setAllCategories] = useState<Record<string, Record<string, string>>>({});
  const graphRef = useRef<any>(null);
  const {
    projects,
    currentProject,
    isLiveMode,
    updateProject,
    deployProject,
    stopProject,
    loading,
    fetchProjects,
    fetchLiveContainers,
    setIsLiveMode,
    selectedNodeId,
    config
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
    } catch (e: any) {
      setYamlError(e.message || 'Unknown error');
    }
  }, [editedCompose]);

  // Automated categorization
  useEffect(() => {
    const fetchCategories = async () => {
      const newCategories: Record<string, Record<string, string>> = {};
      for (const project of projects) {
        if (allCategories[project.id] || (window as any)._failedCats?.[project.id]) continue;
        if (project.compose.includes('include:')) {
          newCategories[project.id] = {};
          continue;
        }

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
          const res = await fetch(`${apiUrl}/api/llm/categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compose: project.compose }),
          });

          if (!res.ok) throw new Error(`API error: ${res.status}`);

          const data = await res.json();
          newCategories[project.id] = data?.categories || {};
        } catch (err) {
          console.error(`Failed to categorize ${project.name}:`, err);
          if (!(window as any)._failedCats) (window as any)._failedCats = {};
          (window as any)._failedCats[project.id] = true;
          newCategories[project.id] = {};
        }
      }
      if (Object.keys(newCategories).length > 0) {
        setAllCategories(prev => ({ ...prev, ...newCategories }));
      }
    };

    if (projects.length > 0) {
      fetchCategories();
    }
  }, [projects, allCategories]);

  const handleSave = async () => {
    if (!currentProject) return;
    await updateProject(currentProject.id, { compose: editedCompose });
  };

  const handleDeploy = async () => {
    if (!currentProject) return;
    setDeployStatus('deploying');
    try {
      if (editedCompose !== currentProject.compose) {
        await updateProject(currentProject.id, { compose: editedCompose });
      }
      const result = await deployProject(currentProject.id);
      setDeployStatus('success');
      setStatusMessage(result.message);
      setTimeout(() => setDeployStatus('idle'), 3000);
    } catch (err) {
      setDeployStatus('error');
      setStatusMessage((err as Error).message);
      setTimeout(() => setDeployStatus('idle'), 5000);
    }
  };

  const handleStop = async () => {
    if (!currentProject) return;
    setDeployStatus('deploying');
    try {
      const result = await stopProject(currentProject.id);
      setDeployStatus('success');
      setStatusMessage(result.message);
      setTimeout(() => setDeployStatus('idle'), 3000);
    } catch (err) {
      setDeployStatus('error');
      setStatusMessage((err as Error).message);
      setTimeout(() => setDeployStatus('idle'), 5000);
    }
  };

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

      <main className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-300`}>
        <TopBar
          currentProject={currentProject}
          hasChanges={currentProject && editedCompose !== currentProject.compose}
          viewMode={viewMode}
          yamlError={yamlError}
          deployStatus={deployStatus}
          statusMessage={statusMessage}
          isLiveMode={isLiveMode}
          setIsLiveMode={setIsLiveMode}
          setViewMode={setViewMode}
          onFormatYaml={() => {
            try {
              const parsed = parse(editedCompose);
              setEditedCompose(stringify(parsed, { indent: 2 }));
            } catch (e) {
              alert('Invalid YAML');
            }
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
