/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Annotation Inspector & JSON Editor Component
 */

import React, { useState } from 'react';
import { Copy, Check, Download, FileJson, Binary } from 'lucide-react';
import type { BoppAnnotation } from '../types/bopp';
import { serializeBoppJson, serializeBoppMsgpack } from '../utils/boppParser';

interface AnnotationInspectorProps {
  annotation: BoppAnnotation;
  onUpdateAnnotation?: (updated: BoppAnnotation) => void;
}

export const AnnotationInspector: React.FC<AnnotationInspectorProps> = ({
  annotation,
  onUpdateAnnotation,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>(() => serializeBoppJson(annotation, 2));
  const [editError, setEditError] = useState<string | null>(null);

  const jsonStr = serializeBoppJson(annotation, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${annotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}.bopp`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMsgpack = () => {
    const bytes = serializeBoppMsgpack(annotation);
    const blob = new Blob([bytes as any], { type: 'application/x-msgpack' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${annotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}.bopp.msgpack`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setEditError(null);
      setIsEditing(false);
      onUpdateAnnotation?.(parsed);
    } catch (e: any) {
      setEditError(`Invalid JSON: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden text-xs">
      {/* Inspector Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-300 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-900 dark:text-slate-100">
            Raw BOPP Annotation Document
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-medium">v{annotation.bopp_version}</span>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setJsonText(jsonStr);
                  setEditError(null);
                }}
                className="px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold shadow-2xs"
              >
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setJsonText(jsonStr);
                setIsEditing(true);
              }}
              className="px-2.5 py-1 text-slate-800 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded hover:bg-slate-100 dark:hover:bg-neutral-700 font-medium shadow-2xs"
            >
              Edit JSON
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-800 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors font-medium shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-800 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors font-medium shadow-2xs"
            title="Download JSON format (.bopp)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.bopp (JSON)</span>
          </button>

          <button
            onClick={handleDownloadMsgpack}
            className="flex items-center gap-1 px-2.5 py-1 text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950 rounded border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition-colors font-medium shadow-2xs"
            title="Download binary MessagePack format (.msgpack)"
          >
            <Binary className="w-3.5 h-3.5" />
            <span>.msgpack</span>
          </button>
        </div>
      </div>

      {editError && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 text-red-700 dark:text-red-300 font-mono text-[11px]">
          {editError}
        </div>
      )}

      {/* Editor or JSON Viewer */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {isEditing ? (
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full p-3 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded resize-none text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed overflow-auto"
          />
        ) : (
          <pre className="flex-1 w-full p-3 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-neutral-800 dark:text-neutral-200 overflow-auto leading-relaxed">
            {jsonStr}
          </pre>
        )}
      </div>
    </div>
  );
};
