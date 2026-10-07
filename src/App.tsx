/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Main Application Component: JupyterLab BOPP Visualizer Plugin
 */

import React, { useState, useMemo, useRef } from 'react';
import { JupyterTopBar } from './components/JupyterTopBar';
import { JupyterFileBrowser } from './components/JupyterFileBrowser';
import { VegaLiteViewer } from './components/VegaLiteViewer';
import { VegaLiteSpecEditor } from './components/VegaLiteSpecEditor';
import { TabularDataGrid } from './components/TabularDataGrid';
import { AnnotationInspector } from './components/AnnotationInspector';
import { SchemaValidationReport } from './components/SchemaValidationReport';
import { JupyterLabExtensionCode } from './components/JupyterLabExtensionCode';
import { SAMPLE_DATASETS, SampleFileInfo } from './data/sampleDatasets';
import {
  parseBoppJson,
  parseBoppMsgpack,
  serializeBoppJson,
  serializeBoppMsgpack,
  annotationToTabular,
} from './utils/boppParser';
import { validateBoppAnnotation } from './utils/schemaValidator';
import type { BoppAnnotation } from './types/bopp';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bopp_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'dark'; // Fallback to dark if matching fails
  });

  // Keep HTML root class in sync with theme
  React.useEffect(() => {
    localStorage.setItem('bopp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Listen to OS system theme preference changes if user hasn't manually set preference
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('bopp_theme_manual')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleToggleTheme = () => {
    localStorage.setItem('bopp_theme_manual', 'true');
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  const [files, setFiles] = useState<SampleFileInfo[]>(SAMPLE_DATASETS);
  const [selectedFileId, setSelectedFileId] = useState<string>(SAMPLE_DATASETS[0].id);
  const [currentAnnotation, setCurrentAnnotation] = useState<BoppAnnotation>(SAMPLE_DATASETS[0].data);
  const [activeView, setActiveView] = useState<'visualizer' | 'vegaspec' | 'table' | 'raw' | 'validation' | 'extension'>('visualizer');
  const [uploadNotification, setUploadNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active file info
  const activeFile = useMemo(() => {
    return files.find(f => f.id === selectedFileId) || files[0];
  }, [files, selectedFileId]);

  // Compute tabular representation
  const tabularData = useMemo(() => {
    return annotationToTabular(currentAnnotation);
  }, [currentAnnotation]);

  // Compute schema validation result
  const validationResult = useMemo(() => {
    return validateBoppAnnotation(currentAnnotation);
  }, [currentAnnotation]);

  // Handle selecting a file from the JupyterLab file browser
  const handleSelectFile = (file: SampleFileInfo) => {
    setSelectedFileId(file.id);
    if (file.format === 'msgpack' && file.rawMsgpackBase64) {
      // Decode directly from the binary MessagePack bytes!
      try {
        const binStr = atob(file.rawMsgpackBase64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const decoded = parseBoppMsgpack(bytes);
        setCurrentAnnotation(decoded);
      } catch (e) {
        console.error('Error decoding MessagePack, falling back to data object:', e);
        setCurrentAnnotation(file.data);
      }
    } else {
      setCurrentAnnotation(file.data);
    }
  };

  // Handle uploading any .bopp, .json, or .msgpack file
  const handleFileUpload = async (file: File) => {
    try {
      const isMsgpack = file.name.endsWith('.msgpack') || file.name.endsWith('.bin');
      let annotation: BoppAnnotation;

      if (isMsgpack) {
        const buffer = await file.arrayBuffer();
        annotation = parseBoppMsgpack(new Uint8Array(buffer));
      } else {
        const text = await file.text();
        annotation = parseBoppJson(text);
      }

      const newId = `user_${Date.now()}`;
      const newFileInfo: SampleFileInfo = {
        id: newId,
        filename: file.name.startsWith('annotations/') || file.name.startsWith('benchmarks/')
          ? file.name
          : `annotations/${file.name}`,
        title: file.name,
        category: 'music',
        format: isMsgpack ? 'msgpack' : 'json',
        description: `Uploaded file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        extentType: annotation.extent?.extent_type || 'none',
        payloadType: annotation.payload.payload_type,
        confidenceType: annotation.confidence?.confidence_type,
        data: annotation,
      };

      setFiles(prev => [newFileInfo, ...prev]);
      setSelectedFileId(newId);
      setCurrentAnnotation(annotation);
      setActiveView('visualizer');
      setUploadNotification(`Loaded ${file.name} successfully! Extent: ${annotation.extent?.extent_type ?? 'none'}, Payload: ${annotation.payload.payload_type}`);
      setTimeout(() => setUploadNotification(null), 4000);
    } catch (err: any) {
      alert(`Error reading BOPP file: ${err.message}`);
    }
  };

  // Handle Export / Download
  const handleDownload = (format: 'json' | 'msgpack') => {
    if (format === 'msgpack') {
      const bytes = serializeBoppMsgpack(currentAnnotation);
      const blob = new Blob([bytes as any], { type: 'application/x-msgpack' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${currentAnnotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}.bopp.msgpack`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonStr = serializeBoppJson(currentAnnotation, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${currentAnnotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}.bopp`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Create new blank annotation
  const handleCreateNew = () => {
    const blankAnnotation: BoppAnnotation = {
      media_id: `custom:track_${Date.now()}`,
      bopp_version: '1.0',
      metadata: {
        metadata_type: 'human',
        tool: 'JupyterLab BOPP Editor',
        description: 'New custom annotation',
      },
      extent: {
        extent_type: 'time_interval',
        time: [0.0, 2.0, 4.0, 6.0],
        duration: [2.0, 2.0, 2.0, 2.0],
      },
      payload: {
        payload_type: 'chord',
        value: ['C:maj', 'A:min', 'F:maj', 'G:maj'],
      },
      confidence: {
        confidence_type: 'likelihood',
        confidence: [0.95, 0.90, 0.85, 0.92],
      },
    };

    const newId = `scratch_${Date.now()}`;
    const newFileInfo: SampleFileInfo = {
      id: newId,
      filename: `annotations/scratch_${Date.now()}.bopp`,
      title: 'Custom Scratch Annotation',
      category: 'music',
      format: 'json',
      description: 'Newly created custom BOPP annotation with time intervals and chords.',
      extentType: 'time_interval',
      payloadType: 'chord',
      confidenceType: 'likelihood',
      data: blankAnnotation,
    };

    setFiles(prev => [newFileInfo, ...prev]);
    setSelectedFileId(newId);
    setCurrentAnnotation(blankAnnotation);
    setActiveView('visualizer');
  };

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans antialiased">
        {/* Hidden file input for header upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".bopp,.json,.msgpack,.bin"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
            e.target.value = '';
          }}
        />

        {/* JupyterLab Top Menu & Breadcrumbs */}
        <JupyterTopBar
          currentFilename={activeFile.filename}
          isMessagePack={activeFile.format === 'msgpack'}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUploadClick={() => fileInputRef.current?.click()}
          onDownloadFile={handleDownload}
          onOpenExtensionModal={() => setActiveView('extension')}
          activeView={activeView}
          onSelectView={setActiveView}
          validationScore={validationResult.score}
        />

        {/* Notification Toast */}
        {uploadNotification && (
          <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-mono flex items-center justify-between shadow-md z-50">
            <span>{uploadNotification}</span>
            <button
              onClick={() => setUploadNotification(null)}
              className="ml-3 hover:text-emerald-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Split Layout: JupyterLab File Browser Sidebar + Document Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left File Browser */}
          <JupyterFileBrowser
            files={files}
            selectedFileId={selectedFileId}
            onSelectFile={handleSelectFile}
            onFileUpload={handleFileUpload}
            onCreateNewAnnotation={handleCreateNew}
          />

          {/* Right Document Workspace */}
          <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-neutral-950">
            {activeView === 'visualizer' && (
              <VegaLiteViewer
                annotation={currentAnnotation}
                tabularData={tabularData}
                theme={theme}
                onViewSpecClick={() => setActiveView('vegaspec')}
              />
            )}

            {activeView === 'vegaspec' && (
              <VegaLiteSpecEditor
                annotation={currentAnnotation}
                tabularData={tabularData}
                theme={theme}
                onApplyCustomSpec={() => setActiveView('visualizer')}
              />
            )}

            {activeView === 'table' && (
              <TabularDataGrid
                annotation={currentAnnotation}
                tabularData={tabularData}
              />
            )}

            {activeView === 'raw' && (
              <AnnotationInspector
                annotation={currentAnnotation}
                onUpdateAnnotation={updated => setCurrentAnnotation(updated)}
              />
            )}

            {activeView === 'validation' && (
              <SchemaValidationReport
                validationResult={validationResult}
              />
            )}

            {activeView === 'extension' && (
              <JupyterLabExtensionCode />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
