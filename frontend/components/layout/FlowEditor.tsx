'use client';

import { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, FileCode, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store';

const ComposeGraph = dynamic(() => import('@/components/graph/ComposeGraph'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});

const YamlEditor = dynamic(() => import('@/components/editor/YamlEditor'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});

interface FlowEditorProps {
    viewMode: 'graph' | 'editor';
    editedCompose: string;
    setEditedCompose: (val: string) => void;
    yamlError: string | null;
    allCategories: any;
    onShowNewProject: () => void;
}

const FlowEditor = forwardRef<any, FlowEditorProps>(({
    viewMode,
    editedCompose,
    setEditedCompose,
    yamlError,
    allCategories,
    onShowNewProject
}, ref) => {
    const { projects, currentProject, liveContainers, isLiveMode, setSelectedNodeId } = useStore();

    return (
        <div className="flex-1 p-0 overflow-hidden relative">
            {projects.length > 0 ? (
                <>
                    {viewMode === 'graph' && (
                        <div className="w-full h-full p-0">
                            <ComposeGraph
                                ref={ref}
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
                        <div className="flex-1 flex items-center justify-center bg-nier-paper/20 italic text-nier-muted text-sm font-bold h-full text-center p-8 uppercase tracking-widest leading-relaxed">
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
                            onClick={onShowNewProject}
                            className="px-10 py-4 bg-nier-dark text-nier-beige text-xs font-bold uppercase tracking-[0.3em] hover:bg-nier-dark/90 transition-all border-b-4 border-nier-dark/20 shadow-lg"
                        >
                            New Project
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

FlowEditor.displayName = 'FlowEditor';

export default FlowEditor;
