'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-nier-paper border-4 border-nier-dark shadow-[16px_16px_0px_0px_rgba(69,65,56,0.3)] w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-nier-dark text-nier-beige px-6 py-4 flex items-center justify-between border-b-2 border-nier-dark">
                    <h2 className="font-bold uppercase tracking-[0.2em] text-sm">{title}</h2>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-nier-beige/20 transition-colors"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-nier-dark text-sm leading-relaxed mb-6">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-nier-paper border-2 border-nier-dark text-nier-dark font-bold uppercase tracking-widest text-xs hover:bg-nier-dark/5 transition-all active:translate-y-0.5"
                            type="button"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-6 py-3 bg-nier-accent text-nier-beige font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all active:translate-y-0.5 border-2 border-nier-accent"
                            type="button"
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
