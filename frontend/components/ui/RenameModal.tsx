'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface RenameModalProps {
    isOpen: boolean;
    currentName: string;
    onClose: () => void;
    onRename: (newName: string) => void;
    title?: string;
    confirmText?: string;
}

export default function RenameModal({ isOpen, currentName, onClose, onRename, title = "Rename Project", confirmText = "Rename" }: RenameModalProps) {
    const [name, setName] = useState(currentName);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setName(currentName);
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.select(), 100);
        }
    }, [isOpen, currentName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onRename(name.trim());
        }
        onClose();
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-nier-paper border-4 border-nier-dark shadow-[16px_16px_0px_0px_rgba(69,65,56,0.3)] w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-nier-dark text-nier-beige px-6 py-4 flex items-center justify-between border-b-2 border-nier-dark">
                    <h2 className="font-bold uppercase tracking-[0.2em] text-sm">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-nier-beige/20 transition-colors"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6">
                    <label className="block mb-2 text-xs font-bold uppercase tracking-widest text-nier-muted">
                        Project Name
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-nier-dark text-nier-dark font-bold uppercase tracking-wide text-sm focus:outline-none focus:border-nier-accent transition-colors"
                        placeholder="Enter project name"
                        autoFocus
                    />

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-nier-paper border-2 border-nier-dark text-nier-dark font-bold uppercase tracking-widest text-xs hover:bg-nier-dark/5 transition-all active:translate-y-0.5"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex-1 px-6 py-3 bg-nier-dark text-nier-beige font-bold uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-30 transition-all active:translate-y-0.5 border-2 border-nier-dark"
                        >
                            {confirmText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
