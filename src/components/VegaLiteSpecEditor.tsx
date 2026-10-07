/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vega-Lite Specification Editor Component
 */

import React, { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Play, Code } from 'lucide-react';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { buildBoppVegaLiteSpec } from '../utils/vegaLiteBuilder';

interface VegaLiteSpecEditorProps {
  annotation: BoppAnnotation;
  tabularData: TabularRecord[];
  theme: 'light' | 'dark';
  onApplyCustomSpec?: (spec: Record<string, unknown>) => void;
}

export const VegaLiteSpecEditor: React.FC<VegaLiteSpecEditorProps> = ({
  annotation,
  tabularData,
  theme,
  onApplyCustomSpec,
}) => {
  const [specText, setSpecText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Generate initial spec
  useEffect(() => {
    const generated = buildBoppVegaLiteSpec(annotation, tabularData, { theme });
    setSpecText(JSON.stringify(generated, null, 2));
    setErrorMsg(null);
  }, [annotation, tabularData, theme]);

  const handleCopy = () => {
    navigator.clipboard.writeText(specText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    const generated = buildBoppVegaLiteSpec(annotation, tabularData, { theme });
    setSpecText(JSON.stringify(generated, null, 2));
    setErrorMsg(null);
    setSuccessMsg('Restored generated default specification.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(specText);
      setErrorMsg(null);
      if (onApplyCustomSpec) {
        onApplyCustomSpec(parsed);
      }
      setSuccessMsg('Successfully validated and applied Vega-Lite spec!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (e: any) {
      setErrorMsg(`JSON Parse Error: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden text-xs">
      {/* Editor Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Vega-Lite v5 Specification
          </span>
          <span className="text-neutral-400">·</span>
          <span className="text-neutral-500 font-mono text-[11px]">
            {annotation.payload.payload_type} ({annotation.extent?.extent_type ?? 'no extent'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 transition-colors"
            title="Reset to default generated spec"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Spec</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handleApply}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-xs transition-colors"
          >
            <Play className="w-3 h-3" />
            <span>Apply to Visualizer</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-mono text-[11px]">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
          {successMsg}
        </div>
      )}

      {/* JSON Code Area */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <textarea
          value={specText}
          onChange={e => setSpecText(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full p-3 font-mono text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded resize-none text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed overflow-auto"
        />
      </div>
    </div>
  );
};
