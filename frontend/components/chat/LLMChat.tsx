'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Sparkles, Loader2, Check } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    modifiedYaml?: string;
}

interface LLMChatProps {
    onApplyModification: (yaml: string) => void;
}

export default function LLMChat({ onApplyModification }: LLMChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Hi! I can help you modify your Docker Compose configuration. Try asking me things like:\n\n• \"Add a Redis cache service\"\n• \"Expose port 8080 on the backend\"\n• \"Add a healthcheck to the database\"\n• \"Set memory limit to 512MB for all services\"",
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { modifyWithLLM, currentProject } = useStore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !currentProject) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const modifiedYaml = await modifyWithLLM(userMessage);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: "I've modified your compose file based on your request. You can review the changes and apply them if they look good.",
                    modifiedYaml,
                },
            ]);
        } catch (err: any) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `Sorry, I encountered an error: ${err.message || 'Unknown error'}`,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-nier-paper border border-nier-border shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-nier-border/50">
                <div className="p-2 bg-nier-dark">
                    <Sparkles className="w-4 h-4 text-nier-beige" />
                </div>
                <div>
                    <h3 className="font-bold text-nier-dark text-sm uppercase tracking-tight">AI Assistant</h3>
                    <p className="text-[10px] text-nier-muted uppercase font-bold tracking-widest">Compose Modification</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[90%] px-4 py-3 border-l-4 ${message.role === 'user'
                                ? 'bg-nier-dark text-nier-beige border-nier-accent'
                                : 'bg-nier-beige/50 text-nier-dark border-nier-dark/30'
                                }`}
                        >
                            <p className="text-[13px] leading-relaxed tracking-tight whitespace-pre-wrap">{message.content}</p>

                            {message.modifiedYaml && (
                                <div className="mt-4 pt-4 border-t border-nier-dark/10">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => onApplyModification(message.modifiedYaml!)}
                                            className="flex items-center gap-2 px-3 py-2 bg-nier-dark text-nier-beige text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            Execute
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(message.modifiedYaml!);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all"
                                        >
                                            Copy Data
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-nier-dark p-3">
                            <Loader2 className="w-5 h-5 text-nier-beige animate-spin" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-nier-border">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={currentProject ? "Enter modification parameters..." : "Select node first..."}
                        disabled={!currentProject || isLoading}
                        className="flex-1 px-4 py-3 bg-nier-beige border border-nier-border text-nier-dark text-sm placeholder-nier-muted/50 focus:outline-none focus:ring-1 focus:ring-nier-dark disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading || !currentProject}
                        className="px-6 py-3 bg-nier-dark text-nier-beige hover:opacity-90 disabled:opacity-30 transition-all font-bold uppercase text-xs tracking-widest"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
