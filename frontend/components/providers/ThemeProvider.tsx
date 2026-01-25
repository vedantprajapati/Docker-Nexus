'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { config, fetchConfig } = useStore();

    useEffect(() => {
        // Initial fetch if not already present, though Sidebar also fetches it
        if (!config) {
            fetchConfig();
        }

        // Re-apply theme if config changes (redundant with store logic but good safety)
        if (config?.theme?.colors) {
            const root = document.documentElement;
            Object.entries(config.theme.colors).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value as string);
            });
        }
    }, [config, fetchConfig]);

    return <>{children}</>;
}
