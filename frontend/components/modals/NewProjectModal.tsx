'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { X, FileCode, Upload } from 'lucide-react';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const sampleCompose = `services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api

  api:
    image: node:18-alpine
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://db:5432/app
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=app
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`;

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [compose, setCompose] = useState(sampleCompose);
    const [error, setError] = useState('');
    const { createProject, loading } = useStore();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Project name is required');
            return;
        }

        try {
            await createProject(name.trim(), description.trim(), compose);
            setName('');
            setDescription('');
            setCompose(sampleCompose);
            onClose();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setCompose(content);
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nier-dark/40 backdrop-blur-[2px]">
            <div className="w-full max-w-2xl bg-nier-paper border border-nier-border shadow-2xl relative overflow-hidden">
                {/* Decorative border */}
                <div className="absolute top-0 left-0 w-full h-1 bg-nier-dark" />

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-nier-border/50">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-nier-dark">
                            <FileCode className="w-5 h-5 text-nier-beige" />
                        </div>
                        <h2 className="text-xl font-bold text-nier-dark uppercase tracking-tighter">Create Project</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-nier-dark/5 text-nier-muted hover:text-nier-dark transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="px-4 py-3 bg-nier-accent/10 border-l-4 border-nier-accent text-nier-accent text-[11px] font-bold uppercase tracking-widest">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-bold text-nier-muted uppercase tracking-[0.2em] mb-2">
                                Project Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="my-awesome-stack"
                                className="w-full px-4 py-3 bg-nier-beige border border-nier-border text-nier-dark placeholder-nier-muted/30 focus:outline-none focus:ring-1 focus:ring-nier-dark transition-all text-sm font-bold tracking-tight"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-nier-muted uppercase tracking-[0.2em] mb-2">
                                Description
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="A brief description of this stack"
                                className="w-full px-4 py-3 bg-nier-beige border border-nier-border text-nier-dark placeholder-nier-muted/30 focus:outline-none focus:ring-1 focus:ring-nier-dark transition-all text-sm font-bold tracking-tight"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-[10px] font-bold text-nier-muted uppercase tracking-[0.2em]">
                                Compose File
                            </label>
                            <label className="flex items-center gap-2 px-3 py-1.5 bg-nier-dark text-nier-beige text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:opacity-90 transition-all">
                                <Upload className="w-3.5 h-3.5" />
                                Upload File
                                <input
                                    type="file"
                                    accept=".yml,.yaml"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <textarea
                            value={compose}
                            onChange={(e) => setCompose(e.target.value)}
                            rows={10}
                            className="w-full px-4 py-3 bg-nier-beige border border-nier-border text-nier-dark font-mono text-xs placeholder-nier-muted/30 focus:outline-none focus:ring-1 focus:ring-nier-dark resize-none transition-all"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border border-nier-dark text-nier-dark text-[11px] font-bold uppercase tracking-widest hover:bg-nier-dark hover:text-nier-beige transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-nier-dark text-nier-beige text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all disabled:opacity-30 border-b-4 border-nier-dark/20"
                        >
                            {loading ? 'Processing...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
