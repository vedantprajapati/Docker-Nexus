'use client';

import Editor from '@monaco-editor/react';

interface YamlEditorProps {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

export default function YamlEditor({ value, onChange, readOnly = false }: YamlEditorProps) {
    return (
        <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800">
            <Editor
                height="100%"
                defaultLanguage="yaml"
                value={value}
                onChange={(v) => onChange(v || '')}
                theme="vs-dark"
                options={{
                    readOnly,
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 16 },
                    renderLineHighlight: 'all',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    tabSize: 2,
                }}
            />
        </div>
    );
}
