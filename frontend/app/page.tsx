'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/sidebar/Sidebar';
import NewProjectModal from '@/components/modals/NewProjectModal';
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
  ChevronRight,
} from 'lucide-react';
import { parse, stringify } from 'yaml';
import WorkloadDetail from '@/components/detail/WorkloadDetail';

// Dynamic imports for heavy components
const ComposeGraph = dynamic(() => import('@/components/graph/ComposeGraph'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});
const YamlEditor = dynamic(() => import('@/components/editor/YamlEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});
const LLMChat = dynamic(() => import('@/components/chat/LLMChat'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});

type ViewMode = 'graph' | 'editor';

export default function Home() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [editedCompose, setEditedCompose] = useState('');
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [allCategories, setAllCategories] = useState<Record<string, Record<string, string>>>({});
  const graphRef = useRef<any>(null);
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
      setYamlError(e.message);
    }
  }, [editedCompose]);

  // Automatically categorize all projects
  useEffect(() => {
    const fetchCategories = async () => {
      const newCategories: Record<string, Record<string, string>> = {};
      const failedCategories: Record<string, boolean> = {};

      for (const project of projects) {
        if (allCategories[project.id] || (window as any)._failedCats?.[project.id]) continue;

        // Skip parent group projects (those with include directives)
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

          if (!res.ok) {
            throw new Error(`API returned ${res.status}`);
          }

          const data = await res.json();
          if (data && data.categories) {
            newCategories[project.id] = data.categories;
          } else {
            // Default if data format is unexpected
            newCategories[project.id] = {};
          }
        } catch (err) {
          console.error(`Failed to categorize ${project.name}:`, err);
          if (!(window as any)._failedCats) (window as any)._failedCats = {};
          (window as any)._failedCats[project.id] = true;
          // Use default categories if AI fails
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

  const [isChatExpanded, setIsChatExpanded] = useState(true);

  return (
    <div className="flex h-screen bg-nier-beige">
      <Sidebar
        onNewProject={() => setShowNewProject(true)}
        onTitleClick={() => graphRef.current?.fitView()}
        onProjectSelect={(id) => graphRef.current?.zoomToProject(id)}
      />

      <main
        className="flex-1 flex flex-col overflow-hidden relative"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const projectId = e.dataTransfer.getData('projectId');
          if (!projectId) return;

          const { projects: allProjects, updateProject } = useStore.getState();

          // Find parent group that contains this project
          const parentGroup = allProjects.find(p => {
            if (p.compose.includes('include:')) {
              const includeSection = p.compose.split('include:')[1]?.split('services:')[0] || '';
              const childIds = (includeSection.match(/\.\.\/([\w-]+)\/docker-compose\.yml/g) || []).map(inc => {
                const match = inc.match(/\.\.\/([\w-]+)\//);
                return match ? match[1] : '';
              }).filter(Boolean);
              return childIds.includes(projectId);
            }
            return false;
          });

          if (parentGroup) {
            // Remove from parent group
            const newCompose = parentGroup.compose.replace(
              new RegExp(`\\s*-\\s*\\.\\./${projectId}/docker-compose\\.yml\\n?`, 'g'),
              ''
            );
            await updateProject(parentGroup.id, { compose: newCompose });
          }
        }}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar for Graph/Projects */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-nier-border bg-nier-paper/50">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-nier-dark tracking-tight uppercase">
                {currentProject ? currentProject.name : 'Network Overview'}
              </h2>
              {hasChanges && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-nier-accent/20 text-nier-accent font-bold uppercase tracking-widest">
                  Unsaved
                </span>
              )}
              {viewMode === 'editor' && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${yamlError ? 'bg-rose-500/20 text-rose-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
                  Linting: {yamlError ? 'Error' : 'Valid'}
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

              {currentProject && viewMode === 'editor' && (
                <>
                  <div className="w-px h-6 bg-nier-border/20" />
                  <button
                    onClick={() => {
                      try {
                        const parsed = parse(editedCompose);
                        setEditedCompose(stringify(parsed, { indent: 2 }));
                      } catch (e) {
                        alert('Invalid YAML');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all"
                  >
                    Format
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || loading}
                    className="flex items-center gap-2 px-4 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all disabled:opacity-30"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-0 overflow-hidden relative">
            {projects.length > 0 ? (
              <>
                {viewMode === 'graph' && (
                  <div className="w-full h-full p-0">
                    <ComposeGraph
                      ref={graphRef}
                      projects={projects}
                      categories={allCategories}
                      liveContainers={liveContainers}
                      isLiveMode={isLiveMode}
                      onNodeClick={setSelectedNodeId}
                    />
                  </div>
                )}
                {viewMode === 'editor' && currentProject && (
                  <div className="h-full p-4 relative flex flex-col">
                    {yamlError && (
                      <div className="absolute top-8 right-8 z-30 max-w-sm bg-rose-900/90 text-rose-100 backdrop-blur-md border border-rose-500/50 p-4 shadow-2xl animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                          <div>
                            <h3 className="text-[10px] font-bold text-rose-200 uppercase tracking-[0.2em] mb-1">Strategic Error</h3>
                            <p className="text-[10px] text-rose-300 font-mono leading-relaxed">{yamlError}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <YamlEditor
                      value={editedCompose}
                      onChange={setEditedCompose}
                    />
                  </div>
                )}
                {viewMode === 'editor' && !currentProject && (
                  <div className="flex-1 flex items-center justify-center bg-nier-paper/20 italic text-nier-muted text-sm font-bold h-full">
                    SELECT A PROJECT TO EDIT SOURCE CODE.
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
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
        </div>

        {/* Floating Chat Tab Toggle */}
        <button
          onClick={() => setIsChatExpanded(!isChatExpanded)}
          className={`absolute bottom-1/2 translate-y-1/2 right-0 z-50 px-2 py-8 bg-nier-dark text-nier-beige transition-all duration-300 shadow-xl border-l-2 border-y-2 border-nier-accent hover:bg-nier-accent group ${isChatExpanded ? '-translate-x-[400px]' : ''
            }`}
        >
          <div className="flex flex-col items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] [writing-mode:vertical-lr] ${isChatExpanded ? 'rotate-180' : ''}`}>
              {isChatExpanded ? 'Close' : 'AI Nexus'}
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isChatExpanded ? 'rotate-0' : 'rotate-180'}`} />
          </div>
        </button>
      </main>

      <NewProjectModal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
      />

      {/* AI Sidebar Tab */}
      <div className={`fixed top-0 right-0 h-full transition-all duration-300 ease-in-out border-l-2 border-nier-dark bg-nier-beige flex flex-col z-40 shadow-2xl ${isChatExpanded ? 'w-[400px]' : 'w-0 overflow-hidden border-l-0'
        }`}>
        <div className="h-full w-[400px]">
          <LLMChat onApplyModification={handleApplyLLMModification} />
        </div>
      </div>

      {selectedNodeId && <WorkloadDetail />}
    </div>
  );
}
