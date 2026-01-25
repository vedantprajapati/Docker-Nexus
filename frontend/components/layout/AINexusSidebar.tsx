'use client';

import dynamic from 'next/dynamic';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';

const LLMChat = dynamic(() => import('@/components/chat/LLMChat'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
});

interface AINexusSidebarProps {
    isExpanded: boolean;
    onToggle: () => void;
    onApplyModification: (yaml: string) => void;
}

export default function AINexusSidebar({
    isExpanded,
    onToggle,
    onApplyModification
}: AINexusSidebarProps) {
    const { config } = useStore();

    if (!config?.features.aiEnabled) return null;

    return (
        <>
            {/* Floating Chat Tab Toggle */}
            <button
                onClick={onToggle}
                className={`absolute bottom-1/2 translate-y-1/2 right-0 z-50 px-2 py-8 bg-nier-dark text-nier-beige transition-all duration-300 shadow-xl border-l-2 border-y-2 border-nier-accent hover:bg-nier-accent group ${isExpanded ? '-translate-x-[400px]' : ''
                    }`}
            >
                <div className="flex flex-col items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.3em] [writing-mode:vertical-lr] ${isExpanded ? 'rotate-180' : ''}`}>
                        {isExpanded ? 'Close' : 'Chat'}
                    </span>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-0' : 'rotate-180'}`} />
                </div>
            </button>

            {/* AI Sidebar Tab */}
            <div className={`fixed top-0 right-0 h-full transition-all duration-300 ease-in-out border-l-2 border-nier-dark bg-nier-beige flex flex-col z-40 shadow-2xl ${isExpanded ? 'w-[400px]' : 'w-0 overflow-hidden border-l-0'
                }`}>
                <div className="h-full w-[400px]">
                    <LLMChat onApplyModification={onApplyModification} />
                </div>
            </div>
        </>
    );
}
