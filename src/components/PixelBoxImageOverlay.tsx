/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Image Overlay Viewer for Optical BOPP Annotations (pixel_box & pixel)
 * Overlays interactive bounding boxes and 2D pixel coordinates directly on top of sheet music or image documents.
 */

import React, { useState } from 'react';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, ArrowDownUp } from 'lucide-react';

interface PixelBoxImageOverlayProps {
  annotation: BoppAnnotation;
  tabularData: TabularRecord[];
  imageUrl: string;
  imageName: string;
  theme: 'light' | 'dark';
  onUnlinkImage: () => void;
}

export const PixelBoxImageOverlay: React.FC<PixelBoxImageOverlayProps> = ({
  annotation,
  tabularData,
  imageUrl,
  imageName,
  theme,
  onUnlinkImage,
}) => {
  const [boxOpacity, setBoxOpacity] = useState<number>(0.4);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);
  const [invertY, setInvertY] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 800, height: 400 });

  const isDark = theme === 'dark';
  const isPointPixel = annotation.extent?.extent_type === 'pixel';

  // Distinct colors for object classes
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-neutral-900 overflow-hidden">
      {/* Overlay Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-white dark:bg-neutral-850 border-b border-slate-300 dark:border-neutral-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Linked Image:</span>
          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{imageName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-slate-400">
            {tabularData.length} {isPointPixel ? 'Pixel Points' : 'Bounding Boxes'}
          </span>
          {tabularData.some(d => d.confidence != null) && (() => {
            const confs = tabularData.map(d => Number(d.confidence)).filter(c => !isNaN(c));
            const avg = confs.length ? Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 100) : null;
            return avg !== null ? (
              <>
                <span className="text-slate-400">·</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-semibold text-[11px]">
                  Avg Likelihood: {avg}%
                </span>
              </>
            ) : null;
          })()}
        </div>

        <div className="flex items-center gap-3">
          {/* Opacity slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {isPointPixel ? 'Point Fill:' : 'Box Fill:'}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={boxOpacity}
              onChange={e => setBoxOpacity(parseFloat(e.target.value))}
              className="w-16 h-1 bg-slate-200 dark:bg-neutral-700 rounded appearance-none accent-blue-600"
            />
            <span className="font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300 font-semibold">
              {Math.round(boxOpacity * 100)}%
            </span>
          </div>

          {/* Invert Y toggle */}
          <button
            onClick={() => setInvertY(v => !v)}
            title="Toggle inverted Y coordinate axis"
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
              invertY
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-neutral-700'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>{invertY ? 'Y: Inverted' : 'Y: Normal'}</span>
          </button>

          {/* Toggle Labels */}
          <button
            onClick={() => setShowLabels(v => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
              showLabels
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-neutral-700'
            }`}
          >
            {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Labels</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 dark:bg-neutral-800 rounded border border-slate-300 dark:border-neutral-700 p-0.5">
            <button
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.2).toFixed(1)))}
              className="p-1 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold min-w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3.0, +(z + 0.2).toFixed(1)))}
              className="p-1 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded ml-0.5"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={onUnlinkImage}
            className="px-2 py-1 bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 dark:hover:bg-neutral-600 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
          >
            Change Image
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-200/50 dark:bg-neutral-950/50">
        <div
          className="relative inline-block shadow-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition-transform origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <img
            src={imageUrl}
            alt={imageName}
            onLoad={e => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
              }
            }}
            className="block max-w-none select-none pointer-events-none"
            style={{ minWidth: 600 }}
          />

          {/* SVG Overlay of BOPP Bounding Boxes and 2D Points */}
          <svg
            viewBox={`0 0 ${imageDims.width} ${imageDims.height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-auto"
            style={{ width: '100%', height: '100%' }}
          >
            {tabularData.map((record, idx) => {
              const rawX = record.x ?? 0;
              const rawY = record.y ?? 0;
              const x = rawX;
              const y = invertY ? imageDims.height - rawY : rawY;
              const w = record.width ?? 0;
              const h = record.height ?? 0;
              const color = colors[idx % colors.length];
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  {isPointPixel ? (
                    // 2D Pixel Point Marker
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 8 : 5}
                      fill={color}
                      fillOpacity={isHovered ? Math.min(1, boxOpacity + 0.4) : boxOpacity}
                      stroke="#ffffff"
                      strokeWidth={isHovered ? strokeWidth + 1.5 : strokeWidth}
                    />
                  ) : (
                    // Bounding Box
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={color}
                      fillOpacity={isHovered ? Math.min(1, boxOpacity + 0.3) : boxOpacity}
                      stroke={color}
                      strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                      strokeDasharray={isHovered ? '4 2' : undefined}
                      rx={2}
                    />
                  )}

                  {/* Top-edge Likelihood Confidence Meter Bar on Bounding Box */}
                  {!isPointPixel && record.confidence != null && (
                    <g>
                      {/* Backing track */}
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={Math.max(0, w - 2)}
                        height={Math.max(4, Math.min(7, h * 0.12))}
                        fill={isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)'}
                        rx={1}
                      />
                      {/* Active confidence fill */}
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={Math.max(0, (w - 2) * Math.max(0, Math.min(1, Number(record.confidence))))}
                        height={Math.max(4, Math.min(7, h * 0.12))}
                        fill={isDark ? '#38bdf8' : '#0284c7'}
                        rx={1}
                      />
                    </g>
                  )}

                  {showLabels && (
                    <g transform={`translate(${isPointPixel ? x + 8 : x}, ${isPointPixel ? y - 4 : Math.max(14, y - 4)})`}>
                      {(() => {
                        const confStr = record.confidence != null ? ` · ${Math.round(Number(record.confidence) * 100)}%` : '';
                        const fullText = `${String(record.value || '')}${confStr}`;
                        return (
                          <>
                            <rect
                              x={0}
                              y={-14}
                              width={fullText.length * 6.5 + 10}
                              height={16}
                              fill={color}
                              rx={2}
                            />
                            <text
                              x={5}
                              y={-3}
                              fill="#ffffff"
                              fontSize={10}
                              fontWeight="bold"
                              fontFamily="system-ui, sans-serif"
                            >
                              {fullText}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
