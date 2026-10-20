'use client';

import { useEffect, useState } from 'react';
import { parse, stringify } from 'yaml';
import { useStore } from '@/lib/store';
import { Project } from '@/lib/types';
import {
    Plus,
    Folder,
    Trash2,
    Edit2,
    Settings,
    ChevronRight,
} from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import RenameModal from '@/components/ui/RenameModal';
import SettingsModal from '@/components/modals/SettingsModal';

interface SidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onNewProject: () => void;
    onTitleClick?: () => void;
    onProjectSelect?: (id: string) => void;
}

export default function Sidebar({
    isCollapsed,
    onToggleCollapse,
    onNewProject,
    onTitleClick,
    onProjectSelect
}: SidebarProps) {
    const { projects, currentProject, fetchProjects, selectProject, deleteProject, createProject, updateProject, config, fetchConfig } = useStore();
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [showNewGroupModal, setShowNewGroupModal] = useState(false);
    const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [pendingGroup, setPendingGroup] = useState<{ sourceId: string; targetId: string; sourceName: string; targetName: string } | null>(null);
    const [pendingAddToGroup, setPendingAddToGroup] = useState<{ sourceId: string; targetId: string; sourceName: string; targetName: string } | null>(null);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

    const toggleCollapse = (projectId: string) => {
        setCollapsedNodes((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    };

    useEffect(() => {
        fetchProjects();
        fetchConfig();
    }, [fetchProjects, fetchConfig]);

    const handleCreateGroup = async (sourceId: string, targetId: string) => {
        const sourceProject = projects.find((p: Project) => p.id === sourceId);
        const targetProject = projects.find((p: Project) => p.id === targetId);

        if (!sourceProject || !targetProject) return;

        // Check if target is already a group
        let isTargetGroup = false;
        try {
            const doc = parse(targetProject.compose);
            isTargetGroup = doc.include && Array.isArray(doc.include);
        } catch (e) {
            console.error("Failed to parse YAML for group check:", e);
        }

        if (isTargetGroup) {
            // Check if source is already in target group
            try {
                const doc = parse(targetProject.compose);
                const includes = doc.include || [];
                const alreadyIncluded = includes.some((path: string) => path.includes(`../${sourceId}/`));
                if (alreadyIncluded) {
                    console.log('Project already in group');
                    return;
                }
            } catch (e) {
                console.error("Failed to parse YAML for inclusion check:", e);
            }

            setPendingAddToGroup({
                sourceId,
                targetId,
                sourceName: sourceProject.name,
                targetName: targetProject.name
            });
            setShowAddToGroupModal(true);
            return;
        }

        // Check if they're already in the same group (parent check)
        const existingParent = projects.find((p: Project) => {
            if (p.compose.includes('include:')) {
                const includeSection = p.compose.split('include:')[1]?.split('services:')[0] || '';
                const childIds = (includeSection.match(/\.\.\/([\w-]+)\/docker-compose\.yml/g) || []).map((inc: string) => {
                    const match = inc.match(/\.\.\/([\w-]+)\//);
                    return match ? match[1] : '';
                }).filter(Boolean);
                return childIds.includes(sourceId) && childIds.includes(targetId);
            }
            return false;
        });

        if (existingParent) {
            console.log('Projects are already in the same group:', existingParent.name);
            return;
        }

        setPendingGroup({
            sourceId,
            targetId,
            sourceName: sourceProject.name,
            targetName: targetProject.name
        });
        setShowGroupModal(true);
    };

    const handleConfirmGroup = () => {
        setShowGroupModal(false);
        setShowGroupNameModal(true);
    };

    const handleConfirmAddToGroup = async () => {
        if (!pendingAddToGroup) return;
        const { sourceId, targetId } = pendingAddToGroup;
        const targetProject = projects.find((p: Project) => p.id === targetId);

        if (targetProject) {
            try {
                const doc = parse(targetProject.compose);
                if (!doc.include) doc.include = [];
                doc.include.push(`../${sourceId}/docker-compose.yml`);

                // Preserve services or comments if key
                const newCompose = stringify(doc);
                await updateProject(targetId, { compose: newCompose });
                await fetchProjects();
            } catch {
                console.error("Failed to add to group");
            }
        }
        setShowAddToGroupModal(false);
        setPendingAddToGroup(null);
    };

    const handleGroupNameSubmit = async (groupName: string) => {
        if (!pendingGroup) return;

        const { sourceId, targetId, sourceName, targetName } = pendingGroup;

        const groupYAML = `include:
  - ../${sourceId}/docker-compose.yml
  - ../${targetId}/docker-compose.yml

services: {}
`;
        await createProject(
            groupName,
            `Combined group: ${sourceName} + ${targetName}`,
            groupYAML
        );
        await fetchProjects();
        setShowGroupNameModal(false);
        setPendingGroup(null);
    };

    const handleNewGroup = async (groupName: string) => {
        if (groupName) {
            const groupYAML = `include:
  # Drag projects here to add them to this group

services: {}
`;
            await createProject(
                groupName,
                'Empty project group',
                groupYAML
            );
            await fetchProjects();
        }
        setShowNewGroupModal(false);
    };

    // Parse project hierarchy from include directives
    const getProjectHierarchy = () => {
        const hierarchy: Array<{ project: Project; children: string[]; level: number }> = [];
        const childProjectIds = new Set<string>();
        const parentMap = new Map<string, string>(); // childId -> parentId

        // First pass: identify all parent-child relationships
        projects.forEach((project: Project) => {
            try {
                const doc = parse(project.compose);
                if (doc.include && Array.isArray(doc.include)) {
                    const children = doc.include.map((path: string) => {
                        const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                        return match ? match[1] : '';
                    }).filter(Boolean);

                    children.forEach((childId: string) => {
                        childProjectIds.add(childId);
                        parentMap.set(childId, project.id);
                    });
                }
} catch (e) {
                console.error("Failed to parse YAML for hierarchy pass:", e);
            }
        });

        // Calculate level for each project
        const getLevel = (projectId: string, visited = new Set<string>()): number => {
            if (visited.has(projectId)) return 0; // Circular reference protection
            visited.add(projectId);

            const parentId = parentMap.get(projectId);
            if (!parentId) return 0; // Top level
            return 1 + getLevel(parentId, visited);
        };

        // Build hierarchy with correct levels
        projects.forEach((project: Project) => {
            const level = getLevel(project.id);

            // Only add top-level items (level 0) to the hierarchy
            // Children will be rendered recursively under their parents
            if (level === 0) {
                let children: string[] = [];
                try {
                    const doc = parse(project.compose);
                    if (doc.include && Array.isArray(doc.include)) {
                        children = doc.include.map((path: string) => {
                            const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                            return match ? match[1] : '';
                        }).filter(Boolean);
                    }
                } catch (e) {
                    console.error("Failed to parse YAML for child mapping:", e);
                }

                if (children.length > 0 || !childProjectIds.has(project.id)) {
                    // Add if it's a parent OR if it's not a child (top level standalone)
                    hierarchy.push({ project, children, level });
                }
            }
        });

        // Sort by level (should all be 0 now, but keep for consistency)
        return hierarchy.sort((a, b) => a.level - b.level);
    };

    const hierarchyItems = getProjectHierarchy();

    return (
        <div className={`h-full bg-nier-paper border-r border-nier-border flex flex-col transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-72'}`}>
            {/* Collapse Toggle */}
            <button
                onClick={onToggleCollapse}
                className="absolute -right-3 top-10 z-50 w-6 h-6 bg-nier-dark text-nier-beige border border-nier-border flex items-center justify-center hover:bg-nier-accent transition-colors"
            >
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
            </button>
            {/* Header */}
            <div
                className="p-6 border-b border-nier-border/50 transition-colors"
                onDragOver={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    e.currentTarget.classList.add('bg-nier-accent/10');
                }}
                onDragLeave={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-nier-accent/10');
                }}
                onDrop={async (e: React.DragEvent) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-nier-accent/10');
                    const projectId = e.dataTransfer.getData('projectId');
                    if (!projectId) return;

                    const parentGroup = projects.find((p: Project) => {
                        if (p.compose.includes('include:')) {
                            const includeSection = p.compose.split('include:')[1]?.split('services:')[0] || '';
                            const childIds = (includeSection.match(/\.\.\/([\w-]+)\/docker-compose\.yml/g) || []).map((inc: string) => {
                                const match = inc.match(/\.\.\/([\w-]+)\//);
                                return match ? match[1] : '';
                            }).filter(Boolean);
                            return childIds.includes(projectId);
                        }
                        return false;
                    });

                    if (parentGroup) {
                        try {
                            const doc = parse(parentGroup.compose);
                            if (doc.include && Array.isArray(doc.include)) {
                                const targetPath = `../${projectId}/docker-compose.yml`;
                                doc.include = doc.include.filter((path: string) => path !== targetPath);

                                const newCompose = stringify(doc);
                                await updateProject(parentGroup.id, { compose: newCompose });
                                console.log(`Ungrouped ${projectId} from ${parentGroup.name} to root (via Header drop)`);
                            }
                        } catch (err) {
                            console.error('Failed to ungroup project:', err);
                        }
                    }
                }}
            >
                <div
                    className={`flex items-center gap-3 mb-6 cursor-pointer group ${isCollapsed ? 'justify-center' : ''}`}
                    onClick={() => {
                        selectProject(''); // Deselect
                        onTitleClick?.();
                    }}
                >
                    <div className="w-10 h-10 relative group-hover:scale-105 transition-transform shrink-0">
                        <img src="/logo.png" alt="Docker Nexus" className="object-contain w-full h-full" />
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <h1 className="font-bold text-nier-dark text-lg uppercase tracking-tight group-hover:text-nier-accent transition-colors truncate">Docker Nexus</h1>
                            <p className="text-[10px] text-nier-muted uppercase tracking-widest font-bold">Nexus Console</p>
                        </div>
                    )}
                </div>

                <div className={`flex ${isCollapsed ? 'flex-col items-center' : 'flex-col'} gap-2`}>
                    <button
                        onClick={onNewProject}
                        disabled={Boolean(config && !config.features.editCompose)}
                        title="New Composition"
                        className={`flex items-center justify-center gap-2 px-3 py-3 bg-nier-dark text-nier-beige text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all border-b-2 border-nier-dark/20 disabled:opacity-50 disabled:cursor-not-allowed ${isCollapsed ? 'w-12 rounded-lg' : 'w-full'}`}
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        {!isCollapsed && "New Project"}
                    </button>
                    <button
                        onClick={() => setShowNewGroupModal(true)}
                        title="New Group"
                        className={`flex items-center justify-center gap-2 px-3 py-3 bg-nier-accent text-nier-beige text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all border-b-2 border-nier-accent/20 ${isCollapsed ? 'w-12 rounded-lg' : 'w-full'}`}
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        {!isCollapsed && "New Group"}
                    </button>
                </div>
            </div>

            {/* Project List */}
            <div
                className="flex-1 overflow-y-auto p-3 transition-colors"
                onDragOver={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    e.currentTarget.classList.add('bg-nier-dark/5');
                }}
                onDragLeave={(e: React.DragEvent) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-nier-dark/5');
                }}
                onDrop={async (e: React.DragEvent) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-nier-dark/5');
                    const projectId = e.dataTransfer.getData('projectId');
                    if (!projectId) return;

                    // Find parent group that contains this project
                    const parentGroup = projects.find((p: Project) => {
                        if (p.compose.includes('include:')) {
                            const includeSection = p.compose.split('include:')[1]?.split('services:')[0] || '';
                            const childIds = (includeSection.match(/\.\.\/([\w-]+)\/docker-compose\.yml/g) || []).map((inc: string) => {
                                const match = inc.match(/\.\.\/([\w-]+)\//);
                                return match ? match[1] : '';
                            }).filter(Boolean);
                            return childIds.includes(projectId);
                        }
                        return false;
                    });

                    if (parentGroup) {
                        // Remove from parent group (ungroup to root)
                        try {
                            const doc = parse(parentGroup.compose);
                            if (doc.include && Array.isArray(doc.include)) {
                                const targetPath = `../${projectId}/docker-compose.yml`;
                                doc.include = doc.include.filter((path: string) => path !== targetPath);

                                const newCompose = stringify(doc);
                                await updateProject(parentGroup.id, { compose: newCompose });
                                console.log(`Ungrouped ${projectId} from ${parentGroup.name} to root`);
                            }
                        } catch (err) {
                            console.error('Failed to ungroup project:', err);
                        }
                    }
                }}
            >
                {!isCollapsed && (
                    <div className="px-3 mb-2">
                        <p className="text-[10px] text-nier-muted font-bold uppercase tracking-[0.2em]">Compositions</p>
                    </div>
                )}
                {projects.length === 0 ? (
                    <div className="text-center py-10 text-nier-muted text-[11px] italic">
                        {!isCollapsed && "Empty composition library"}
                    </div>
                ) : (
                    <div className="space-y-1">
                        {hierarchyItems.map(({ project, children, level }) => {
                            // Recursive function to render a project and its children
                            const renderProject = (proj: Project, childIds: string[], lvl: number): JSX.Element => {
                                // Get children info for this project
                                const projChildren = childIds.map(childId => {
                                    const childProj = projects.find(p => p.id === childId);
                                    if (!childProj) return null;

                                    // Check if this child also has children
                                    let grandchildIds: string[] = [];
                                    try {
                                        const doc = parse(childProj.compose);
                                        if (doc.include && Array.isArray(doc.include)) {
                                            grandchildIds = doc.include.map((path: string) => {
                                                const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                                                return match ? match[1] : '';
                                            }).filter(Boolean);
                                        }
                                    } catch (e) {
                                        console.error("Failed to parse YAML for grandchild mapping:", e);
                                    }

                                    return { project: childProj, children: grandchildIds };
                                }).filter(Boolean) as Array<{ project: Project; children: string[] }>;

                                return (
                                    <div key={proj.id}>
                                        <ProjectItem
                                            project={proj}
                                            isSelected={currentProject?.id === proj.id}
                                            level={lvl}
                                            hasChildren={childIds.length > 0}
                                            isSidebarCollapsed={isCollapsed}
                                            onSelect={() => {
                                                selectProject(proj.id);
                                                onProjectSelect?.(proj.id);
                                            }}
                                            onDelete={() => deleteProject(proj.id)}
                                            onCreateGroup={handleCreateGroup}
                                            isCollapsed={collapsedNodes.has(proj.id)}
                                            onToggleCollapse={() => toggleCollapse(proj.id)}
                                        />
                                        {childIds.length > 0 && !collapsedNodes.has(proj.id) && !isCollapsed && (
                                            <div className="ml-4 border-l-2 border-nier-dark/10">
                                                {projChildren.map(({ project: childProj, children: grandchildIds }) =>
                                                    renderProject(childProj, grandchildIds, lvl + 1)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return renderProject(project, children, level);
                        })}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={showAddToGroupModal}
                title="Add to Group"
                message={pendingAddToGroup ? `Add "${pendingAddToGroup.sourceName}" to existing group "${pendingAddToGroup.targetName}"?` : ''}
                confirmText="Add to Group"
                onConfirm={handleConfirmAddToGroup}
                onCancel={() => {
                    setShowAddToGroupModal(false);
                    setPendingAddToGroup(null);
                }}
            />

            <ConfirmModal
                isOpen={showGroupModal}
                title="Create Composition Group"
                message={pendingGroup ? `Create a composition group including "${pendingGroup.sourceName}" and "${pendingGroup.targetName}"?` : ''}
                confirmText="Create Group"
                onConfirm={handleConfirmGroup}
                onCancel={() => {
                    setShowGroupModal(false);
                    setPendingGroup(null);
                }}
            />

            <RenameModal
                isOpen={showGroupNameModal}
                currentName={pendingGroup ? `${pendingGroup.sourceName} & ${pendingGroup.targetName} Group` : ''}
                title="Create Stack Composition"
                confirmText="Create"
                onClose={() => {
                    setShowGroupNameModal(false);
                    setPendingGroup(null);
                }}
                onRename={handleGroupNameSubmit}
            />

            <RenameModal
                isOpen={showNewGroupModal}
                currentName=""
                title="Create New Group"
                confirmText="Create"
                onClose={() => setShowNewGroupModal(false)}
                onRename={handleNewGroup}
            />

            <div className={`p-4 border-t border-nier-border/50 bg-nier-paper ${isCollapsed ? 'flex justify-center' : ''}`}>
                <button
                    onClick={() => setShowSettings(true)}
                    title="Settings"
                    className={`flex items-center gap-3 px-4 py-2 text-nier-muted hover:text-nier-dark hover:bg-nier-dark/5 rounded transition-all group ${isCollapsed ? 'justify-center w-12 h-12' : 'w-full'}`}
                >
                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500 shrink-0" />
                    {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>}
                </button>
            </div>

            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
}

interface ProjectItemProps {
    project: Project;
    isSelected: boolean;
    level: number;
    hasChildren: boolean;
    isSidebarCollapsed?: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onCreateGroup?: (sourceId: string, targetId: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

function ProjectItem({ project, isSelected, level, hasChildren, isSidebarCollapsed, onSelect, onDelete, onCreateGroup, isCollapsed, onToggleCollapse }: ProjectItemProps) {
    const [showActions, setShowActions] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const { updateProject } = useStore();

    const handleRename = (newName: string) => {
        if (newName && newName !== project.name) {
            updateProject(project.id, { name: newName });
        }
        setShowRenameModal(false);
    };

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('projectId', project.id);
        e.dataTransfer.setData('projectName', project.name);
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const sourceId = e.dataTransfer.getData('projectId');

        console.log('Drop detected:', { sourceId, targetId: project.id });

        if (sourceId && sourceId !== project.id) {
            // Check if this project (target) is a group
            let isGroup = false;
            try {
                const doc = parse(project.compose);
                isGroup = doc.include && Array.isArray(doc.include);
            } catch { }

            if (isGroup) {
                // Call parent to handle adding to existing group
                onCreateGroup?.(sourceId, project.id);
            } else {
                // Logic for creating NEW group
                onCreateGroup?.(sourceId, project.id);
            }
        }
    };

    const handleClick = (_e: React.MouseEvent) => {
        if (!isDragging) {
            onSelect();
        }
    };

    return (
        <div
            className={`group relative flex items-center gap-3 px-3 py-3 cursor-pointer transition-all ${isDragOver
                ? 'bg-nier-accent/20 border-l-4 border-nier-accent'
                : isSelected
                    ? 'bg-nier-dark text-nier-beige shadow-sm'
                    : 'hover:bg-nier-dark/5 text-nier-dark'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
            title={isSidebarCollapsed ? project.name : undefined}
        >
            {hasChildren && onToggleCollapse && !isSidebarCollapsed && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse();
                    }}
                    className={`p-1 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                >
                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-nier-beige' : 'text-nier-muted'}`} />
                </button>
            )}
            <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-nier-beige' : hasChildren ? 'text-nier-accent' : 'text-nier-muted'}`} />
            {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-wide truncate ${isSelected ? 'text-nier-beige' : 'text-nier-dark'}`}>
                        {level > 0 && <span className="text-nier-muted mr-1">└</span>}
                        {project.name}
                    </p>
                </div>
            )}

            {!isSidebarCollapsed && showActions && (
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowRenameModal(true);
                        }}
                        className={`p-1 transition-colors ${isSelected ? 'hover:bg-nier-beige/20 text-nier-beige' : 'hover:bg-nier-dark/10 text-nier-muted hover:text-nier-dark'}`}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className={`p-1 transition-colors ${isSelected ? 'hover:bg-nier-beige/20 text-nier-beige' : 'hover:bg-nier-accent/10 text-nier-muted hover:text-nier-accent'}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {isSelected && !showActions && (
                <div className="w-1 h-3 bg-nier-accent animate-pulse" />
            )}

            <RenameModal
                isOpen={showRenameModal}
                currentName={project.name}
                onClose={() => setShowRenameModal(false)}
                onRename={handleRename}
            />
        </div>
    );
}
