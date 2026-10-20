'use client';

import {
    Loader2,
    CheckCircle,
    XCircle,
    LayoutGrid,
    Code,
    Save
} from 'lucide-react';

interface TopBarProps {
    currentProject: any;
    hasChanges: boolean;
    viewMode: 'graph' | 'editor';
    yamlError: string | null;
    deployStatus?: 'idle' | 'deploying' | 'success' | 'error';
    statusMessage?: string;
    isLiveMode: boolean;
    setIsLiveMode: (val: boolean) => void;
    setViewMode: (mode: 'graph' | 'editor') => void;
    onFormatYaml: () => void;
    onSave?: () => void;
}

export default function TopBar({
    currentProject,
    hasChanges,
    viewMode,
    yamlError,
    deployStatus = 'idle',
    statusMessage = '',
    isLiveMode,
    setIsLiveMode,
    setViewMode,
    onFormatYaml,
    onSave
}: TopBarProps) {
    return (
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
                            onClick={onFormatYaml}
                            className="flex items-center gap-2 px-4 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all"
                        >
                            Format YAML
                        </button>
                        {onSave && (
                            <button
                                onClick={onSave}
                                disabled={!hasChanges}
                                className="flex items-center gap-2 px-4 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all disabled:opacity-30"
                            >
                                <Save className="w-3.5 h-3.5" />
                                Save
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
