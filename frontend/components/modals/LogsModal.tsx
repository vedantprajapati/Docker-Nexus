'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/store';

interface LogsModalProps {
    isOpen: boolean;
    projectId: string;
    serviceName: string;
    onClose: () => void;
}

export default function LogsModal({ isOpen, projectId, serviceName, onClose }: LogsModalProps) {
    const { getProjectLogs } = useStore();
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const [tail, setTail] = useState('100');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const logData = await getProjectLogs(projectId, serviceName, tail);
            setLogs(logData);
        } catch (err) {
            setLogs(`Error fetching logs: ${(err as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
        }
    }, [isOpen, projectId, serviceName, tail]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="bg-nier-beige border-4 border-nier-dark w-[90%] max-w-4xl h-[80%] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 bg-nier-dark text-nier-beige flex items-center justify-between border-b-4 border-nier-dark">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5" />
                        <div>
                            <h2 className="font-bold text-sm uppercase tracking-[0.2em]">Container Logs</h2>
                            <p className="text-[10px] text-nier-beige/60 uppercase font-bold tracking-widest">{serviceName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={tail}
                            onChange={(e) => setTail(e.target.value)}
                            className="px-3 py-1 bg-nier-beige text-nier-dark text-[10px] font-bold uppercase border-2 border-nier-beige"
                        >
                            <option value="50">Last 50 lines</option>
                            <option value="100">Last 100 lines</option>
                            <option value="200">Last 200 lines</option>
                            <option value="500">Last 500 lines</option>
                            <option value="1000">Last 1000 lines</option>
                        </select>
                        <button
                            onClick={fetchLogs}
                            disabled={loading}
                            className="p-2 hover:bg-nier-beige/10 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-nier-beige/10 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Logs Content */}
                <div className="flex-1 overflow-auto p-6 bg-nier-dark/95">
                    <pre className="text-xs font-mono text-nier-beige whitespace-pre-wrap break-words">
                        {loading ? 'Loading logs...' : logs || 'No logs available'}
                    </pre>
                </div>
            </div>
        </div>,
        document.body
    );
}
