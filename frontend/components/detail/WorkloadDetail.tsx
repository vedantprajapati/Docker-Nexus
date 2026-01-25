'use client';

import { useStore } from '@/lib/store';
import {
    X,
    Box,
    Database,
    Globe,
    Terminal,
    Cpu,
    HardDrive,
    Activity,
    CheckCircle,
    AlertTriangle,
    Clock,
    Zap
} from 'lucide-react';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import LogsModal from '../modals/LogsModal';

const TerminalModal = dynamic(() => import('../modals/TerminalModal'), {
    ssr: false
});

export default function WorkloadDetail() {
    const { projects, selectedNodeId, setSelectedNodeId, liveContainers, isLiveMode, restartService } = useStore();
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [showTerminalModal, setShowTerminalModal] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [restartStatus, setRestartStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const detail = useMemo(() => {
        if (!selectedNodeId) return null;

        // selectedNodeId format: project-uuid-servicename
        const parts = selectedNodeId.split('-');
        if (parts.length < 3) return null;

        const serviceName = parts[parts.length - 1];
        const projectId = parts.slice(0, parts.length - 1).join('-');

        const project = projects.find(p => p.id === projectId);
        if (!project) return null;

        let config: any = null;
        try {
            const { parse } = require('yaml');
            const compose = parse(project.compose);
            config = compose?.services?.[serviceName];
        } catch (e) {
            console.error("Failed to parse compose in detail:", e);
        }

        const liveInfo = liveContainers?.find((c: any) =>
            c.names.some((cn: string) => cn.includes(serviceName) && cn.includes(projectId.split('-')[0])) ||
            c.labels?.['com.docker.compose.service'] === serviceName
        );

        return {
            serviceName,
            project,
            config,
            liveInfo
        };
    }, [selectedNodeId, projects, liveContainers]);

    if (!detail) return null;

    const { serviceName, project, config, liveInfo } = detail;
    const isRunning = liveInfo?.state === 'running';

    return (
        <div className="absolute right-0 top-0 h-full w-[400px] bg-nier-beige border-l-2 border-nier-dark shadow-[-10px_0px_30px_0px_rgba(0,0,0,0.1)] z-50 flex flex-col slide-in-right">
            {/* Header */}
            <div className="p-6 bg-nier-dark text-nier-beige flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-nier-beige">
                        <Box className="w-5 h-5 text-nier-dark" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm uppercase tracking-[0.2em]">{serviceName}</h2>
                        <p className="text-[10px] text-nier-beige/60 uppercase font-bold tracking-widest">{project.name}</p>
                    </div>
                </div>
                <button
                    onClick={() => setSelectedNodeId(null)}
                    className="p-2 hover:bg-nier-beige/10 transition-all"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status Card */}
                <div className={`p-4 border-2 ${isRunning ? 'border-nier-dark' : 'border-nier-muted/30'} bg-nier-paper/50`}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-nier-muted uppercase tracking-widest">Live Status</span>
                        {isRunning ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-900/10 text-green-700 border border-green-700/30">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Online</span>
                            </div>
                        ) : restartStatus === 'success' ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-900/10 text-emerald-700 border border-emerald-700/30">
                                <Zap className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Restarted</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-nier-muted/10 text-nier-muted border border-nier-muted/30">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Offline</span>
                            </div>
                        )}
                    </div>

                    {isRunning && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-nier-muted/60 uppercase">Container ID</p>
                                <p className="text-xs font-mono font-bold text-nier-dark">{liveInfo.id.substring(0, 12)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-bold text-nier-muted/60 uppercase">IP Address</p>
                                <p className="text-xs font-mono font-bold text-nier-dark">{liveInfo.ip || 'Localhost'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Configuration */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-nier-dark uppercase tracking-[0.2em] flex items-center gap-2 border-b border-nier-dark/10 pb-2">
                        <Database className="w-4 h-4" />
                        Configuration
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold text-nier-muted uppercase">Image</span>
                            <span className="text-xs font-bold text-nier-dark italic text-right break-all ml-4">{config?.image || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-nier-muted uppercase">Restart Policy</span>
                            <span className="text-xs font-bold text-nier-dark">{config?.restart || 'no'}</span>
                        </div>
                        {config?.ports && (
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-nier-muted uppercase">Port Mappings</span>
                                <div className="flex flex-wrap gap-2">
                                    {config.ports.map((p: string, i: number) => (
                                        <div key={i} className="px-2 py-1 bg-nier-dark/5 border border-nier-dark/10 text-[10px] font-bold text-nier-dark">
                                            {p}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Operational Limits */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-nier-dark uppercase tracking-[0.2em] flex items-center gap-2 border-b border-nier-dark/10 pb-2">
                        <Cpu className="w-4 h-4" />
                        Resources
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                        <div className="p-3 bg-nier-dark/5 border border-nier-dark/10">
                            <p className="text-nier-muted/60 mb-1">CPU Limit</p>
                            <p className="text-nier-dark">{config?.deploy?.resources?.limits?.cpus || 'Unlimited'}</p>
                        </div>
                        <div className="p-3 bg-nier-dark/5 border border-nier-dark/10">
                            <p className="text-nier-muted/60 mb-1">MEM Limit</p>
                            <p className="text-nier-dark">{config?.deploy?.resources?.limits?.memory || 'Unlimited'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-nier-dark/10 bg-nier-paper/30 space-y-3">
                <button
                    disabled={!isRunning}
                    onClick={() => setShowTerminalModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-nier-dark text-nier-beige text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all disabled:opacity-30"
                >
                    <Terminal className="w-4 h-4" />
                    Console Access
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setShowLogsModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 border border-nier-dark text-nier-dark text-[10px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Logs
                    </button>
                    <button
                        onClick={async () => {
                            setIsRestarting(true);
                            setRestartStatus('idle');
                            try {
                                await restartService(project.id, serviceName);
                                setRestartStatus('success');
                                setTimeout(() => setRestartStatus('idle'), 5000);
                            } catch (err) {
                                setRestartStatus('error');
                                alert(`Failed to restart: ${(err as Error).message}`);
                            } finally {
                                setIsRestarting(false);
                            }
                        }}
                        disabled={isRestarting}
                        className="flex items-center justify-center gap-2 px-4 py-3 border border-nier-dark text-nier-dark text-[10px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all disabled:opacity-50"
                    >
                        {isRestarting ? (
                            <Activity className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Zap className="w-3.5 h-3.5" />
                        )}
                        {isRestarting ? 'Restarting...' : 'Restart'}
                    </button>
                </div>
            </div>

            {/* Logs Modal */}
            {showLogsModal && (
                <LogsModal
                    isOpen={showLogsModal}
                    projectId={project.id}
                    serviceName={serviceName}
                    onClose={() => setShowLogsModal(false)}
                />
            )}
            {/* Terminal Modal */}
            {showTerminalModal && (
                <TerminalModal
                    isOpen={showTerminalModal}
                    projectId={project.id}
                    serviceName={serviceName}
                    onClose={() => setShowTerminalModal(false)}
                />
            )}
        </div>
    );
}
