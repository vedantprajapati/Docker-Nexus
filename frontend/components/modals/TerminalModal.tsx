'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { X, Terminal as TerminalIcon } from 'lucide-react';
import 'xterm/css/xterm.css';

interface TerminalModalProps {
    isOpen: boolean;
    projectId: string;
    serviceName: string;
    onClose: () => void;
}

export default function TerminalModal({ isOpen, projectId, serviceName, onClose }: TerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const xtermRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        // Small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            if (!terminalRef.current) return;

            // Initialize xterm
            const term = new Terminal({
                cursorBlink: true,
                theme: {
                    background: '#1d1d1d',
                    foreground: '#d4d4d4',
                    cursor: '#d4d4d4',
                },
                fontSize: 12,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            term.open(terminalRef.current);
            fitAddon.fit();
            xtermRef.current = term;

            // Connect to WebSocket
            // Convert HTTP API URL to WS URL
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const wsUrl = apiUrl.replace(/^http/, 'ws') + `/api/projects/${projectId}/terminal?service=${serviceName}`;

            term.writeln(`Connecting to terminal for ${serviceName}...`);
            term.writeln(`Endpoint: ${wsUrl}`);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                term.writeln('\r\n\x1b[32mConnected!\x1b[0m\r\n');
                term.focus();
                // Send a ready signal or resize if needed
                ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
            };

            ws.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    term.write(event.data);
                } else {
                    // Handle binary data if needed
                    const reader = new FileReader();
                    reader.onload = () => {
                        term.write(new Uint8Array(reader.result as ArrayBuffer));
                    };
                    reader.readAsArrayBuffer(event.data);
                }
            };

            ws.onerror = (error) => {
                term.writeln('\r\n\x1b[31mConnection error.\x1b[0m\r\n');
                console.error('WebSocket error:', error);
            };

            ws.onclose = (event) => {
                term.writeln(`\r\n\x1b[33mConnection closed (Code: ${event.code}).\x1b[0m\r\n`);
            };

            // Send input to server
            term.onData((data: string) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'input', data }));
                }
            });

            // Handle Resize
            const handleResize = () => {
                fitAddon.fit();
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                }
            };

            window.addEventListener('resize', handleResize);

            // Cleanup
            return () => {
                window.removeEventListener('resize', handleResize);
                ws.close();
                term.dispose();
            };

        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, projectId, serviceName]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={onClose}>
            <div
                className="bg-nier-dark border-4 border-nier-beige w-[90%] max-w-5xl h-[80%] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 bg-nier-beige text-nier-dark flex items-center justify-between border-b-4 border-nier-beige">
                    <div className="flex items-center gap-3">
                        <TerminalIcon className="w-5 h-5" />
                        <div>
                            <h2 className="font-bold text-sm uppercase tracking-[0.2em]">Console Access</h2>
                            <p className="text-[10px] text-nier-dark/60 uppercase font-bold tracking-widest">{serviceName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-nier-dark/10 transition-all font-bold"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Terminal Container */}
                <div className="flex-1 p-2 bg-[#1d1d1d] overflow-hidden relative">
                    <div ref={terminalRef} className="absolute inset-2" />
                </div>
            </div>
        </div>,
        document.body
    );
}
