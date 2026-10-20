'use client';

import { useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    BackgroundVariant,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    NodeProps,
    Handle,
    Position,
    ReactFlowInstance,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { parse, stringify } from 'yaml';
import { Project, ComposeFile } from '@/lib/types';
import { useStore } from '@/lib/store';
import {
    Box,
    Database,
    Globe,
    HardDrive,
    Network,
    Layers,
    Play,
    Square,
    Loader2,
    Palette,
    Edit2,
    Server,
    Activity,
    Terminal,
    Layout,
    Folder,
} from 'lucide-react';
import dagre from 'dagre';
import RenameModal from '@/components/ui/RenameModal';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface ComposeGraphProps {
    projects: Project[];
    categories?: Record<string, Record<string, string>>;
    liveContainers?: any[];
    isLiveMode?: boolean;
    onNodeClick?: (id: string) => void;
}

// ... (ServiceNode and ProjectGroupNode components remain mostly the same, will include them)
// Custom node component for services with NieR styling
function ServiceNode({ data }: NodeProps) {
    const replicas = data.config?.deploy?.replicas || 1;

    // Premium Category Map
    const categoryTheme = {
        'Frontend': { icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
        'Backend': { icon: Server, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
        'Database': { icon: Database, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        'Cache': { icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
        'Queue': { icon: Terminal, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
        'Other': { icon: Box, color: 'text-nier-dark', bg: 'bg-nier-dark/5', border: 'border-nier-dark/20' }
    };

    const theme = categoryTheme[data.category as keyof typeof categoryTheme] || categoryTheme['Other'];
    const Icon = theme.icon;

    return (
        <div className="bg-white/90 backdrop-blur-md border border-nier-dark p-0 shadow-[8px_8px_0px_0px_rgba(69,65,56,0.1)] min-w-[240px] group transition-all hover:shadow-[12px_12px_0px_0px_rgba(69,65,56,0.15)] overflow-hidden">
            <Handle type="target" position={Position.Top} className="!bg-nier-dark !rounded-none !w-3 !h-1" />

            <div className="flex items-center gap-3 p-4 border-b border-nier-dark/5">
                <div className={`p-2.5 ${theme.bg} ${theme.border} border shadow-sm transition-transform group-hover:scale-110`}>
                    <Icon className={`w-5 h-5 ${theme.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <span className="block font-black text-nier-dark text-sm uppercase tracking-tighter truncate leading-none mb-1">{data.label}</span>
                    <span className="block text-[8px] font-bold text-nier-muted/40 uppercase tracking-[0.2em]">{data.category || 'Service'}</span>
                </div>
                {replicas > 1 && (
                    <div className="flex items-center gap-1 bg-nier-dark text-nier-beige px-1.5 py-0.5">
                        <Layers className="w-2.5 h-2.5" />
                        <span className="text-[9px] font-bold">x{replicas}</span>
                    </div>
                )}
            </div>

            <div className="p-4 space-y-2.5">
                {data.image && (
                    <div className="text-[10px] text-nier-muted/80 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <HardDrive className="w-3.5 h-3.5 opacity-40" />
                        <span className="truncate max-w-[160px]">{data.image}</span>
                    </div>
                )}

                {data.ports && data.ports.length > 0 && (
                    <div className="text-[10px] text-nier-dark/90 flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Network className="w-3.5 h-3.5 opacity-40" />
                        <span>{data.ports.join(', ')}</span>
                    </div>
                )}

                <div className="pt-2 border-t border-nier-dark/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${data.liveStatus === 'running' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-rose-400 opacity-50'}`} />
                        <span className="text-[9px] font-bold text-nier-muted uppercase tracking-[0.2em]">
                            {data.liveStatus || 'Status Unknown'}
                        </span>
                    </div>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-nier-dark !rounded-none !w-3 !h-1" />
        </div>
    );
}

// Custom Project Group Node
function ProjectGroupNode({ data }: NodeProps) {
    const { updateProject, deployProject, stopProject, loading, liveContainers } = useStore();
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const colors = [
        { name: 'Accent', value: '#B25037' },
        { name: 'Orange', value: '#E67E22' },
        { name: 'Blue', value: '#4A90E2' },
        { name: 'Green', value: '#50C878' },
        { name: 'Purple', value: '#9B59B6' },
        { name: 'Red', value: '#E74C3C' },
        { name: 'Pink', value: '#EC407A' },
        { name: 'Teal', value: '#26A69A' },
    ];

    const currentColor = data.color || '#B25037'; // Default to NieR accent color

    const isRunning = useMemo(() => {
        return liveContainers.some((c: any) =>
            c.project === data.id && c.status?.toLowerCase().includes('running')
        );
    }, [liveContainers, data.id]);

    const handleRename = (newName: string) => {
        if (newName && newName !== data.label) {
            updateProject(data.id, { name: newName });
        }
        setShowRenameModal(false);
    };

    const handleDeploy = () => {
        deployProject(data.id).catch(console.error);
    };

    const handleStop = () => {
        stopProject(data.id).catch(console.error);
    };

    if (data.isParent) {
        return (
            <div className="flex items-center gap-3 p-3 bg-nier-beige border-2 border-dashed border-nier-dark shadow-[4px_4px_0px_0px_rgba(69,65,56,0.2)] min-w-[200px] cursor-pointer hover:bg-white transition-colors group">
                <Handle type="target" position={Position.Top} className="!bg-nier-dark !w-2 !h-2" />
                <Folder className="w-8 h-8 text-nier-dark fill-nier-dark/10" />
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-nier-dark uppercase tracking-widest leading-none mb-1">Group</span>
                    <span className="text-sm font-black text-nier-dark uppercase tracking-tighter truncate max-w-[150px]">{data.label}</span>
                </div>

                <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowRenameModal(true);
                        }}
                        className="p-1 bg-nier-dark text-nier-beige rounded-none hover:opacity-80"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={handleDeploy}
                        className="p-1 bg-nier-dark text-nier-beige rounded-none hover:opacity-80"
                    >
                        <Play className="w-3 h-3" />
                    </button>
                </div>
                <Handle type="source" position={Position.Bottom} className="!bg-nier-dark !w-2 !h-2" />

                <RenameModal
                    isOpen={showRenameModal}
                    currentName={data.label}
                    onClose={() => setShowRenameModal(false)}
                    onRename={handleRename}
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full p-4 relative transition-all" style={{
            border: `4px solid ${currentColor}40`,
            backgroundColor: `${currentColor}05`,
            minHeight: '100%',
        }}>
            <div className="absolute -top-4 left-4 flex items-center gap-2 z-50 project-drag-handle cursor-move">
                <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-nier-beige`} style={{
                    backgroundColor: currentColor,
                }}>
                    Project: {data.label}
                </div>
                {/* Actions */}
                <div className="flex bg-white border border-nier-dark">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowRenameModal(true);
                        }}
                        className="p-1 hover:bg-nier-dark hover:text-white transition-colors"
                        title="Rename"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeploy();
                        }}
                        disabled={loading}
                        className="p-1 hover:bg-nier-dark hover:text-white transition-colors"
                        title="Deploy"
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    </button>
                    {isRunning && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleStop();
                            }}
                            disabled={loading}
                            className="p-1 hover:bg-rose-500 hover:text-white transition-colors text-rose-600"
                            title="Stop"
                        >
                            <Square className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
            {/* Background Content */}
            <Handle type="target" position={Position.Top} className="!bg-nier-dark !w-3 !h-1 !rounded-none" />

            <RenameModal
                isOpen={showRenameModal}
                currentName={data.label}
                onClose={() => setShowRenameModal(false)}
                onRename={handleRename}
            />
        </div>
    );
}

const nodeTypes = {
    service: ServiceNode,
    projectGroup: ProjectGroupNode,
};

const ComposeGraph = forwardRef(({
    projects,
    categories,
    liveContainers,
    isLiveMode,
    onNodeClick,
}: ComposeGraphProps, ref: any) => {
    const rfInstance = useRef<ReactFlowInstance | null>(null);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
    const [pendingReq, setPendingReq] = useState<{
        sourceId: string;
        targetId: string;
        sourceName: string;
        targetName: string;
        type: 'create' | 'add';
        pos: { x: number, y: number };
    } | null>(null);

    useImperativeHandle(ref, () => ({
        fitView: () => {
            rfInstance.current?.fitView({ padding: 0.2, duration: 800 });
        },
        zoomToProject: (projectId: string) => {
            const node = rfInstance.current?.getNode(`project-${projectId}`);
            if (node) {
                rfInstance.current?.fitBounds({
                    x: node.position.x,
                    y: node.position.y,
                    width: Number(node.style?.width) || 500,
                    height: Number(node.style?.height) || 500,
                }, { padding: 0.2, duration: 800 });
            }
        }
    }));

    const handleConfirmAddToGroup = async () => {
        if (!pendingReq) return;
        const { sourceId, targetId } = pendingReq;
        const { projects, updateProject, fetchProjects } = useStore.getState();

        try {
            const tProj = projects.find(p => p.id === targetId);
            if (tProj) {
                const doc = parse(tProj.compose);
                if (!doc.include) doc.include = [];
                const path = `../${sourceId}/docker-compose.yml`;
                if (!doc.include.includes(path)) {
                    doc.include.push(path);
                    const newCompose = stringify(doc);
                    await updateProject(targetId, { compose: newCompose });
                    await fetchProjects();
                }
            }
        } catch (e: any) {
            console.error('Failed to add to group', e);
        }
        setShowAddToGroupModal(false);
        setPendingReq(null);
    };

    const handleCreateGroup = async (name: string) => {
        if (!pendingReq || !name) return;
        const { sourceId, targetId, pos } = pendingReq;
        const { createProject, fetchProjects } = useStore.getState();

        try {
            const yaml = `include:\n  - ../${sourceId}/docker-compose.yml\n  - ../${targetId}/docker-compose.yml\n\nservices: {}\n`;
            await createProject(name, 'Group', yaml, pos.x, pos.y); // Position support if needed
            await fetchProjects();
        } catch (e: any) { console.error(e) }

        setShowCreateGroupModal(false);
        setPendingReq(null);
    };

    const { nodes, edges } = useMemo(() => {
        const allNodes: Node[] = [];
        const allEdges: Edge[] = [];

        // 1. Build Maps
        const projectMap = new Map<string, Project>(projects.map(p => [p.id, p]));
        const childrenMap = new Map<string, string[]>();

        projects.forEach(project => {
            try {
                const doc = parse(project.compose);
                if (doc.include && Array.isArray(doc.include)) {
                    const children = doc.include.map((path: string) => {
                        const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                        return match ? match[1] : '';
                    }).filter(Boolean);
                    childrenMap.set(project.id, children);
                }
            } catch { }
        });

        // 2. Setup Dagre Graph
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 });
        g.setDefaultEdgeLabel(() => ({}));

        // 3. Add Nodes to Dagre
        projects.forEach(project => {
            const children = childrenMap.get(project.id) || [];
            const isParent = children.length > 0;

            let width = 250;
            let height = 100;

            if (!isParent) {
                // Calculate Leaf Project Size based on content
                try {
                    const doc = parse(project.compose) as ComposeFile;
                    if (doc?.services) {
                        const services = Object.keys(doc.services);
                        if (services.length > 0) {
                            const cols = Math.ceil(Math.sqrt(services.length));
                            const rows = Math.ceil(services.length / cols);
                            width = Math.max(300, cols * 300 + 100);
                            height = Math.max(200, rows * 200 + 100);
                        } else {
                            width = 300;
                            height = 200;
                        }
                    }
                } catch { }
            }

            g.setNode(project.id, { width, height, isParent });
        });

        // 4. Add Edges to Dagre
        childrenMap.forEach((children, parentId) => {
            children.forEach(childId => {
                // Verify child exists
                if (projectMap.has(childId)) {
                    g.setEdge(parentId, childId);
                }
            });
        });

        // 5. Run Layout
        dagre.layout(g);

        // 6. Generate ReactFlow Elements
        g.nodes().forEach((id: string) => {
            const nodeInfo = g.node(id) as any;
            const project = projectMap.get(id);
            if (!project) return;

            // Adjust position: Dagre gives center x/y, ReactFlow uses top-left
            // If project.x/y is set (dragged), use that?
            // Actually, keep Dagre's initial layout unless we want to support persistence of tree drags.
            // For now, let's force Dagre layout to ensure the tree looks correct initially.
            // If persistence is needed, we'd check if x/y are non-zero. But usually a tree layout recalculation is desired.

            const x = nodeInfo.x - nodeInfo.width / 2;
            const y = nodeInfo.y - nodeInfo.height / 2;

            allNodes.push({
                id: `project-${id}`,
                type: 'projectGroup',
                data: {
                    label: project.name,
                    id: project.id,
                    isParent: nodeInfo.isParent,
                    color: project.color,
                },
                position: { x, y },
                style: {
                    width: nodeInfo.width,
                    height: nodeInfo.height,
                },
                dragHandle: '.project-drag-handle',
                draggable: true,
            });

            // If it's a leaf, add internal services
            if (!nodeInfo.isParent) {
                try {
                    const compose = parse(project.compose) as ComposeFile;
                    if (compose?.services) {
                        const services = Object.entries(compose.services);
                        const cols = Math.ceil(Math.sqrt(services.length));
                        services.forEach(([name, config], index) => {
                            const row = Math.floor(index / cols);
                            const col = index % cols;
                            const serviceId = `${project.id}-${name}`;

                            const projectCategories = categories?.[project.id] || {};
                            let category = projectCategories[name];

                            if (!category || category === 'Other') {
                                const lowName = name.toLowerCase();
                                const lowImage = (config.image || '').toLowerCase();
                                if (/web|nginx|react|vue|angular|frontend|spa/i.test(lowName) || /nginx|apache|httpd/i.test(lowImage)) category = 'Frontend';
                                else if (/api|server|node|backend|go|python|php|ruby/i.test(lowName) || /node|python|golang|rust|java/i.test(lowImage)) category = 'Backend';
                                else if (/db|postgres|sql|mongo|mariadb|cockroach|db/i.test(lowName) || /postgres|mysql|mariadb|mongo|redis/i.test(lowImage)) category = 'Database';
                                else if (/redis|memcached|cache/i.test(lowName) || /redis|memcached/i.test(lowImage)) category = 'Cache';
                                else if (/queue|rabbit|kafka|nats/i.test(lowName) || /rabbitmq|kafka/i.test(lowImage)) category = 'Queue';
                                else category = 'Other';
                            }

                            const liveInfo = liveContainers?.find((c: any) =>
                                c.names.some((cn: string) => cn.includes(name) && cn.includes(project.id.split('-')[0]))
                            );

                            allNodes.push({
                                id: serviceId,
                                type: 'service',
                                parentNode: `project-${project.id}`,
                                extent: 'parent',
                                position: { x: 50 + col * 300, y: 50 + row * 200 },
                                data: {
                                    label: name,
                                    image: config.image,
                                    ports: config.ports,
                                    config: config,
                                    category: category,
                                    isLiveMode: isLiveMode,
                                    liveStatus: liveInfo?.state,
                                    project: project.id // Pass project ID for internal unique ID logic? Not needed for display.
                                },
                                zIndex: 10,
                            });

                            let dependsOn: string[] = [];
                            if (Array.isArray(config.depends_on)) dependsOn = config.depends_on;
                            else if (config.depends_on) dependsOn = Object.keys(config.depends_on);
                            dependsOn.forEach(dep => {
                                allEdges.push({
                                    id: `${project.id}-${dep}-${name}`,
                                    source: `${project.id}-${dep}`,
                                    target: serviceId,
                                    animated: true,
                                    style: { stroke: '#454138', strokeWidth: 2, strokeDasharray: '5,5' },
                                    markerEnd: { type: MarkerType.ArrowClosed, color: '#454138' },
                                });
                            });
                        });
                    }
                } catch { }
            }
        });

        // 7. Generate Hierarchy Edges (Group -> Project)
        g.edges().forEach((e: any) => {
            allEdges.push({
                id: `edge-${e.v}-${e.w}`,
                source: `project-${e.v}`,
                target: `project-${e.w}`,
                type: 'smoothstep',
                animated: false,
                style: { stroke: '#B25037', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#B25037' },
            });
        });

        return { nodes: allNodes, edges: allEdges };
    }, [projects, categories, liveContainers, isLiveMode]);

    const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
    const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

    useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [nodes, edges, setNodes, setEdges]);

    // ... (handleNodeClick etc mostly same)

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        onNodeClick?.(node.id);
        if (node.type === 'projectGroup' && node.id.startsWith('project-')) {
            // Zoom logic
            rfInstance.current?.fitBounds({
                x: node.position.x,
                y: node.position.y,
                width: Number(node.style?.width) || 500,
                height: Number(node.style?.height) || 500,
            }, { padding: 0.2, duration: 800 });
        }
    }, [onNodeClick]);

    return (
        <div
            className="w-full h-full bg-nier-beige border border-nier-border relative group shadow-inner"
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={async (e) => {
                e.preventDefault();
                const projectId = e.dataTransfer.getData('projectId');
                if (!projectId) return;

                const { projects: allProjects, updateProject } = useStore.getState();

                // Find parent group using parse
                const parentGroup = allProjects.find(p => {
                    try {
                        const doc = parse(p.compose);
                        if (doc.include && Array.isArray(doc.include)) {
                            const childIds = doc.include.map((path: string) => {
                                const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                                return match ? match[1] : '';
                            }).filter(Boolean);
                            return childIds.includes(projectId);
                        }
                    } catch { }
                    return false;
                });

                if (parentGroup) {
                    try {
                        const doc = parse(parentGroup.compose);
                        // Filter out the child
                        const targetPath = `../${projectId}/docker-compose.yml`;
                        doc.include = doc.include.filter((p: string) => p !== targetPath);
                        const newCompose = stringify(doc);
                        await updateProject(parentGroup.id, { compose: newCompose });
                    } catch (e) { console.error(e) }
                }
            }}
        >
            <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeDragStop={(evt, node) => {
                    if (node.type === 'projectGroup') {
                        const sourceProjectId = (node.data as any).id;
                        const isParent = (node.data as any).isParent;
                        if (!sourceProjectId) return;

                        const { updateProject, projects } = useStore.getState();

                        // Get all leaf descendants helper
                        const getLeafDescendants = (pid: string): string[] => {
                            const proj = projects.find(p => p.id === pid);
                            if (!proj) return [];
                            let leaves: string[] = [];

                            try {
                                const doc = parse(proj.compose);
                                if (doc.include && Array.isArray(doc.include)) {
                                    const children = doc.include.map((path: string) => {
                                        const match = path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/);
                                        return match ? match[1] : '';
                                    }).filter(Boolean);

                                    children.forEach((c: string) => {
                                        leaves = [...leaves, ...getLeafDescendants(c)];
                                    });
                                } else {
                                    // It's a leaf
                                    leaves.push(pid);
                                }
                            } catch { leaves.push(pid); } // Fallback
                            return leaves;
                        };

                        if (isParent) {
                            // It's a group, find all actual leaf projects and move them
                            // The group node itself will snap back on next render if we don't update children
                            // We calculate position delta
                            // Existing position is in node.position (where user dragged it)
                            // Old position was calculated in useMemo... hard to know exactly without tracking state
                            // But we can compare node.position with what we calculate for the group NOW based on store
                            // Actually, that logic is complex because 'store' is not yet updated.

                            // Simpler: We know the drag delta from the event? No.
                            // We have to calculate the old center of the children and compare matches.

                            // Alternative strategy:
                            // Re-calculate the group bounds based on CURRENT store projects.
                            const leafIds = getLeafDescendants(sourceProjectId);
                            let minX = Infinity, minY = Infinity;
                            leafIds.forEach(lid => {
                                const p = projects.find(prj => prj.id === lid);
                                if (p) {
                                    minX = Math.min(minX, p.x || 0);
                                    minY = Math.min(minY, p.y || 0);
                                }
                            });

                            if (minX !== Infinity) {
                                const padding = 80;
                                const oldX = minX - padding;
                                const oldY = minY - padding - 60;

                                const deltaX = node.position.x - oldX;
                                const deltaY = node.position.y - oldY;

                                leafIds.forEach(lid => {
                                    const p = projects.find(prj => prj.id === lid);
                                    if (p) {
                                        updateProject(lid, {
                                            x: (p.x || 0) + deltaX,
                                            y: (p.y || 0) + deltaY
                                        });
                                    }
                                });
                            }
                            return;
                        }

                        // Leaf Node Logic - Update Position
                        updateProject(sourceProjectId, { x: node.position.x, y: node.position.y });

                        // Check Ungrouping (drag outside parent)
                        const parentGroup = projects.find(p => {
                            try {
                                const doc = parse(p.compose);
                                if (doc.include && Array.isArray(doc.include)) {
                                    const childIds = doc.include.map((path: string) => {
                                        return path.match(/\.\.\/([\w-]+)\/docker-compose\.yml/)?.[1] || '';
                                    }).filter(Boolean);
                                    return childIds.includes(sourceProjectId);
                                }
                            } catch { }
                            return false;
                        });

                        if (parentGroup) {
                            const parentNode = flowNodes.find(n => n.id === `parent-group-${parentGroup.id}`);
                            if (parentNode) {
                                const pRect = {
                                    l: parentNode.position.x, t: parentNode.position.y,
                                    r: parentNode.position.x + (Number(parentNode.style?.width) || 0),
                                    b: parentNode.position.y + (Number(parentNode.style?.height) || 0)
                                };
                                const cCenter = {
                                    x: node.position.x + (Number(node.style?.width) || 0) / 2,
                                    y: node.position.y + (Number(node.style?.height) || 0) / 2
                                };

                                if (cCenter.x < pRect.l || cCenter.x > pRect.r || cCenter.y < pRect.t || cCenter.y > pRect.b) {
                                    // Ungroup
                                    try {
                                        const doc = parse(parentGroup.compose);
                                        const targetPath = `../${sourceProjectId}/docker-compose.yml`;
                                        doc.include = doc.include.filter((p: string) => p !== targetPath);
                                        const newCompose = stringify(doc);
                                        updateProject(parentGroup.id, { compose: newCompose });
                                    } catch (e: any) {
                                        console.error("Failed to update decomposition:", e);
                                    }
                                }
                            }
                        }

                        // Grouping Logic (Overlap)
                        const sourceRect = {
                            l: node.position.x, t: node.position.y,
                            r: node.position.x + (Number(node.style?.width) || 500),
                            b: node.position.y + (Number(node.style?.height) || 500)
                        };

                        const candidates = flowNodes.filter(n => {
                            if (n.id === node.id || n.type !== 'projectGroup') return false;

                            const tRect = {
                                l: n.position.x, t: n.position.y,
                                r: n.position.x + (Number(n.style?.width) || 500),
                                b: n.position.y + (Number(n.style?.height) || 500)
                            };

                            return !(sourceRect.r < tRect.l || sourceRect.l > tRect.r || sourceRect.b < tRect.t || sourceRect.t > tRect.b);
                        });

                        // Sort candidates by z-index descending (top-most first)
                        // Leaves (zIndex 0) should be prioritized over Parents (zIndex < 0)
                        // So if we drop on a leaf inside a group, we create a new group with that leaf
                        // If we drop on the group background, we add to the group
                        candidates.sort((a, b) => (Number(b.style?.zIndex) || 0) - (Number(a.style?.zIndex) || 0));

                        const targetNode = candidates[0];

                        if (targetNode) {
                            const tId = (targetNode.data as any).id;
                            const isTargetParent = (targetNode.data as any).isParent;
                            const sourceName = node.data.label;
                            const targetName = targetNode.data.label;

                            setPendingReq({
                                sourceId: sourceProjectId,
                                targetId: tId,
                                sourceName,
                                targetName,
                                type: isTargetParent ? 'add' : 'create',
                                pos: { x: node.position.x, y: node.position.y - 100 }
                            });

                            if (isTargetParent) {
                                setShowAddToGroupModal(true);
                            } else {
                                setShowCreateGroupModal(true);
                            }
                        }
                    }
                }}
                onInit={(instance) => {
                    rfInstance.current = instance;
                    setTimeout(() => instance.fitView({ padding: 0.5, duration: 800 }), 100);
                }}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#454138" gap={30} size={1} variant={BackgroundVariant.Dots} className="opacity-5" />
                <Controls className="!bg-nier-paper !border-nier-dark !rounded-none shadow-sm [&>button]:!bg-transparent [&>button]:!border-nier-dark/10 [&>button:hover]:!bg-nier-dark/5" />
                <Panel position="top-right" className="flex gap-2">
                    <button onClick={() => rfInstance.current?.fitView({ duration: 800 })} className="p-2 bg-nier-paper border border-nier-dark hover:bg-nier-dark hover:text-nier-beige transition-all"><Layout className="w-4 h-4" /></button>
                </Panel>
            </ReactFlow>

            <ConfirmModal
                isOpen={showAddToGroupModal}
                title="Add to Group"
                message={pendingReq ? `Add "${pendingReq.sourceName}" to existing group "${pendingReq.targetName}"?` : ''}
                confirmText="Add"
                onConfirm={handleConfirmAddToGroup}
                onCancel={() => { setShowAddToGroupModal(false); setPendingReq(null); }}
            />

            <RenameModal
                isOpen={showCreateGroupModal}
                title="Create Group"
                currentName={pendingReq ? `${pendingReq.sourceName} & ${pendingReq.targetName}` : ''}
                confirmText="Create Group"
                onRename={handleCreateGroup}
                onClose={() => { setShowCreateGroupModal(false); setPendingReq(null); }}
            />
        </div>
    );
});

ComposeGraph.displayName = 'ComposeGraph';
export default ComposeGraph;

