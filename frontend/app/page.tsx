'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import NewProjectModal from '@/components/NewProjectModal';
import LLMChat from '@/components/LLMChat';
import {
  Play,
  Square,
  Save,
  LayoutGrid,
  Code,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  FileCode,
  Layers,
} from 'lucide-react';
import WorkloadDetail from '@/components/WorkloadDetail';

// Dynamic imports for heavy components
const ComposeGraph = dynamic(() => import('@/components/ComposeGraph'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});
const YamlEditor = dynamic(() => import('@/components/YamlEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});

type ViewMode = 'graph' | 'editor';

export default function Home() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [editedCompose, setEditedCompose] = useState('');
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [allCategories, setAllCategories] = useState<Record<string, Record<string, string>>>({});
  const { projects, currentProject, liveContainers, selectedNodeId, isLiveMode, updateProject, deployProject, stopProject, loading, fetchProjects, fetchLiveContainers, setSelectedNodeId, setIsLiveMode } = useStore();

  useEffect(() => {
    fetchProjects();
    fetchLiveContainers();
  }, [fetchProjects, fetchLiveContainers]);

  // Polling for live status
  useEffect(() => {
    if (isLiveMode) {
      const interval = setInterval(fetchLiveContainers, 5000);
      return () => clearInterval(interval);
    }
  }, [isLiveMode, fetchLiveContainers]);

  useEffect(() => {
    if (currentProject) {
      setEditedCompose(currentProject.compose);
    }
  }, [currentProject]);

  // Automatically categorize all projects
  useEffect(() => {
    const fetchCategories = async () => {
      const newCategories: Record<string, Record<string, string>> = {};
      for (const project of projects) {
        if (allCategories[project.id]) continue;
        try {
          const res = await fetch('http://localhost:8080/api/llm/categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compose: project.compose }),
          });
          const data = await res.json();
          if (data.categories) {
            newCategories[project.id] = data.categories;
          }
        } catch (err) {
          console.error(`Failed to categorize ${project.name}:`, err);
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
      // Save first if there are changes
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

  const handleApplyLLMModification = (yaml: string) => {
    setEditedCompose(yaml);
    setViewMode('editor');
  };

  const hasChanges = currentProject && editedCompose !== currentProject.compose;

  return (
    <div className="flex h-screen bg-nier-beige">
      <Sidebar onNewProject={() => setShowNewProject(true)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentProject ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-nier-border bg-nier-paper/50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-nier-dark tracking-tight uppercase">{currentProject.name}</h2>
                {hasChanges && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-nier-accent/20 text-nier-accent font-bold uppercase tracking-widest">
                    Unsaved
                  </span>
                )}
                {deployStatus !== 'idle' && (
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${deployStatus === 'deploying' ? 'bg-nier-dark/10 text-nier-dark' :
                    deployStatus === 'success' ? 'bg-emerald-500/10 text-emerald-700' :
                      'bg-nier-accent/10 text-nier-accent'
                    }`}>
                    {deployStatus === 'deploying' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {deployStatus === 'success' && <CheckCircle className="w-3 h-3" />}
                    {deployStatus === 'error' && <XCircle className="w-3 h-3" />}
                    {statusMessage || (deployStatus === 'deploying' ? 'Working...' : '')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex items-center p-0.5 bg-nier-dark/5 border border-nier-border/30">
                  <button
                    onClick={() => setIsLiveMode(!isLiveMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all ${isLiveMode ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-nier-dark/5 text-nier-muted hover:text-nier-dark'}`}
                  >
                    {isLiveMode ? 'Live' : 'Manifest'}
                  </button>
                  <div className="w-px h-4 bg-nier-dark/10" />
                  <button
                    onClick={() => setViewMode('graph')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all ${viewMode === 'graph' ? 'bg-nier-dark text-nier-beige' : 'text-nier-muted hover:text-nier-dark'
                      }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Network
                  </button>
                  <button
                    onClick={() => setViewMode('editor')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-all ${viewMode === 'editor' ? 'bg-nier-dark text-nier-beige' : 'text-nier-muted hover:text-nier-dark'
                      }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Editor
                  </button>
                </div>

                <div className="w-px h-6 bg-nier-border/20" />

                {/* Actions */}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || loading}
                  className="flex items-center gap-2 px-4 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all disabled:opacity-30"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-nier-dark text-nier-beige text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-30"
                >
                  <Play className="w-3.5 h-3.5" />
                  Deploy
                </button>
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 border border-nier-accent text-nier-accent text-[11px] font-bold uppercase tracking-widest hover:bg-nier-accent hover:text-nier-beige transition-all disabled:opacity-30"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-0 overflow-hidden relative">
              {projects.length > 0 ? (
                <>
                  {viewMode === 'graph' && (
                    <div className="w-full h-full p-6">
                      <ComposeGraph
                        projects={projects}
                        categories={allCategories}
                        liveContainers={liveContainers}
                        isLiveMode={isLiveMode}
                        onNodeClick={setSelectedNodeId}
                      />
                    </div>
                  )}
                  {viewMode === 'editor' && currentProject && (
                    <div className="h-full p-4">
                      <YamlEditor
                        value={editedCompose}
                        onChange={setEditedCompose}
                      />
                    </div>
                  )}
                  {!currentProject && viewMode !== 'graph' && (
                    <div className="flex-1 flex items-center justify-center bg-nier-paper/20 italic text-nier-muted text-sm font-bold">
                      SELECT A PROJECT TO EDIT SOURCE CODE.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-lg px-6">
                    <div className="w-24 h-24 mx-auto mb-8 bg-nier-dark flex items-center justify-center p-6 shadow-xl">
                      <FileCode className="w-full h-full text-nier-beige" />
                    </div>
                    <h2 className="text-3xl font-bold text-nier-dark mb-4 tracking-tighter uppercase italic">Docker Nexus</h2>
                    <div className="h-0.5 w-16 bg-nier-accent mx-auto mb-6" />
                    <p className="text-nier-muted mb-10 text-sm leading-relaxed tracking-tight font-bold">
                      Docker orchestration system offline. Create a new project to establish stack synchronization.
                    </p>
                    <button
                      onClick={() => setShowNewProject(true)}
                      className="px-10 py-4 bg-nier-dark text-nier-beige text-xs font-bold uppercase tracking-[0.3em] hover:bg-nier-dark/90 transition-all border-b-4 border-nier-dark/20 shadow-lg"
                    >
                      New Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg px-6">
              <div className="w-24 h-24 mx-auto mb-8 bg-nier-dark flex items-center justify-center p-6">
                <FileCode className="w-full h-full text-nier-beige" />
              </div>
              <h2 className="text-3xl font-bold text-nier-dark mb-4 tracking-tighter uppercase">Docker Nexus</h2>
              <div className="h-0.5 w-16 bg-nier-accent mx-auto mb-6" />
              <p className="text-nier-muted mb-10 text-sm leading-relaxed tracking-tight">
                Systems integration in progress. Create Docker projects to visualize architecture and initiate AI-assisted modifications.
              </p>
              <button
                onClick={() => setShowNewProject(true)}
                className="px-10 py-4 bg-nier-dark text-nier-beige text-xs font-bold uppercase tracking-[0.2em] hover:bg-nier-dark/90 transition-all border-b-4 border-nier-dark/20"
              >
                Create New Project
              </button>
            </div>
          </div>
        )}
      </main>

      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
      />

      <div className="w-[400px] border-l-2 border-nier-dark bg-nier-beige hidden lg:flex flex-col">
        <LLMChat onApplyModification={handleApplyLLMModification} />
      </div>

      {selectedNodeId && <WorkloadDetail />}
    </div>
  );
}
