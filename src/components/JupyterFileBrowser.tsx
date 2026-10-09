/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab File Browser Sidebar Component
 */

import React, { useState } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  Search,
  Plus,
  Upload,
  Binary,
  Music,
  CheckCircle2,
} from 'lucide-react';
import type { SampleFileInfo } from '../data/sampleDatasets';

interface JupyterFileBrowserProps {
  files: SampleFileInfo[];
  selectedFileId: string;
  onSelectFile: (file: SampleFileInfo) => void;
  onFileUpload: (file: File) => void;
  onCreateNewAnnotation: () => void;
}

export const JupyterFileBrowser: React.FC<JupyterFileBrowserProps> = ({
  files,
  selectedFileId,
  onSelectFile,
  onFileUpload,
  onCreateNewAnnotation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    benchmarks: true,
    annotations: true,
    comparisons: true,
    uploaded: true,
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const filteredFiles = files.filter(f =>
    f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.payloadType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const benchmarkFiles = filteredFiles.filter(f => f.filename.startsWith('benchmarks/'));
  const comparisonFiles = filteredFiles.filter(f => f.filename.startsWith('comparisons/'));
  const annotationFiles = filteredFiles.filter(f => !f.filename.startsWith('benchmarks/') && !f.filename.startsWith('comparisons/'));

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 select-none text-xs">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[11px]">
          File Browser
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateNewAnnotation}
            className="p-1 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
            title="Create new BOPP Annotation"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <label className="p-1 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors cursor-pointer" title="Upload .bopp or .msgpack file">
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              accept=".bopp,.json,.msgpack,.bin"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onFileUpload(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* Filter / Search input */}
      <div className="p-2 border-b border-neutral-200/80 dark:border-neutral-800/80">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files & payloads..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {/* Benchmarks Folder */}
        <div>
          <button
            onClick={() => toggleFolder('benchmarks')}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-left font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded"
          >
            {expandedFolders.benchmarks ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>benchmarks/</span>
            <span className="ml-auto text-[10px] text-neutral-400">{benchmarkFiles.length}</span>
          </button>

          {expandedFolders.benchmarks && (
            <div className="pl-3.5 mt-0.5 space-y-0.5 border-l border-neutral-200 dark:border-neutral-800 ml-3">
              {benchmarkFiles.map(file => {
                const isSelected = file.id === selectedFileId;
                const isMsgpack = file.format === 'msgpack';

                return (
                  <button
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    className={`w-full flex flex-col text-left px-2 py-1.5 rounded transition-all group ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100 shadow-xs'
                        : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isMsgpack ? (
                        <Binary className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-500'}`} />
                      ) : (
                        <File className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`} />
                      )}
                      <span className="font-mono truncate">{file.filename.replace('benchmarks/', '')}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400 ml-auto flex-shrink-0" />}
                    </div>
                    {/* Unboxed metadata row */}
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                      <span>{file.extentType}</span>
                      <span>·</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{file.payloadType}</span>
                      {file.confidenceType && (
                        <>
                          <span>·</span>
                          <span>{file.confidenceType}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Annotations Folder */}
        <div className="pt-1">
          <button
            onClick={() => toggleFolder('annotations')}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-left font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded"
          >
            {expandedFolders.annotations ? (
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span>annotations/</span>
            <span className="ml-auto text-[10px] text-neutral-400">{annotationFiles.length}</span>
          </button>

          {expandedFolders.annotations && (
            <div className="pl-3.5 mt-0.5 space-y-0.5 border-l border-neutral-200 dark:border-neutral-800 ml-3">
              {annotationFiles.map(file => {
                const isSelected = file.id === selectedFileId;
                return (
                  <button
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    className={`w-full flex flex-col text-left px-2 py-1.5 rounded transition-all group ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100 shadow-xs'
                        : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Music className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`} />
                      <span className="font-mono truncate">{file.filename.replace('annotations/', '')}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400 ml-auto flex-shrink-0" />}
                    </div>
                    {/* Unboxed metadata row */}
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                      <span>{file.extentType}</span>
                      <span>·</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{file.payloadType}</span>
                      {file.confidenceType && (
                        <>
                          <span>·</span>
                          <span>{file.confidenceType}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Comparisons Folder (Illustrates comparisons across extents/confidences on same underlying audio) */}
        {comparisonFiles.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => toggleFolder('comparisons')}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded"
            >
              {expandedFolders.comparisons ? (
                <FolderOpen className="w-3.5 h-3.5 text-purple-500" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-purple-500" />
              )}
              <span>comparisons/</span>
              <span className="ml-auto text-[10px] text-neutral-400">{comparisonFiles.length}</span>
            </button>

            {expandedFolders.comparisons && (
              <div className="pl-3.5 mt-0.5 space-y-0.5 border-l border-neutral-200 dark:border-neutral-800 ml-3">
                {comparisonFiles.map(file => {
                  const isSelected = file.id === selectedFileId;
                  return (
                    <button
                      key={file.id}
                      onClick={() => onSelectFile(file)}
                      className={`w-full flex flex-col text-left px-2 py-1.5 rounded transition-all group ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-100 shadow-xs'
                          : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <File className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400'}`} />
                        <span className="font-mono truncate">{file.filename.replace('comparisons/', '')}</span>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400 ml-auto flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                        <span>{file.extentType}</span>
                        <span>·</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">{file.payloadType}</span>
                        {file.confidenceType && (
                          <>
                            <span>·</span>
                            <span>{file.confidenceType}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drag & Drop Upload Footer */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onFileUpload(file);
        }}
        className="m-2 p-2.5 border border-dashed border-neutral-300 dark:border-neutral-700 rounded bg-white/50 dark:bg-neutral-800/40 text-center"
      >
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">
          Drag & drop .bopp or .msgpack files here
        </span>
      </div>
    </aside>
  );
};
