/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab Top Bar Component
 */

import React from 'react';
import {
  FileCode2,
  Upload,
  Download,
  Sun,
  Moon,
  FolderOpen,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface JupyterTopBarProps {
  currentFilename: string;
  isMessagePack: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUploadClick: () => void;
  onDownloadFile: (format: 'json' | 'msgpack') => void;
  onOpenExtensionModal: () => void;
  activeView: 'visualizer' | 'vegaspec' | 'table' | 'raw' | 'validation' | 'extension';
  onSelectView: (view: 'visualizer' | 'vegaspec' | 'table' | 'raw' | 'validation' | 'extension') => void;
  validationScore: number;
}

export const JupyterTopBar: React.FC<JupyterTopBarProps> = ({
  currentFilename,
  isMessagePack,
  theme,
  onToggleTheme,
  onUploadClick,
  onDownloadFile,
  onOpenExtensionModal,
  activeView,
  onSelectView,
  validationScore,
}) => {
  return (
    <header className="flex flex-col border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 select-none">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-4 py-2 text-sm border-b border-neutral-200/70 dark:border-neutral-800/70">
        {/* Left: Brand & File Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
            <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
              B
            </div>
            <span>JupyterLab BOPP Visualizer</span>
          </div>

          <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">/</span>

          {/* Breadcrumb filename */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 font-mono">
            <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-neutral-400">workspace /</span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">{currentFilename}</span>
            {isMessagePack && (
              <span className="ml-1 text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-300 dark:border-emerald-800">
                MsgPack
              </span>
            )}
          </div>
        </div>

        {/* Right: Kernel Badge & Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Client-side no kernel notice */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 pr-2 border-r border-neutral-200 dark:border-neutral-800">
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pure Browser Runtime (No Kernel Needed)</span>
          </div>

          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Upload local .bopp, .json or .msgpack file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <div className="relative group">
            <button
              onClick={() => onDownloadFile('json')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded shadow-lg py-1 z-50 min-w-36">
              <button
                onClick={() => onDownloadFile('json')}
                className="px-3 py-1.5 text-xs text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                Download as .bopp (JSON)
              </button>
              <button
                onClick={() => onDownloadFile('msgpack')}
                className="px-3 py-1.5 text-xs text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                Download as .msgpack (Binary)
              </button>
            </div>
          </div>

          <button
            onClick={onOpenExtensionModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded border border-blue-200 dark:border-blue-800 transition-colors"
            title="View JupyterLab Extension source and packaging instructions"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Extension Package</span>
          </button>

          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode (derived from system preference by default)`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
            <span className="capitalize">{theme}</span>
          </button>
        </div>
      </div>

      {/* Document View Tabs (JupyterLab style tab bar) */}
      <div className="flex items-center px-2 bg-neutral-100/70 dark:bg-neutral-950/50 text-xs overflow-x-auto">
        <button
          onClick={() => onSelectView('visualizer')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'visualizer'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Interactive Vega-Lite</span>
        </button>

        <button
          onClick={() => onSelectView('vegaspec')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'vegaspec'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Vega-Lite Spec Editor</span>
        </button>

        <button
          onClick={() => onSelectView('table')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'table'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <span>DataFrame / Table</span>
        </button>

        <button
          onClick={() => onSelectView('raw')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'raw'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <span>Annotation JSON</span>
        </button>

        <button
          onClick={() => onSelectView('validation')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'validation'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Schema Validation ({validationScore}%)</span>
        </button>

        <button
          onClick={() => onSelectView('extension')}
          className={`flex items-center gap-2 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeView === 'extension'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-white dark:bg-neutral-900'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <span>JupyterLab Plugin Architecture</span>
        </button>
      </div>
    </header>
  );
};
