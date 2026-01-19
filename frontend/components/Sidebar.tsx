'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Project } from '@/lib/types';
import {
    Plus,
    Folder,
    Trash2,
    Play,
    Square,
    FileCode,
    ChevronRight,
} from 'lucide-react';

interface SidebarProps {
    onNewProject: () => void;
}

export default function Sidebar({ onNewProject }: SidebarProps) {
    const { projects, currentProject, fetchProjects, selectProject, deleteProject } = useStore();

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    return (
        <div className="w-72 h-full bg-nier-paper border-r border-nier-border flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-nier-border/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-nier-dark">
                        <FileCode className="w-6 h-6 text-nier-beige" />
                    </div>
                    <div>
                        <h1 className="font-bold text-nier-dark text-lg uppercase tracking-tight">Docker Nexus</h1>
                        <p className="text-[10px] text-nier-muted uppercase tracking-widest font-bold">Nexus Console</p>
                    </div>
                </div>

                <button
                    onClick={onNewProject}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-nier-dark text-nier-beige text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all border-b-2 border-nier-dark/20"
                >
                    <Plus className="w-4 h-4" />
                    New Project
                </button>
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="px-3 mb-2">
                    <p className="text-[10px] text-nier-muted font-bold uppercase tracking-[0.2em]">Projects</p>
                </div>
                {projects.length === 0 ? (
                    <div className="text-center py-10 text-nier-muted text-[11px] italic">
                        Empty project stack
                    </div>
                ) : (
                    <div className="space-y-1">
                        {projects.map((project) => (
                            <ProjectItem
                                key={project.id}
                                project={project}
                                isSelected={currentProject?.id === project.id}
                                onSelect={() => selectProject(project.id)}
                                onDelete={() => deleteProject(project.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ProjectItemProps {
    project: Project;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

function ProjectItem({ project, isSelected, onSelect, onDelete }: ProjectItemProps) {
    const [showActions, setShowActions] = useState(false);

    return (
        <div
            className={`group relative flex items-center gap-3 px-3 py-3 cursor-pointer transition-all ${isSelected
                ? 'bg-nier-dark text-nier-beige shadow-sm'
                : 'hover:bg-nier-dark/5 text-nier-dark'
                }`}
            onClick={onSelect}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <Folder className={`w-4 h-4 ${isSelected ? 'text-nier-beige' : 'text-nier-muted'}`} />
            <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-wide truncate ${isSelected ? 'text-nier-beige' : 'text-nier-dark'}`}>
                    {project.name}
                </p>
            </div>

            {showActions && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className={`p-1 transition-colors ${isSelected ? 'hover:bg-nier-beige/20 text-nier-beige' : 'hover:bg-nier-accent/10 text-nier-muted hover:text-nier-accent'}`}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}

            {isSelected && !showActions && (
                <div className="w-1 h-3 bg-nier-accent animate-pulse" />
            )}
        </div>
    );
}
