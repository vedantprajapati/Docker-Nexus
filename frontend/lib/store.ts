import { create } from 'zustand';
import { Project } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface AppConfig {
    features: {
        aiEnabled: boolean;
        dockerControl: boolean;
        editCompose: boolean;
    };
    llm: {
        provider: string;
        model: string;
    };
    theme: {
        name: string;
        colors: {
            [key: string]: string;
        };
    };
}

interface AppState {
    projects: Project[];
    currentProject: Project | null;
    liveContainers: any[];
    selectedNodeId: string | null;
    isLiveMode: boolean;
    loading: boolean;
    error: string | null;

    // Actions
    fetchProjects: () => Promise<void>;
    fetchLiveContainers: () => Promise<void>;
    createProject: (name: string, description: string, compose: string, x?: number, y?: number) => Promise<Project>;
    selectProject: (id: string) => Promise<void>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    deployProject: (id: string) => Promise<{ message: string; output: string }>;
    deployProjects: (ids: string[]) => Promise<{ message: string }>;
    stopProject: (id: string) => Promise<{ message: string; output: string }>;
    setSelectedNodeId: (id: string | null) => void;
    setIsLiveMode: (isLive: boolean) => void;
    modifyWithLLM: (instruction: string) => Promise<string>;
    categorizeServices: () => Promise<Record<string, string>>;
    getProjectLogs: (projectId: string, service?: string, tail?: string) => Promise<string>;
    restartService: (projectId: string, service: string) => Promise<void>;
    createGroup: (name: string, description: string, projectIds: string[], x?: number, y?: number) => Promise<Project>;
    addProjectToGroup: (groupId: string, childProjectId: string) => Promise<Project>;

    // Config
    config: AppConfig | null;
    fetchConfig: () => Promise<void>;
    updateConfig: (config: AppConfig) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    projects: [],
    currentProject: null,
    liveContainers: [],
    selectedNodeId: null,
    isLiveMode: false,
    loading: false,
    error: null,

    fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects`);
            if (!res.ok) throw new Error('Failed to fetch projects');
            const projects = await res.json();
            set({ projects, loading: false });
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
        }
    },

    createProject: async (name, description, compose, x = 0, y = 0) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, compose, x, y }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create project');
            }
            const project = await res.json();
            set((state) => ({
                projects: [...state.projects, project],
                currentProject: project,
                loading: false,
            }));
            return project;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    selectProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${id}`);
            if (!res.ok) throw new Error('Failed to fetch project');
            const project = await res.json();
            set({ currentProject: project, loading: false });
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
        }
    },

    updateProject: async (id, updates) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update project');
            const project = await res.json();
            set((state) => ({
                projects: state.projects.map((p) => (p.id === id ? project : p)),
                currentProject: project,
                loading: false,
            }));
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
        }
    },

    deleteProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete project');
            set((state) => ({
                projects: state.projects.filter((p) => p.id !== id),
                currentProject: state.currentProject?.id === id ? null : state.currentProject,
                loading: false,
            }));
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
        }
    },

    deployProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${id}/deploy`, {
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Deployment failed');
            set({ loading: false });
            get().fetchLiveContainers();
            return data;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    deployProjects: async (ids: string[]) => {
        set({ loading: true, error: null });
        try {
            const results = await Promise.all(ids.map(async (id: string) => {
                const res = await fetch(`${API_URL}/api/projects/${id}/deploy`, {
                    method: 'POST',
                });
                const data = await res.json();
                return { id, ok: res.ok, data };
            }));

            const failures = results.filter(r => !r.ok);
            if (failures.length > 0) {
                throw new Error(`Failed to deploy ${failures.length} projects`);
            }

            set({ loading: false });
            return { message: `Successfully deployed ${ids.length} projects` };
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    stopProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${id}/stop`, {
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Stop failed');
            set({ loading: false });
            get().fetchLiveContainers();
            return data;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    modifyWithLLM: async (instruction) => {
        const { currentProject } = get();
        if (!currentProject) throw new Error('No project selected');

        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/llm/modify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: currentProject.id,
                    instruction,
                    compose: currentProject.compose,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'LLM modification failed');
            set({ loading: false });
            return data.modifiedCompose;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    fetchLiveContainers: async () => {
        try {
            const res = await fetch(`${API_URL}/api/docker/containers`);
            if (!res.ok) throw new Error('Failed to fetch live containers');
            const liveContainers = await res.json();
            set({ liveContainers });
        } catch (err) {
            console.error('Live status error:', err);
        }
    },

    categorizeServices: async () => {
        const { currentProject } = get();
        if (!currentProject) throw new Error('No project selected');

        try {
            const res = await fetch(`${API_URL}/api/llm/categorize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compose: currentProject.compose }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Categorization failed');
            return data.categories;
        } catch (err) {
            console.error('Categorization error:', err);
            return {};
        }
    },
    getProjectLogs: async (projectId, service, tail = '100') => {
        try {
            const params = new URLSearchParams({ tail });
            if (service) params.append('service', service);
            const res = await fetch(`${API_URL}/api/projects/${projectId}/logs?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');
            return data.logs;
        } catch (err) {
            console.error('Logs error:', err);
            throw err;
        }
    },

    restartService: async (projectId, service) => {
        try {
            const params = new URLSearchParams();
            if (service) params.append('service', service);
            const res = await fetch(`${API_URL}/api/projects/${projectId}/restart?${params}`, {
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to restart service');
            // Refresh containers after restart
            get().fetchLiveContainers();
        } catch (err) {
            console.error('Restart error:', err);
            throw err;
        }
    },

    createGroup: async (name, description, projectIds, x = 0, y = 0) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, projectIds, x, y }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create group');
            }
            const group = await res.json();
            set((state) => ({
                projects: [...state.projects, group],
                currentProject: group,
                loading: false,
            }));
            return group;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    addProjectToGroup: async (groupId, childProjectId) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects/${groupId}/group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ childProjectId }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add project to group');
            }
            const updatedGroup = await res.json();
            set((state) => ({
                projects: state.projects.map(p => p.id === groupId ? updatedGroup : p),
                currentProject: state.currentProject?.id === groupId ? updatedGroup : state.currentProject,
                loading: false,
            }));
            return updatedGroup;
        } catch (err) {
            set({ error: (err as Error).message, loading: false });
            throw err;
        }
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setIsLiveMode: (isLive) => set({ isLiveMode: isLive }),

    config: null,

    fetchConfig: async () => {
        try {
            const res = await fetch(`${API_URL}/api/config`);
            if (!res.ok) throw new Error('Failed to fetch config');
            const config = await res.json();
            set({ config });

            // Apply theme
            if (config.theme && config.theme.colors) {
                const root = document.documentElement;
                Object.entries(config.theme.colors).forEach(([key, value]) => {
                    root.style.setProperty(`--${key}`, value as string);
                });
            }
        } catch (err) {
            console.error('Config fetch error:', err);
        }
    },

    updateConfig: async (newConfig) => {
        try {
            const res = await fetch(`${API_URL}/api/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });
            if (!res.ok) throw new Error('Failed to update config');
            const config = await res.json();
            set({ config });

            // Apply theme
            if (config.theme && config.theme.colors) {
                const root = document.documentElement;
                Object.entries(config.theme.colors).forEach(([key, value]) => {
                    root.style.setProperty(`--${key}`, value as string);
                });
            }
        } catch (err) {
            set({ error: (err as Error).message });
            throw err;
        }
    },
}));
