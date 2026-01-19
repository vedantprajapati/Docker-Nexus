'use client';

import { useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
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
import { parse } from 'yaml';
import { Project, ComposeFile } from '@/lib/types';
import { useStore } from '@/lib/store';
import {
    Box,
    Database,
    Globe,
    HardDrive,
    Network,
    Layers,
    ZoomIn,
    Edit2,
} from 'lucide-react';

interface ComposeGraphProps {
    projects: Project[];
    categories?: Record<string, Record<string, string>>; // projectId -> serviceName -> category
    liveContainers?: any[];
    isLiveMode?: boolean;
    onNodeClick?: (id: string) => void;
}

// Custom node component for services with NieR styling
function ServiceNode({ data }: NodeProps) {
    const replicas = data.config?.deploy?.replicas || 1;

    return (
        <div className="bg-nier-beige border-2 border-nier-dark p-4 shadow-[4px_4px_0px_0px_rgba(69,65,56,0.2)] min-w-[220px] group transition-all hover:shadow-[6px_6px_0px_0px_rgba(69,65,56,0.3)]">
            <Handle type="target" position={Position.Top} className="!bg-nier-dark !rounded-none !w-3 !h-1" />

            <div className="flex items-center justify-between mb-3 border-b border-nier-dark/20 pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-nier-dark">
                        <Box className="w-4 h-4 text-nier-beige" />
                    </div>
                    <span className="font-bold text-nier-dark text-sm uppercase tracking-tight">{data.label}</span>
                </div>
                {replicas > 1 && (
                    <div className="flex items-center gap-1 bg-nier-accent/10 px-1.5 py-0.5 border border-nier-accent/30">
                        <Layers className="w-3 h-3 text-nier-accent" />
                        <span className="text-[10px] font-bold text-nier-accent italic">x{replicas}</span>
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                {data.image && (
                    <div className="text-[10px] text-nier-muted flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Database className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{data.image}</span>
                    </div>
                )}

                {data.ports && data.ports.length > 0 && (
                    <div className="text-[10px] text-nier-dark flex items-center gap-2 font-bold uppercase tracking-wider">
                        <Globe className="w-3 h-3" />
                        <span>{data.ports.join(', ')}</span>
                    </div>
                )}

                {data.category && (
                    <div className="mt-2 pt-2 border-t border-nier-dark/10 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-nier-muted/60 uppercase tracking-[0.2em]">{data.category}</span>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-nier-dark !rounded-none !w-3 !h-1" />
        </div>
    );
}

// Custom Project Group Node
function ProjectGroupNode({ data }: NodeProps) {
    const { updateProject } = useStore();

    const handleRename = () => {
        const newName = prompt('Enter new project name:', data.label);
        if (newName && newName !== data.label) {
            updateProject(data.id, { name: newName });
        }
    };

    return (
        <div className="w-full h-full border-2 border-dashed border-nier-dark/30 bg-nier-paper/20 p-4 project-drag-handle cursor-move">
            <div className="absolute -top-7 left-0 flex items-center gap-2">
                <div className="px-3 py-1 bg-nier-dark text-nier-beige text-[10px] font-bold uppercase tracking-[0.2em]">
                    Project: {data.label}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleRename();
                    }}
                    className="p-1 px-2 bg-nier-beige border border-nier-dark text-nier-dark hover:bg-nier-dark hover:text-nier-beige transition-all shadow-sm"
                    title="Rename Project"
                >
                    <Edit2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

const nodeTypes = {
    service: ServiceNode,
    projectGroup: ProjectGroupNode,
};

export default function ComposeGraph({ projects, categories, liveContainers, isLiveMode, onNodeClick }: ComposeGraphProps) {
    const rfInstance = useRef<ReactFlowInstance | null>(null);

    const { nodes, edges } = useMemo(() => {
        const allNodes: Node[] = [];
        const allEdges: Edge[] = [];

        let cumulativeX = 0;
        const projectGap = 100;

        projects.forEach((project, pIndex) => {
            try {
                const compose = parse(project.compose) as ComposeFile;
                if (!compose?.services) return;

                const services = Object.entries(compose.services);
                const projectNodeId = `project-${project.id}`;

                // Calculate size based on services
                const cols = Math.ceil(Math.sqrt(services.length));
                const rows = Math.ceil(services.length / cols);
                const groupWidth = cols * 300 + 100;
                const groupHeight = rows * 200 + 100;

                // Use saved position if available, otherwise cumulative auto-layout
                const initialX = (project.x === 0 && project.y === 0) ? cumulativeX : project.x;
                const initialY = project.y;

                allNodes.push({
                    id: projectNodeId,
                    type: 'projectGroup',
                    data: { label: project.name, id: project.id }, // Pass id for updates
                    position: { x: initialX, y: initialY },
                    style: { width: groupWidth, height: groupHeight },
                    dragHandle: '.project-drag-handle',
                });

                services.forEach(([name, config], index) => {
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    const serviceId = `${project.id}-${name}`;

                    const projectCategories = categories?.[project.id] || {};
                    const category = projectCategories[name] || 'Other';

                    // Find live status
                    const liveInfo = liveContainers?.find((c: any) =>
                        c.names.some((cn: string) => cn.includes(name) && cn.includes(project.id.split('-')[0])) ||
                        c.labels?.['com.docker.compose.service'] === name
                    );

                    allNodes.push({
                        id: serviceId,
                        type: 'service',
                        parentNode: projectNodeId,
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
                        },
                    });

                    // Edges (Internal to project)
                    let dependsOn: string[] = [];
                    if (Array.isArray(config.depends_on)) dependsOn = config.depends_on;
                    else if (config.depends_on) dependsOn = Object.keys(config.depends_on);

                    dependsOn.forEach((dep) => {
                        allEdges.push({
                            id: `${project.id}-${dep}-${name}`,
                            source: `${project.id}-${dep}`,
                            target: serviceId,
                            animated: true,
                            style: { stroke: '#454138', strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#454138' },
                        });
                    });
                });

                if (project.x === 0 && project.y === 0) {
                    cumulativeX += groupWidth + projectGap;
                }
            } catch (err) {
                console.error(`Error parsing project ${project.name}:`, err);
            }
        });

        return { nodes: allNodes, edges: allEdges };
    }, [projects, categories, liveContainers, isLiveMode]);

    const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
    const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

    useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [nodes, edges, setNodes, setEdges]);

    const onFitView = useCallback(() => {
        rfInstance.current?.fitView({ padding: 0.2, duration: 800 });
    }, []);

    const handleNodeClick = useCallback((_: any, node: Node) => {
        onNodeClick?.(node.id);
        if (node.id.startsWith('project-')) {
            rfInstance.current?.fitBounds({
                x: node.position.x,
                y: node.position.y,
                width: Number(node.style?.width) || 500,
                height: Number(node.style?.height) || 500,
            }, { padding: 0.2, duration: 800 });
        } else {
            rfInstance.current?.setCenter(
                node.position.x + 110,
                node.position.y + 75,
                { zoom: 1.5, duration: 800 }
            );
        }
    }, []);

    return (
        <div className="w-full h-full bg-nier-beige border border-nier-border relative group shadow-inner">
            <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeDragStop={(evt, node) => {
                    if (node.type === 'projectGroup') {
                        const projectId = (node.data as any).id;
                        if (projectId) {
                            const { updateProject } = useStore.getState();
                            updateProject(projectId, { x: node.position.x, y: node.position.y });
                        }
                    }
                }}
                onInit={(instance) => { rfInstance.current = instance; }}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#454138" gap={30} size={1} variant={BackgroundVariant.Dots} className="opacity-5" />
                <Controls className="!bg-nier-paper !border-nier-dark !rounded-none shadow-sm [&>button]:!bg-transparent [&>button]:!border-nier-dark/10 [&>button:hover]:!bg-nier-dark/5" />

                <Panel position="top-right" className="flex gap-2">
                    <button
                        onClick={onFitView}
                        className="bg-nier-dark text-nier-beige p-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all border-b-2 border-nier-dark/20"
                    >
                        <ZoomIn size={14} />
                        Strategic Map
                    </button>
                </Panel>

                <MiniMap
                    className="!bg-nier-paper !border-nier-dark !rounded-none"
                    nodeColor={(n) => n.type === 'projectGroup' ? '#454138' : '#BAB5A1'}
                    maskColor="rgba(186, 181, 161, 0.4)"
                />
            </ReactFlow>
        </div>
    );
}
