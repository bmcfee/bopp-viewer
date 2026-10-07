/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Image Overlay Viewer for Optical BOPP Annotations (pixel_box)
 * Overlays interactive bounding boxes directly on top of sheet music or image documents.
 */

import React, { useState } from 'react';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { Sliders, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const isDark = theme === 'dark';

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
          <span className="text-slate-600 dark:text-slate-400">{tabularData.length} Bounding Boxes</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Opacity slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Box Fill:</span>
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-700 dark:text-slate-300 font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3.0, z + 0.2))}
              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onUnlinkImage}
            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded border border-red-200 dark:border-red-900 transition-colors"
          >
            Unlink
          </button>
        </div>
      </div>

      {/* Main Image & Overlay Canvas */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          className="relative shadow-md rounded border border-slate-300 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-950 transition-transform origin-top-left"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {/* Base Image */}
          <img
            src={imageUrl}
            alt={imageName}
            className="block max-w-none select-none pointer-events-none"
            style={{ minWidth: 600 }}
          />

          {/* SVG Overlay of BOPP Bounding Boxes */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-auto"
            style={{ width: '100%', height: '100%' }}
          >
            {tabularData.map((record, idx) => {
              const x = record.x ?? 0;
              const y = record.y ?? 0;
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

                  {showLabels && (
                    <g transform={`translate(${x}, ${Math.max(14, y - 4)})`}>
                      <rect
                        x={0}
                        y={-14}
                        width={String(record.value || '').length * 7 + 10}
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
                        {String(record.value || '')}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected/Hovered Bounding Box Inspector Card */}
      {hoveredIndex !== null && tabularData[hoveredIndex] && (
        <div className="px-4 py-2 bg-white dark:bg-neutral-850 border-t border-slate-300 dark:border-neutral-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold text-blue-600 dark:text-blue-400">
              Box #{hoveredIndex + 1}:
            </span>
            <span>label: <strong className="text-slate-900 dark:text-white">{String(tabularData[hoveredIndex].value)}</strong></span>
            <span className="text-slate-400">·</span>
            <span>x: {tabularData[hoveredIndex].x}</span>
            <span>y: {tabularData[hoveredIndex].y}</span>
            <span>w: {tabularData[hoveredIndex].width}</span>
            <span>h: {tabularData[hoveredIndex].height}</span>
          </div>
          <span className="text-slate-500 text-[11px]">Hover over other boxes on the sheet to inspect</span>
        </div>
      )}
    </div>
  );
};
