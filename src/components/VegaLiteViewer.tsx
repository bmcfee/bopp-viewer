/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Vega-Lite Visualizer Component with Intelligent Media Linking
 * Supports Drag & Drop of Audio & Image files, synchronized playhead,
 * real-time FFT spectrogram rendering, and optical sheet music image overlays.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import vegaEmbed, { Result as VegaEmbedResult } from 'vega-embed';
import * as vega from 'vega';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Download,
  Filter,
  Eye,
  Info,
  Music,
  Image as ImageIcon,
  Radio,
  Sparkles,
  Layers,
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { buildBoppVegaLiteSpec, VegaLiteBuilderOptions } from '../utils/vegaLiteBuilder';
import { ConfidenceChannelMode } from '../utils/confidenceGrammar';
import { BoppAudioPlayer, isSonifiablePayload } from '../utils/audioSynthesizer';
import { computeSummaryStats } from '../utils/boppParser';
import { AnnotationMetadataCard } from './AnnotationMetadataCard';
import {
  LinkedMedia,
  checkMediaCompatibility,
  generateDemoSheetMusicUrl,
  generateDemoAudioForAnnotation,
} from '../utils/mediaLinker';
import { renderAudioSpectrogram } from '../utils/spectrogramGenerator';
import { PixelBoxImageOverlay } from './PixelBoxImageOverlay';

interface VegaLiteViewerProps {
  annotation: BoppAnnotation;
  tabularData: TabularRecord[];
  theme: 'light' | 'dark';
  onViewSpecClick: () => void;
}

export const VegaLiteViewer: React.FC<VegaLiteViewerProps> = ({
  annotation,
  tabularData,
  theme,
  onViewSpecClick,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const plotCardRef = useRef<HTMLDivElement>(null);
  const vegaResultRef = useRef<VegaEmbedResult | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [containerWidth, setContainerWidth] = useState<number>(760);
  const [plotBounds, setPlotBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Vega-Lite composition states
  const [colorScheme, setColorScheme] = useState<string>('mir_eval_fifths');
  const [confidenceChannel, setConfidenceChannel] = useState<ConfidenceChannelMode>('meter');
  const [minConfidenceFilter, setMinConfidenceFilter] = useState<number>(0);
  const [enableOverviewBrush, setEnableOverviewBrush] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [enableZoomPan, setEnableZoomPan] = useState<boolean>(true);

  // Audio Playback & Media Linking
  const audioPlayerRef = useRef<BoppAudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'chart' | 'overlay'>('chart');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [compatibilityNotice, setCompatibilityNotice] = useState<string | null>(null);
  const [showSpectrogram, setShowSpectrogram] = useState<boolean>(true);

  // Media link should reset when swapping out annotation data
  const annotationUniqueKey = `${annotation.id ?? ''}_${annotation.media_id ?? ''}_${annotation.payload?.payload_type ?? ''}_${annotation.extent?.extent_type ?? 'none'}`;
  const prevAnnotationUniqueKeyRef = useRef<string>(annotationUniqueKey);

  useEffect(() => {
    if (prevAnnotationUniqueKeyRef.current !== annotationUniqueKey) {
      prevAnnotationUniqueKeyRef.current = annotationUniqueKey;
      if (linkedMedia?.type === 'audio') {
        audioPlayerRef.current?.setLinkedAudioElement(null);
      }
      setLinkedMedia(null);
      setActiveMediaTab('chart');
      setIsPlaying(false);
      setCurrentTime(0);
      setPlotBounds(null);
    }
  }, [annotationUniqueKey, linkedMedia]);

  // Selected / Hovered item details
  const [activeItem, setActiveItem] = useState<TabularRecord | null>(null);

  const extentType = annotation.extent?.extent_type;
  const payloadType = annotation.payload.payload_type;
  const isDark = theme === 'dark';

  // Check if sonification is functionally meaningful for this payload
  const canSonify = useMemo(
    () => isSonifiablePayload(payloadType, extentType),
    [payloadType, extentType]
  );

  const isTimeFrequency =
    extentType === 'time_frequency_box' ||
    payloadType === 'pitch_contour' ||
    payloadType === 'note_hz';

  // Summary stats for metric indicators
  const stats = useMemo(() => computeSummaryStats(annotation, tabularData), [annotation, tabularData]);
  const duration = linkedMedia?.duration || stats.duration || 10;

  // Measure container width dynamically from outer plot card with a deadband to eliminate loop warnings
  useEffect(() => {
    const cardEl = plotCardRef.current;
    if (!cardEl) return;
    const updateWidth = () => {
      const el = plotCardRef.current;
      if (!el) return;
      const w = el.clientWidth;
      if (w && w > 280) {
        // Leave 96px padding for the plot container margins and axis labels
        const targetW = Math.max(300, Math.floor(w - 96));
        setContainerWidth(prev => (Math.abs(prev - targetW) >= 16 ? targetW : prev));
      }
    };
    updateWidth();
    const ro = new ResizeObserver(() => {
      updateWidth();
    });
    ro.observe(cardEl);
    return () => ro.disconnect();
  }, []);

  // Initialize Audio Player
  useEffect(() => {
    const player = new BoppAudioPlayer();
    audioPlayerRef.current = player;

    player.onTimeUpdate(t => {
      setCurrentTime(t);
    });

    player.onEnded(() => {
      setIsPlaying(false);
    });

    return () => {
      player.stop();
    };
  }, []);

  // Update Audio Player data when annotation or linked audio changes
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.loadAnnotation(annotation, tabularData);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [annotation, tabularData]);

  // Render spectrogram when audio is linked and time-frequency is active, aligned to plotBounds
  useEffect(() => {
    if (
      linkedMedia?.audioBuffer &&
      isTimeFrequency &&
      spectrogramCanvasRef.current &&
      plotBounds
    ) {
      renderAudioSpectrogram(linkedMedia.audioBuffer, spectrogramCanvasRef.current, {
        width: plotBounds.width,
        height: plotBounds.height,
        maxFreqHz: 8000,
        minFreqHz: 0,
        colormap: 'magma',
      });
    }
  }, [linkedMedia?.audioBuffer, isTimeFrequency, plotBounds]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(clamped);
    audioPlayerRef.current?.seek(clamped);
  };

  const handleResetPlayback = () => {
    audioPlayerRef.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    audioPlayerRef.current?.setSpeed(spd);
  };

  const handleResetZoom = () => {
    handleZoomPreset('all');
  };

  const handleZoomPreset = (mode: 'all' | 'in' | 'out' | 'left' | 'right') => {
    if (!vegaResultRef.current?.view) return;
    const view = vegaResultRef.current.view;
    try {
      if (typeof view.signal === 'function') {
        try { view.signal('grid', {}); } catch {}
      }

      const brushStore = view.data('brush_store');
      const minX = 0;
      const maxX = duration || 100;
      let cStart = minX;
      let cEnd = maxX;

      if (brushStore && brushStore.length && brushStore[0]?.values?.[0]) {
        const val = brushStore[0].values[0];
        if (typeof val[0] === 'number') cStart = val[0];
        if (typeof val[1] === 'number') cEnd = val[1];
      }

      const span = Math.max(0.5, cEnd - cStart);
      const mid = (cStart + cEnd) / 2;

      let nextStart = cStart;
      let nextEnd = cEnd;

      if (mode === 'all') {
        nextStart = minX;
        nextEnd = maxX;
      } else if (mode === 'in') {
        const nextSpan = Math.max(1.0, span / 2);
        nextStart = Math.max(minX, mid - nextSpan / 2);
        nextEnd = Math.min(maxX, mid + nextSpan / 2);
      } else if (mode === 'out') {
        const nextSpan = Math.min(maxX - minX, span * 2);
        nextStart = Math.max(minX, mid - nextSpan / 2);
        nextEnd = Math.min(maxX, mid + nextSpan / 2);
      } else if (mode === 'left') {
        const shift = span * 0.35;
        nextStart = Math.max(minX, cStart - shift);
        nextEnd = Math.min(maxX, nextStart + span);
      } else if (mode === 'right') {
        const shift = span * 0.35;
        nextEnd = Math.min(maxX, cEnd + shift);
        nextStart = Math.max(minX, nextEnd - span);
      }

      const unit = brushStore?.[0]?.unit || 'concat_1';
      const fields = brushStore?.[0]?.fields || [{ field: 'time', channel: 'x', type: 'R' }];
      const cs = vega.changeset().remove(() => true).insert([{
        unit,
        fields,
        values: [[nextStart, nextEnd]],
      }]);
      view.change('brush_store', cs);
      view.runAsync();
    } catch (e) {
      console.warn('Zoom preset error:', e);
    }
  };

  // Build the Vega-Lite specification
  const vegaSpec = useMemo(() => {
    const options: VegaLiteBuilderOptions = {
      theme,
      colorScheme,
      confidenceChannel,
      minConfidenceFilter,
      enableOverviewBrush,
      enableZoomPan,
      showLabels,
      currentTime: isPlaying ? currentTime : null,
      chartWidth: containerWidth,
      chartHeight: 300,
    };
    return buildBoppVegaLiteSpec(annotation, tabularData, options);
  }, [
    annotation,
    tabularData,
    theme,
    colorScheme,
    confidenceChannel,
    minConfidenceFilter,
    enableOverviewBrush,
    enableZoomPan,
    showLabels,
    currentTime,
    isPlaying,
    containerWidth,
  ]);

  // Embed Vega-Lite into DOM
  useEffect(() => {
    let isMounted = true;
    if (!chartContainerRef.current) return;

    if (vegaResultRef.current) {
      vegaResultRef.current.finalize();
      vegaResultRef.current = null;
    }
    chartContainerRef.current.innerHTML = '';

    const embedOptions = {
      actions: false,
      renderer: 'canvas' as const,
      hover: true,
      tooltip: true,
    };

    vegaEmbed(chartContainerRef.current, vegaSpec as unknown as any, embedOptions)
      .then(res => {
        if (!isMounted) {
          res.finalize();
          return;
        }
        vegaResultRef.current = res;

        // Measure exact inner plot area bounds for precision spectrogram overlay
        try {
          const origin = typeof res.view.origin === 'function' ? res.view.origin() : [0, 0];
          const w = typeof res.view.width === 'function' ? res.view.width() : containerWidth;
          const h = typeof res.view.height === 'function' ? res.view.height() : 340;
          const nextBounds = {
            left: Math.round(origin[0]),
            top: Math.round(origin[1]),
            width: Math.round(w),
            height: Math.round(h),
          };
          setPlotBounds(prev => {
            if (
              prev &&
              prev.left === nextBounds.left &&
              prev.top === nextBounds.top &&
              prev.width === nextBounds.width &&
              prev.height === nextBounds.height
            ) {
              return prev;
            }
            return nextBounds;
          });
        } catch {}

        // Listen for clicks anywhere on the display to seek playhead
        res.view.addEventListener('click', (event: any, item: any) => {
          // If clicked within overview navigator or brush window, ignore seek so brush dragging is uninterrupted!
          if (item?.mark?.name?.includes('concat_1') || item?.mark?.name?.includes('brush')) {
            return;
          }

          if (item && item.datum) {
            setActiveItem(item.datum as TabularRecord);
            let itemSec: number | null = null;
            if (typeof item.datum.time === 'number') {
              itemSec = item.datum.time;
            } else if (typeof item.datum.tick === 'number') {
              itemSec = item.datum.tick / 960; // 480 PPQ @ 120 BPM
            } else if (typeof item.datum.quarter === 'number') {
              itemSec = item.datum.quarter * 0.5; // 120 BPM
            }
            if (itemSec !== null && !isNaN(itemSec)) {
              handleSeek(itemSec);
              return;
            }
          }

          // Also calculate time if clicked anywhere on empty canvas in detail view
          try {
            const viewAny = res.view as any;
            if (typeof viewAny.mouse === 'function') {
              const [, my] = viewAny.mouse(event);
              // Detail view height is typically <= 240px; if click is in bottom overview navigator, skip seek!
              if (my > 230 && (vegaSpec as any)?.vconcat?.length) {
                return;
              }
            }
            const scaleNames = Object.keys((res.view as any)._runtime?.scales || {});
            const candidate = ['x', 'concat_0_x', 'layer_0_x', ...scaleNames.filter(k => k.endsWith('_x'))].find(k => scaleNames.includes(k));
            if (candidate) {
              const sc = res.view.scale(candidate);
              if (sc && typeof sc.invert === 'function' && typeof viewAny.mouse === 'function') {
                const [mx] = viewAny.mouse(event);
                const origin = typeof viewAny.origin === 'function' ? viewAny.origin() : [0, 0];
                let clickedTime = sc.invert(mx - origin[0]);
                if (typeof clickedTime === 'number' && !isNaN(clickedTime)) {
                  if (candidate.includes('tick') || extentType?.includes('tick') || extentType?.includes('midi')) {
                    clickedTime = clickedTime / 960;
                  } else if (candidate.includes('quarter') || extentType?.includes('quarter') || extentType?.includes('score')) {
                    clickedTime = clickedTime * 0.5;
                  }
                  handleSeek(clickedTime);
                }
              }
            }
          } catch {}
        });
      })
      .catch(err => {
        console.error('Vega-Lite render error:', err);
      });

    return () => {
      isMounted = false;
      if (vegaResultRef.current) {
        vegaResultRef.current.finalize();
        vegaResultRef.current = null;
      }
    };
  }, [vegaSpec, duration]);

  // Media Linking Logic
  const handleProcessMediaFile = async (file: File) => {
    const check = checkMediaCompatibility(file.type, file.name, annotation);
    if (!check.compatible) {
      setCompatibilityNotice(`${check.title}: ${check.description}`);
      setTimeout(() => setCompatibilityNotice(null), 6000);
      return;
    }

    const url = URL.createObjectURL(file);

    if (check.mediaType === 'audio') {
      const audioEl = new Audio(url);
      audioEl.preload = 'auto';

      let audioBuffer: AudioBuffer | undefined = undefined;
      try {
        if (audioPlayerRef.current) {
          const audioCtx = audioPlayerRef.current.getAudioContext();
          const arrayBuf = await file.arrayBuffer();
          audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
        }
      } catch (e) {
        console.warn('Could not decode audio buffer for spectrogram:', e);
      }

      audioEl.onloadedmetadata = () => {
        const dur = audioEl.duration;
        setLinkedMedia({
          type: 'audio',
          file,
          url,
          name: file.name,
          size: file.size,
          duration: isNaN(dur) ? undefined : dur,
          audioBuffer,
        });
        audioPlayerRef.current?.setLinkedAudioElement(audioEl);
      };

      // Fallback if metadata already ready
      setLinkedMedia({
        type: 'audio',
        file,
        url,
        name: file.name,
        size: file.size,
        audioBuffer,
      });
      audioPlayerRef.current?.setLinkedAudioElement(audioEl);
    } else if (check.mediaType === 'image') {
      setLinkedMedia({
        type: 'image',
        file,
        url,
        name: file.name,
        size: file.size,
      });
      setActiveMediaTab('overlay');
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessMediaFile(file);
    }
  };

  // Quick Demo Media loader
  const handleLoadDemoSheetMusic = () => {
    const url = generateDemoSheetMusicUrl();
    setLinkedMedia({
      type: 'image',
      file: null,
      url,
      name: 'Prelude_in_C_Major_SheetMusic.svg',
      size: 14200,
    });
    setActiveMediaTab('overlay');
  };

  const handleLoadDemoAudio = async () => {
    const demo = generateDemoAudioForAnnotation(annotation);
    const audioEl = new Audio(demo.url);

    let audioBuffer: AudioBuffer | undefined = undefined;
    try {
      if (audioPlayerRef.current) {
        const audioCtx = audioPlayerRef.current.getAudioContext();
        const res = await fetch(demo.url);
        const arrayBuf = await res.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      }
    } catch (e) {
      console.warn('Failed to decode demo audio buffer:', e);
    }

    setLinkedMedia({
      type: 'audio',
      file: null,
      url: demo.url,
      name: demo.name,
      size: 450000,
      duration: demo.duration,
      audioBuffer,
    });
    audioPlayerRef.current?.setLinkedAudioElement(audioEl);
  };

  const handleUnlinkMedia = () => {
    if (linkedMedia?.type === 'audio') {
      audioPlayerRef.current?.setLinkedAudioElement(null);
    }
    setLinkedMedia(null);
    setActiveMediaTab('chart');
  };

  // Export functions
  const handleExportPng = async () => {
    if (!vegaResultRef.current) return;
    const url = await vegaResultRef.current.view.toImageURL('png');
    const link = document.createElement('a');
    link.download = `${annotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}_visualization.png`;
    link.href = url;
    link.click();
  };

  const handleExportSvg = async () => {
    if (!vegaResultRef.current) return;
    const svgStr = await vegaResultRef.current.view.toSVG();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${annotation.media_id.replace(/[^a-zA-Z0-9]/g, '_')}_visualization.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Palette color preview swatches
  const getPalettePreviewColors = (scheme: string): string[] => {
    switch (scheme) {
      case 'mir_eval_pitch':
        // Chromatic C, C#, D, D#, E, F
        return ['#f2695a', '#f2aa5a', '#f2eb5a', '#5af27f', '#5af2c0', '#5ae2f2'];
      case 'mir_eval_fifths':
        // Circle of fifths C, G, D, A, E, B
        return ['#f2695a', '#f2aa5a', '#f2eb5a', '#5af27f', '#5af2c0', '#5ae2f2'];
      case 'tableau10':
        return ['#4e79a7', '#f28e2b', '#e1575c', '#76b7b2', '#59a14f', '#edc948'];
      case 'category10':
        return ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
      case 'viridis':
        return ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'];
      case 'plasma':
        return ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'];
      case 'magma':
        return ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'];
      case 'turbo':
        return ['#30123b', '#4686fb', '#1ae4b6', '#a2fc3c', '#fbb41a', '#7a0403'];
      case 'dark2':
        return ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02'];
      case 'paired':
        return ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c'];
      default:
        return ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full bg-slate-50 dark:bg-neutral-900 overflow-y-auto relative ${
        isDragOver ? 'ring-4 ring-blue-500 ring-inset bg-blue-50/20' : ''
      }`}
    >
      {/* Hidden file input for linking media */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="audio/*,image/*,.mp3,.wav,.ogg,.flac,.m4a,.png,.jpg,.jpeg,.svg,.webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleProcessMediaFile(f);
          e.target.value = '';
        }}
      />

      {/* Drag & Drop Overlay Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-xs flex flex-col items-center justify-center z-50 pointer-events-none">
          <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border-2 border-dashed border-blue-500 flex flex-col items-center gap-2 text-center">
            <Upload className="w-10 h-10 text-blue-600 animate-bounce" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Drop Media Object to Link with BOPP
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Temporal annotations link with audio files (.mp3, .wav) for playback & spectrograms. Optical annotations link with images (.png, .jpg).
            </p>
          </div>
        </div>
      )}

      {/* Incompatibility Notification Banner */}
      {compatibilityNotice && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md z-40">
          <span>{compatibilityNotice}</span>
          <button
            onClick={() => setCompatibilityNotice(null)}
            className="ml-3 hover:text-amber-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Visualizer Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-slate-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs">
        {/* Metric Badges */}
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-mono">
          <span className="font-bold text-slate-900 dark:text-slate-100">{stats.rowCount}</span>
          <span className="text-slate-500">events</span>
          <span className="text-slate-300 dark:text-neutral-700">·</span>
          <span>extent:</span>
          <span className="text-amber-700 dark:text-amber-400 font-semibold">{stats.extentType}</span>
          <span className="text-slate-300 dark:text-neutral-700">·</span>
          <span>payload:</span>
          <span className="text-blue-700 dark:text-blue-400 font-semibold">{stats.payloadType}</span>
          {stats.confidenceType && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span>conf:</span>
              <span className="text-slate-900 dark:text-slate-100 font-bold">{stats.confidenceType}</span>
            </>
          )}
          {duration !== null && (
            <>
              <span className="text-slate-300 dark:text-neutral-700">·</span>
              <span>span:</span>
              <span className="tabular-nums font-semibold">{duration.toFixed(2)}s</span>
            </>
          )}
        </div>

        {/* Media Linking & View Actions */}
        <div className="flex items-center gap-1.5">
          {/* Media Link button */}
          <button
            onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs"
            title="Link external audio or image file to this annotation"
          >
            {extentType === 'pixel_box' ? (
              <ImageIcon className="w-3.5 h-3.5" />
            ) : (
              <Music className="w-3.5 h-3.5" />
            )}
            <span>Link Media</span>
          </button>

          {/* Quick Demo Media Shortcuts */}
          {extentType === 'pixel_box' && !linkedMedia && (
            <button
              onClick={handleLoadDemoSheetMusic}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              title="Load demo sheet music image to test bounding box alignment"
            >
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Demo Sheet</span>
            </button>
          )}

          {canSonify && !linkedMedia && (
            <button
              onClick={handleLoadDemoAudio}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              title="Attach demo recorded audio to test playhead synchronization"
            >
              <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Demo Audio</span>
            </button>
          )}

          {/* Toggle View Mode for Pixel Boxes */}
          {extentType === 'pixel_box' && linkedMedia?.type === 'image' && (
            <div className="flex items-center rounded border border-slate-300 dark:border-neutral-700 overflow-hidden text-xs">
              <button
                onClick={() => setActiveMediaTab('chart')}
                className={`px-2 py-1 font-medium ${
                  activeMediaTab === 'chart'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Chart
              </button>
              <button
                onClick={() => setActiveMediaTab('overlay')}
                className={`px-2 py-1 font-medium ${
                  activeMediaTab === 'overlay'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Image Overlay
              </button>
            </div>
          )}

          <button
            onClick={onViewSpecClick}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Edit Spec JSON</span>
          </button>
          <button
            onClick={handleExportPng}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
            title="Export as PNG image"
          >
            <Download className="w-3 h-3" />
            <span>PNG</span>
          </button>
          <button
            onClick={handleExportSvg}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
            title="Export as SVG vector"
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Linked Media Status Badge (if media is currently attached) */}
      {linkedMedia && (
        <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {linkedMedia.type === 'audio' ? (
              <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
            <span className="font-semibold text-slate-900 dark:text-white">
              Linked {linkedMedia.type === 'audio' ? 'Audio Source' : 'Image Document'}:
            </span>
            <span className="font-mono text-blue-700 dark:text-blue-300 font-bold">{linkedMedia.name}</span>
            {linkedMedia.duration && (
              <span className="text-slate-500 font-mono">({linkedMedia.duration.toFixed(2)}s)</span>
            )}
          </div>
          <button
            onClick={handleUnlinkMedia}
            className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
          >
            Unlink Media
          </button>
        </div>
      )}

      {/* Meaningful, Expandable Annotation Metadata Box */}
      <AnnotationMetadataCard annotation={annotation} theme={theme} />

      {/* Main Visualization Viewport or Image Overlay View */}
      {activeMediaTab === 'overlay' && linkedMedia?.type === 'image' ? (
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <PixelBoxImageOverlay
            annotation={annotation}
            tabularData={tabularData}
            imageUrl={linkedMedia.url}
            imageName={linkedMedia.name}
            theme={theme}
            onUnlinkImage={handleUnlinkMedia}
          />
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div
            ref={plotCardRef}
            className="w-full flex-1 bg-white dark:bg-neutral-950 rounded-lg border border-slate-300 dark:border-neutral-800 p-4 flex flex-col justify-start overflow-x-auto min-h-[420px] shadow-2xs relative"
          >
            <div className="relative inline-block mx-auto min-w-full">
              {/* Underlying Spectrogram Overlay / Placeholder (positioned directly behind the plot marks) */}
              {isTimeFrequency && showSpectrogram && plotBounds && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${plotBounds.left}px`,
                    top: `${plotBounds.top}px`,
                    width: `${plotBounds.width}px`,
                    height: `${plotBounds.height}px`,
                    zIndex: 1,
                    pointerEvents: linkedMedia?.audioBuffer ? 'none' : 'auto',
                  }}
                  className="overflow-hidden rounded-xs"
                >
                  {linkedMedia?.audioBuffer ? (
                    <div className="w-full h-full relative">
                      <canvas
                        ref={spectrogramCanvasRef}
                        width={plotBounds.width}
                        height={plotBounds.height}
                        className="w-full h-full block opacity-85"
                      />
                      <div className="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono text-white/90 backdrop-blur-xs flex items-center gap-1">
                        <Radio className="w-3 h-3 text-emerald-400" />
                        <span>STFT Spectrogram (0–8,000 Hz)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative pointer-events-none">
                      {/* Compact Corner Hint Badge - leaves plot data 100% visible */}
                      <div className="absolute top-2.5 right-2.5 pointer-events-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200/90 dark:border-neutral-700/90 shadow-md rounded-lg p-2.5 max-w-[270px] text-left transition-all z-20">
                        <div className="flex items-center gap-1.5 mb-1 text-blue-600 dark:text-blue-400">
                          <Radio className="w-3.5 h-3.5" />
                          <span className="font-bold text-[11px] tracking-wide text-slate-800 dark:text-slate-200">
                            Spectrogram Overlay
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mb-2">
                          Link an audio recording to compute and align the STFT spectrogram behind these bounds.
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => mediaInputRef.current?.click()}
                            className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-2.5 h-2.5" />
                            <span>Link Audio</span>
                          </button>
                          <button
                            onClick={handleLoadDemoAudio}
                            className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Demo Audio</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Vega-Lite Chart Canvas */}
              <div
                ref={chartContainerRef}
                style={{ position: 'relative', zIndex: 10 }}
                className="w-full flex items-center justify-start md:justify-center overflow-visible"
              />
            </div>
          </div>

          {/* Synchronized Web Audio & Playback Toolbar */}
          {/* Displayed ONLY when payload is sonifiable OR real audio is linked */}
          {(canSonify || linkedMedia?.type === 'audio') && (
            <div className="mt-3 p-3 bg-white dark:bg-neutral-850 border border-slate-300 dark:border-neutral-800 rounded-lg flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
                    title={
                      isPlaying
                        ? 'Pause Audio Playback'
                        : linkedMedia?.type === 'audio'
                        ? 'Play Master Linked Audio'
                        : 'Play Sonification'
                    }
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>

                  <button
                    onClick={handleResetPlayback}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Rewind to start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="font-mono text-slate-800 dark:text-slate-200 tabular-nums text-xs font-semibold">
                    <span>{currentTime.toFixed(2)}s</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-slate-500">{duration.toFixed(2)}s</span>
                  </div>

                  <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium ml-2 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-700">
                    {linkedMedia?.type === 'audio' ? '🎧 Master Audio File' : `🎹 Sonification (${payloadType})`}
                  </span>
                </div>

                {/* Playback Speed selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Speed:</span>
                  {[0.5, 1.0, 1.5, 2.0].map(spd => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded font-medium transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 border border-slate-200 dark:border-neutral-700'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Scrubber Slider */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={currentTime}
                  onChange={e => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          )}

          {/* Composition Controls Bar */}
          <div className="mt-3 p-3 bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            {/* Color Scheme Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-slate-800 dark:text-slate-200 font-bold">Palette:</span>
              <select
                value={colorScheme}
                onChange={e => setColorScheme(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 rounded text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="mir_eval_fifths">mir_eval Circle of Fifths</option>
                <option value="mir_eval_pitch">mir_eval Chromatic Pitch</option>
                <option value="tableau10">Tableau 10</option>
                <option value="category10">Category 10</option>
                <option value="viridis">Viridis</option>
                <option value="plasma">Plasma</option>
                <option value="magma">Magma</option>
                <option value="turbo">Turbo</option>
                <option value="dark2">Dark 2</option>
                <option value="paired">Paired</option>
              </select>

              {/* Dynamic Color Palette Swatch Chips */}
              <span className="hidden sm:inline-flex items-center gap-1 ml-1" title={`${colorScheme} color swatches`}>
                {getPalettePreviewColors(colorScheme).map((c, i) => (
                  <span
                    key={i}
                    className="w-3 h-3 rounded-full inline-block border border-slate-400"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
            </div>

            {/* Grammar of Graphics: Confidence Rating Channel Selector */}
            {stats.confidenceType && (
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-neutral-800/80 px-2 py-1 rounded-md border border-slate-200 dark:border-neutral-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1">
                    {stats.confidenceType === 'agreement' ? '👥 Agreement:' : stats.confidenceType === 'variance' ? '📊 Variance:' : '🎯 Confidence:'}
                  </span>
                  <div className="inline-flex rounded-md shadow-2xs">
                    {(['meter', 'height', 'opacity', 'none'] as ConfidenceChannelMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setConfidenceChannel(mode)}
                        className={`px-2 py-0.5 text-[11px] font-medium transition-colors first:rounded-l last:rounded-r border border-slate-300 dark:border-neutral-600 ${
                          confidenceChannel === mode
                            ? 'bg-blue-600 text-white font-bold border-blue-600'
                            : 'bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
                        }`}
                        title={
                          mode === 'meter'
                            ? 'Horizontal meter overlay on intervals/boxes, confidence pins on points, error bars on variance'
                            : mode === 'height'
                            ? 'Proportional vertical height fill'
                            : mode === 'opacity'
                            ? 'Opacity binding (0.35–1.0)'
                            : 'Disable confidence overlays'
                        }
                      >
                        {mode === 'meter' ? 'Meter' : mode === 'height' ? 'Height' : mode === 'opacity' ? 'Opacity' : 'Off'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Threshold filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Min:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={minConfidenceFilter}
                    onChange={e => setMinConfidenceFilter(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-slate-200 dark:bg-neutral-700 rounded appearance-none accent-blue-600"
                  />
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100 font-semibold text-[11px]">
                    {minConfidenceFilter.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Toggle Switches */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={e => setShowLabels(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Labels</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={enableOverviewBrush}
                  onChange={e => setEnableOverviewBrush(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Brush Zoom</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={enableZoomPan}
                  onChange={e => setEnableZoomPan(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Pan & Zoom</span>
              </label>

              {enableOverviewBrush && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-neutral-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-0.5">Timeline:</span>
                  <button
                    onClick={() => handleZoomPreset('all')}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Zoom out to show entire piece (100%)"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                    <span>All</span>
                  </button>
                  <button
                    onClick={() => handleZoomPreset('in')}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Zoom in 2x"
                  >
                    <ZoomIn className="w-2.5 h-2.5" />
                    <span>In</span>
                  </button>
                  <button
                    onClick={() => handleZoomPreset('out')}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Zoom out 2x"
                  >
                    <ZoomOut className="w-2.5 h-2.5" />
                    <span>Out</span>
                  </button>
                  <button
                    onClick={() => handleZoomPreset('left')}
                    className="p-0.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Pan window left"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleZoomPreset('right')}
                    className="p-0.5 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Pan window right"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {enableZoomPan && !enableOverviewBrush && (
                <button
                  onClick={handleResetZoom}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded border border-slate-300 dark:border-neutral-700 transition-colors shadow-2xs"
                  title="Reset zoom to full dataset domain"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Reset Zoom</span>
                </button>
              )}

              {isTimeFrequency && (
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showSpectrogram}
                    onChange={e => setShowSpectrogram(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Spectrogram</span>
                </label>
              )}
            </div>
          </div>

          {/* Selected Observation Inspection Drawer (if user clicks an item) */}
          {activeItem && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-neutral-800 border border-blue-300 dark:border-blue-900 rounded-lg flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-2 font-mono text-slate-900 dark:text-slate-100">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-bold text-blue-800 dark:text-blue-300">Selected Event:</span>
                <span>val: <strong className="text-slate-900 dark:text-white font-bold">{String(activeItem.value ?? activeItem.label ?? '')}</strong></span>
                {typeof activeItem.time === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>t: <span className="tabular-nums font-semibold">{activeItem.time.toFixed(3)}s</span></span>
                  </>
                )}
                {typeof activeItem.tick === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>t: <span className="tabular-nums font-semibold">{(activeItem.tick / 960).toFixed(2)}s ({activeItem.tick} ticks)</span></span>
                  </>
                )}
                {typeof activeItem.quarter === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>t: <span className="tabular-nums font-semibold">{(activeItem.quarter * 0.5).toFixed(2)}s ({activeItem.quarter} q)</span></span>
                  </>
                )}
                {typeof activeItem.duration === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>dur: <span className="tabular-nums font-semibold">{typeof activeItem.tick === 'number' ? (activeItem.duration / 960).toFixed(2) + 's (' + activeItem.duration + ' ticks)' : typeof activeItem.quarter === 'number' ? (activeItem.duration * 0.5).toFixed(2) + 's' : activeItem.duration.toFixed(3) + 's'}</span></span>
                  </>
                )}
                {typeof activeItem.confidence === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>
                      {stats.confidenceType === 'agreement' ? 'agreement: ' : 'conf: '}
                      <span className="tabular-nums font-semibold">
                        {(activeItem.confidence * 100).toFixed(1)}%
                      </span>
                      {Boolean(activeItem.agreement_ratio_str) && (
                        <span className="ml-1 text-slate-500 font-mono">
                          (👥 {String(activeItem.agreement_ratio_str)})
                        </span>
                      )}
                    </span>
                  </>
                )}
                {typeof activeItem.confidence_variance === 'number' && (
                  <>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span>
                      var σ²: <span className="tabular-nums font-semibold">{activeItem.confidence_variance.toFixed(4)}</span>
                      {typeof activeItem.confidence_std === 'number' && (
                        <span className="ml-1 text-slate-500 font-mono">
                          (σ={activeItem.confidence_std.toFixed(3)})
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-semibold px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-neutral-700"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
