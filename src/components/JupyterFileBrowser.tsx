/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab File Browser Sidebar Component
 * Displays systematic sample datasets categorized into structured subfolders
 */

import React, { useState, useMemo } from 'react';
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
  FolderTree,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { SampleFileInfo } from '../data/sampleDatasets';

interface JupyterFileBrowserProps {
  files: SampleFileInfo[];
  selectedFileId: string;
  onSelectFile: (file: SampleFileInfo) => void;
  onFileUpload: (file: File) => void;
  onCreateNewAnnotation: () => void;
}

interface FolderMetadata {
  displayName: string;
  badgeColor: string;
  folderColor: string;
  order: number;
}

const FOLDER_METADATA: Record<string, FolderMetadata> = {
  benchmarks: {
    displayName: 'benchmarks/',
    badgeColor: 'text-amber-600 dark:text-amber-400',
    folderColor: 'text-amber-500',
    order: 1,
  },
  global: {
    displayName: 'global/ (no extent)',
    badgeColor: 'text-indigo-600 dark:text-indigo-400',
    folderColor: 'text-indigo-500',
    order: 2,
  },
  time_points: {
    displayName: 'time_points/',
    badgeColor: 'text-cyan-600 dark:text-cyan-400',
    folderColor: 'text-cyan-500',
    order: 3,
  },
  time_intervals: {
    displayName: 'time_intervals/',
    badgeColor: 'text-emerald-600 dark:text-emerald-400',
    folderColor: 'text-emerald-500',
    order: 4,
  },
  symbolic_midi_score: {
    displayName: 'symbolic_midi_score/',
    badgeColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    folderColor: 'text-fuchsia-500',
    order: 5,
  },
  spatial_boxes: {
    displayName: 'spatial_boxes/',
    badgeColor: 'text-orange-600 dark:text-orange-400',
    folderColor: 'text-orange-500',
    order: 6,
  },
  annotations: {
    displayName: 'annotations/',
    badgeColor: 'text-blue-600 dark:text-blue-400',
    folderColor: 'text-blue-500',
    order: 7,
  },
  comparisons: {
    displayName: 'comparisons/',
    badgeColor: 'text-purple-600 dark:text-purple-400',
    folderColor: 'text-purple-500',
    order: 8,
  },
  uploaded: {
    displayName: 'uploaded/',
    badgeColor: 'text-teal-600 dark:text-teal-400',
    folderColor: 'text-teal-500',
    order: 9,
  },
};

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
    global: true,
    time_points: true,
    time_intervals: true,
    symbolic_midi_score: true,
    spatial_boxes: true,
    annotations: true,
    comparisons: true,
    uploaded: true,
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const setAllFolders = (expanded: boolean) => {
    const updated: Record<string, boolean> = {};
    for (const f of files) {
      const folderKey = f.filename.includes('/') ? f.filename.split('/')[0] : 'root';
      updated[folderKey] = expanded;
    }
    setExpandedFolders(updated);
  };

  const filteredFiles = useMemo(() => {
    return files
      .filter(f =>
        f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.payloadType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.extentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.confidenceType && f.confidenceType.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
  }, [files, searchTerm]);

  // Group files dynamically by directory prefix
  const folderGroups = useMemo(() => {
    const groups: Record<string, SampleFileInfo[]> = {};
    for (const f of filteredFiles) {
      const folderKey = f.filename.includes('/') ? f.filename.split('/')[0] : 'root';
      if (!groups[folderKey]) groups[folderKey] = [];
      groups[folderKey].push(f);
    }

    // Sort folders by predefined order or alphabetically
    const keys = Object.keys(groups).sort((a, b) => {
      const orderA = FOLDER_METADATA[a]?.order ?? 99;
      const orderB = FOLDER_METADATA[b]?.order ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });

    return keys.map(key => ({
      key,
      meta: FOLDER_METADATA[key] || {
        displayName: `${key}/`,
        badgeColor: 'text-neutral-600 dark:text-neutral-400',
        folderColor: 'text-neutral-500',
        order: 99,
      },
      files: groups[key],
    }));
  }, [filteredFiles]);

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 select-none text-xs">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider text-[11px]">
          <FolderTree className="w-3.5 h-3.5 text-neutral-500" />
          <span>File Browser</span>
          <span className="text-[10px] lowercase tracking-normal text-neutral-400 font-normal">
            ({filteredFiles.length} files)
          </span>
        </div>
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

      {/* Filter / Search input & quick collapse/expand */}
      <div className="p-2 border-b border-neutral-200/80 dark:border-neutral-800/80 space-y-1.5">
        <div className="relative flex items-center">
          <Search className="w-3 h-3 absolute left-2.5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files, extents, payloads..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1">
          <span>{folderGroups.length} subfolders</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllFolders(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted cursor-pointer"
            >
              expand all
            </button>
            <span>·</span>
            <button
              onClick={() => setAllFolders(false)}
              className="hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted cursor-pointer"
            >
              collapse all
            </button>
          </div>
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
        {folderGroups.map(group => {
          const isExpanded = expandedFolders[group.key] ?? true;

          return (
            <div key={group.key} className="space-y-0.5">
              <button
                onClick={() => toggleFolder(group.key)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-left font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded group transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-600" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:text-neutral-600" />
                )}
                {isExpanded ? (
                  <FolderOpen className={`w-3.5 h-3.5 ${group.meta.folderColor}`} />
                ) : (
                  <Folder className={`w-3.5 h-3.5 ${group.meta.folderColor}`} />
                )}
                <span className="font-mono text-[11px] truncate">{group.meta.displayName}</span>
                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-neutral-800/80 ${group.meta.badgeColor}`}>
                  {group.files.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pl-3 mt-0.5 space-y-0.5 border-l border-neutral-200 dark:border-neutral-800 ml-3">
                  {group.files.map(file => {
                    const isSelected = file.id === selectedFileId;
                    const isMsgpack = file.format === 'msgpack';
                    const baseFileName = file.filename.includes('/')
                      ? file.filename.split('/').slice(1).join('/')
                      : file.filename;

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
                          ) : file.category === 'music' || file.category === 'score' ? (
                            <Music className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`} />
                          ) : (
                            <File className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`} />
                          )}
                          <span className="font-mono text-[11px] truncate flex-1" title={file.filename}>
                            {baseFileName}
                          </span>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                        </div>
                        {/* Unboxed metadata row */}
                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 font-mono">
                          <span>{file.extentType === 'none' ? 'no extent' : file.extentType}</span>
                          <span>·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">{file.payloadType}</span>
                          <span>·</span>
                          <span className={file.confidenceType ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-500 italic'}>
                            {file.confidenceType ? file.confidenceType : 'no conf'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {folderGroups.length === 0 && (
          <div className="text-center py-6 text-neutral-400 text-xs">
            No matching files found.
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
