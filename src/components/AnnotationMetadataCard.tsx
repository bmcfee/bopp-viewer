/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Expandable Annotation Metadata Box
 * Displays BOPP document metadata, media identifiers, annotator info, and sandbox data
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  Info,
  Calendar,
  User,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { BoppAnnotation } from '../types/bopp';

interface AnnotationMetadataCardProps {
  annotation: BoppAnnotation;
  theme: 'light' | 'dark';
}

export const AnnotationMetadataCard: React.FC<AnnotationMetadataCardProps> = ({
  annotation,
  theme,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const metadata = annotation.metadata as Record<string, any> | undefined;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;
  const hasSandbox = annotation.sandbox && Object.keys(annotation.sandbox).length > 0;
  const hasParents = annotation.parents && annotation.parents.length > 0;

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(annotation.media_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Format date/timestamp if ISO string
  const formatDate = (val: string | number) => {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {}
    return String(val);
  };

  return (
    <div className="mx-4 mt-3 rounded-lg border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 overflow-hidden text-xs transition-all shadow-xs">
      {/* Collapsed Header / Summary Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-600 text-white shadow-xs">
            <Info className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Annotation Metadata
            </span>
            <span className="text-slate-400 dark:text-slate-600 font-bold">·</span>
            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-900 dark:text-slate-200 bg-white dark:bg-neutral-800 px-2 py-0.5 rounded border border-slate-300 dark:border-neutral-700 max-w-[240px] sm:max-w-[340px] truncate shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">media:</span>
              <span className="font-semibold truncate" title={annotation.media_id}>{annotation.media_id}</span>
            </div>

            <button
              onClick={handleCopyId}
              title="Copy Media ID"
              className="p-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 font-mono font-medium border border-slate-300 dark:border-neutral-700">
            BOPP v{annotation.bopp_version}
          </span>

          <span className={`px-2 py-0.5 rounded-full font-mono font-medium border text-[11px] ${
            annotation.extent
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800'
          }`}>
            extent: {annotation.extent?.extent_type || 'global (none)'}
          </span>

          {metadata?.annotator_id && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-medium border border-emerald-300 dark:border-emerald-800">
              <User className="w-2.5 h-2.5" />
              <span>{String(metadata.annotator_id).slice(0, 16)}</span>
            </span>
          )}

          {metadata?.license && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-medium border border-amber-300 dark:border-amber-800">
              <Shield className="w-2.5 h-2.5" />
              <span>{String(metadata.license)}</span>
            </span>
          )}

          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 ml-1 font-medium">
            <span>{isExpanded ? 'Hide' : 'Expand'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Metadata Details Box */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col gap-3.5">
          {/* Identifiers & Provenance Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                Full Media Identifier (media_id)
              </span>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-900 dark:text-slate-100 select-all break-all">
                <span>{annotation.media_id}</span>
                <button
                  onClick={handleCopyId}
                  className="px-2 py-0.5 rounded bg-white dark:bg-neutral-700 border border-slate-300 dark:border-neutral-600 hover:bg-slate-100 dark:hover:bg-neutral-600 shrink-0 text-[10px] font-medium text-slate-800 dark:text-slate-200"
                >
                  {copiedId ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                Annotation UUID (id)
              </span>
              <span className="font-mono text-[11px] text-slate-900 dark:text-slate-200 break-all">
                {annotation.id || 'Generated at runtime / Canonical content hash'}
              </span>
            </div>
          </div>

          {/* Parents Provenance if present */}
          {hasParents && (
            <div className="p-2.5 rounded bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Parent Annotation IDs (Derived from)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {annotation.parents?.map((p, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[10px] px-2 py-0.5 rounded bg-white dark:bg-neutral-700 border border-slate-300 dark:border-neutral-600 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Structured Metadata Attributes Grid */}
          {hasMetadata ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  Metadata Attributes
                </span>
                <button
                  onClick={() => setShowJson(!showJson)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{showJson ? 'View Structured' : 'View Raw JSON'}</span>
                </button>
              </div>

              {showJson ? (
                <pre className="p-3 bg-slate-900 text-slate-100 rounded border border-slate-700 font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                  {Object.entries(metadata).map(([key, value]) => {
                    if (value === null || value === undefined || typeof value === 'object') return null;
                    return (
                      <div
                        key={key}
                        className="p-2 rounded bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 flex flex-col"
                      >
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5 truncate" title={key}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={String(value)}>
                          {key.includes('time') || key.includes('date') || key.includes('created') ? formatDate(value) : String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Long Description or Annotation Rules text if available */}
              {(metadata.description || metadata.annotation_rules) && !showJson && (
                <div className="mt-2.5 p-3 rounded bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-xs text-slate-800 dark:text-slate-200">
                  {metadata.description && (
                    <p className="mb-1 leading-relaxed">
                      <strong className="text-slate-900 dark:text-white font-bold">Description: </strong>
                      {metadata.description}
                    </p>
                  )}
                  {metadata.annotation_rules && (
                    <p className="leading-relaxed">
                      <strong className="text-slate-900 dark:text-white font-bold">Rules: </strong>
                      {metadata.annotation_rules}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 italic text-xs border border-slate-300 dark:border-neutral-700">
              No additional metadata block provided in this annotation file. Standard BOPP media_id and bopp_version are active.
            </div>
          )}

          {/* Sandbox Storage if present */}
          {hasSandbox && (
            <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sandbox (User-defined Storage)</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-900 dark:text-slate-100 overflow-x-auto">
                {JSON.stringify(annotation.sandbox, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
