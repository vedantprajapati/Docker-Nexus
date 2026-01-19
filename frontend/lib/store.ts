import { create } from 'zustand';
import { Project } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
    createProject: (name: string, description: string, compose: string) => Promise<Project>;
    selectProject: (id: string) => Promise<void>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    deployProject: (id: string) => Promise<{ message: string; output: string }>;
    stopProject: (id: string) => Promise<{ message: string; output: string }>;
    setSelectedNodeId: (id: string | null) => void;
    setIsLiveMode: (isLive: boolean) => void;
    modifyWithLLM: (instruction: string) => Promise<string>;
    categorizeServices: () => Promise<Record<string, string>>;
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

    createProject: async (name, description, compose) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`${API_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, compose }),
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
            return data;
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
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setIsLiveMode: (isLive) => set({ isLiveMode: isLive }),
}));
