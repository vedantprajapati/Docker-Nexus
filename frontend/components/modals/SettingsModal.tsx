import React, { useEffect, useState } from 'react';
import { X, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { useStore, AppConfig } from '@/lib/store';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { config, updateConfig, fetchConfig } = useStore();
    const [localConfig, setLocalConfig] = useState<AppConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'system' | 'theme'>('system');

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen, fetchConfig]);

    useEffect(() => {
        if (config) {
            setLocalConfig(JSON.parse(JSON.stringify(config))); // Deep copy
        }
    }, [config]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!localConfig) return;
        setSaving(true);
        setError(null);
        try {
            await updateConfig(localConfig);
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const updateFeature = (key: keyof AppConfig['features'], value: boolean) => {
        if (!localConfig) return;
        setLocalConfig({
            ...localConfig,
            features: {
                ...localConfig.features,
                [key]: value,
            },
        });
    };

    const updateLLM = (key: keyof AppConfig['llm'], value: string) => {
        if (!localConfig) return;
        setLocalConfig({
            ...localConfig,
            llm: {
                ...localConfig.llm,
                [key]: value,
            },
        });
    };

    const updateThemeColor = (key: string, value: string) => {
        if (!localConfig) return;
        setLocalConfig({
            ...localConfig,
            theme: {
                ...localConfig.theme,
                colors: {
                    ...localConfig.theme.colors,
                    [key]: value
                }
            }
        });
        // Live preview
        document.documentElement.style.setProperty(`--${key}`, value);
    };

    const THEME_PRESETS = [
        {
            name: "Nier Default",
            colors: {
                "background": "#BAB5A1",
                "foreground": "#454138",
                "nier-beige": "#BAB5A1",
                "nier-paper": "#CDCAB2",
                "nier-dark": "#454138",
                "nier-muted": "#8A8775",
                "nier-accent": "#B25037",
                "nier-border": "#444139",
            }
        },
        {
            name: "Dark Machine",
            colors: {
                "background": "#1a1a1a",
                "foreground": "#e0e0e0",
                "nier-beige": "#1a1a1a",
                "nier-paper": "#2d2d2d",
                "nier-dark": "#e0e0e0", // Inverted for contrast
                "nier-muted": "#888888",
                "nier-accent": "#ff6b6b",
                "nier-border": "#404040",
            }
        }
    ];

    const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
        if (!localConfig) return;
        setLocalConfig({
            ...localConfig,
            theme: {
                ...localConfig.theme,
                name: preset.name,
                colors: { ...preset.colors }
            }
        });
        // Live preview
        Object.entries(preset.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nier-dark/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-nier-beige border-2 border-nier-dark/20 shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-nier-dark/10 bg-nier-paper">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xl font-bold text-nier-dark tracking-tight uppercase">Configuration</h2>
                        <div className="flex gap-1 bg-nier-dark/5 p-1 rounded">
                            <button
                                onClick={() => setActiveTab('system')}
                                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-all ${activeTab === 'system' ? 'bg-nier-dark text-nier-beige shadow-sm' : 'text-nier-muted hover:text-nier-dark'}`}
                            >
                                System
                            </button>
                            <button
                                onClick={() => setActiveTab('theme')}
                                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded transition-all ${activeTab === 'theme' ? 'bg-nier-dark text-nier-beige shadow-sm' : 'text-nier-muted hover:text-nier-dark'}`}
                            >
                                Appearance
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-nier-dark/10 rounded-full transition-colors text-nier-dark/60 hover:text-nier-dark"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {error && (
                        <div className="bg-rose-100 border border-rose-200 text-rose-700 px-4 py-3 rounded flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {!localConfig ? (
                        <div className="flex justify-center p-8">Loading configuration...</div>
                    ) : activeTab === 'system' ? (
                        <>
                            {/* Feature Flags */}
                            <section>
                                <h3 className="text-sm font-bold text-nier-muted uppercase tracking-widest mb-4 border-b border-nier-dark/10 pb-2">
                                    Feature Protocols
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white/50 border border-nier-dark/5 rounded hover:border-nier-dark/20 transition-all">
                                        <div>
                                            <h4 className="font-bold text-nier-dark text-sm">AI Assistance</h4>
                                            <p className="text-xs text-nier-muted mt-1">Enable LLM-based chat and code modification capabilities.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={localConfig.features.aiEnabled}
                                                onChange={(e) => updateFeature('aiEnabled', e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nier-accent"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white/50 border border-nier-dark/5 rounded hover:border-nier-dark/20 transition-all">
                                        <div>
                                            <h4 className="font-bold text-nier-dark text-sm">Docker Control</h4>
                                            <p className="text-xs text-nier-muted mt-1">Allow starting, stopping, and restarting containers.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={localConfig.features.dockerControl}
                                                onChange={(e) => updateFeature('dockerControl', e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nier-accent"></div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-white/50 border border-nier-dark/5 rounded hover:border-nier-dark/20 transition-all">
                                        <div>
                                            <h4 className="font-bold text-nier-dark text-sm">Edit Source</h4>
                                            <p className="text-xs text-nier-muted mt-1">Allow direct editing of docker-compose.yml files.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={localConfig.features.editCompose}
                                                onChange={(e) => updateFeature('editCompose', e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nier-accent"></div>
                                        </label>
                                    </div>
                                </div>
                            </section>

                            {/* LLM Settings */}
                            <section>
                                <h3 className="text-sm font-bold text-nier-muted uppercase tracking-widest mb-4 border-b border-nier-dark/10 pb-2">
                                    Intelligence Module
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-nier-dark uppercase tracking-wider block">Provider</label>
                                        <select
                                            value={localConfig.llm.provider}
                                            onChange={(e) => updateLLM('provider', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-nier-dark/20 rounded text-sm text-nier-dark focus:outline-none focus:border-nier-accent focus:ring-1 focus:ring-nier-accent"
                                        >
                                            <option value="ollama">Ollama (Local)</option>
                                            <option value="openai">OpenAI</option>
                                            {/* <option value="anthropic" disabled>Anthropic (Coming Soon)</option> */}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-nier-dark uppercase tracking-wider block">Model ID</label>
                                        <input
                                            type="text"
                                            value={localConfig.llm.model}
                                            onChange={(e) => updateLLM('model', e.target.value)}
                                            placeholder={localConfig.llm.provider === 'ollama' ? 'llama3.2' : 'gpt-4o'}
                                            className="w-full px-3 py-2 bg-white border border-nier-dark/20 rounded text-sm text-nier-dark focus:outline-none focus:border-nier-accent focus:ring-1 focus:ring-nier-accent"
                                        />
                                        <p className="text-[10px] text-nier-muted">
                                            {localConfig.llm.provider === 'ollama'
                                                ? 'Ensure this model is pulled in Ollama (ollama pull ...)'
                                                : 'Requires OPENAI_API_KEY environment variable'}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </>
                    ) : (
                        <div className="space-y-6">
                            {/* Theme Presets */}
                            <div className="flex gap-2 mb-6">
                                {THEME_PRESETS.map(preset => (
                                    <button
                                        key={preset.name}
                                        onClick={() => applyPreset(preset)}
                                        className="px-4 py-2 bg-white/50 border border-nier-dark/20 rounded hover:bg-white text-xs font-bold uppercase tracking-wider"
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {localConfig.theme.colors && Object.entries(localConfig.theme.colors).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-3 p-3 bg-white/50 border border-nier-dark/5 rounded">
                                        <div className="w-8 h-8 rounded border border-nier-dark/20 overflow-hidden relative">
                                            <input
                                                type="color"
                                                value={value}
                                                onChange={(e) => updateThemeColor(key, e.target.value)}
                                                className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer p-0 border-0"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono text-nier-muted uppercase">{key}</p>
                                            <p className="text-xs font-bold text-nier-dark">{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-nier-paper border-t border-nier-dark/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-nier-muted hover:text-nier-dark transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !localConfig}
                        className="flex items-center gap-2 px-6 py-2 bg-nier-dark text-nier-beige text-xs font-bold uppercase tracking-widest hover:bg-nier-dark/90 transition-all disabled:opacity-50 shadow-lg"
                    >
                        {saving ? 'Saving...' : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
