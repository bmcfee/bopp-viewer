/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vega-Lite Specification Builder for BOPP Annotations
 * Composes meaningful visual representations based on extents, payloads, and confidences
 * Integrates mir_eval circle-of-fifths and chromatic pitch color palettes.
 */

import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { annotationToTabular } from './boppParser';
import {
  chordToMirEvalColor,
  keyToMirEvalColor,
  getSplitKeyColors,
  getKeyTonicRank,
  normalizeKeyName,
  parseKeyMode,
  toUnicodeAccidentals,
  ALL_24_KEYS_TOP_TO_BOTTOM,
  FIFTHS_ORDER_12_ROOTS,
  CHROMATIC_ROOT_MAP,
  MIR_EVAL_COLORMAPS,
  registerMirEvalSchemes,
} from './mirEvalColors';
import {
  ConfidenceChannelMode,
  buildIntervalConfidenceLayers,
  buildInstantaneousConfidenceLayers,
  buildVarianceErrorBarLayers,
  getAgreementGlyph,
  getConfidenceColor,
} from './confidenceGrammar';
import {
  isIntervalExtentType,
  analyzeIntervalAnnotation,
} from './intervalOverlap';

// Ensure mir_eval schemes are registered with Vega
registerMirEvalSchemes();

export interface VegaLiteBuilderOptions {
  theme?: 'light' | 'dark';
  colorScheme?: string;
  confidenceChannel?: ConfidenceChannelMode;
  minConfidenceFilter?: number;
  enableOverviewBrush?: boolean;
  enableZoomPan?: boolean;
  showLabels?: boolean;
  currentTime?: number | null; // For synchronized playback head
  chartWidth?: number | string;
  chartHeight?: number;
  forceMultiRow?: boolean; // When true, flips disjoint interval plots to multi-row overlapping display style
}

/**
 * Safely resolves a color scale specification for Vega-Lite.
 * Guarantees that Vega will NEVER fail with "Unrecognized scheme name".
 * Honors palette switcher for chords and all nominal payloads.
 */
export function resolveColorScale(
  schemeName: string,
  payloadType?: string,
  uniqueValues?: string[]
): Record<string, unknown> {
  const isMirEvalFifths = schemeName === 'mir_eval_fifths' || schemeName === 'fifths';
  const isMirEvalPitch = schemeName === 'mir_eval_pitch' || schemeName === 'pitch';

  const validVegaSchemes = new Set([
    'tableau10', 'tableau20', 'category10', 'category20', 'category20b', 'category20c',
    'accent', 'dark2', 'paired', 'pastel1', 'pastel2', 'set1', 'set2', 'set3',
    'viridis', 'magma', 'inferno', 'plasma', 'cividis', 'blues', 'tealblues', 'greens',
    'purples', 'reds', 'oranges', 'spectral', 'warm', 'cool', 'turbo'
  ]);

  if (payloadType === 'chord') {
    if (isMirEvalFifths || isMirEvalPitch) {
      const mode = isMirEvalPitch ? 'pitch' : 'fifths';
      if (uniqueValues && uniqueValues.length > 0) {
        return {
          domain: uniqueValues,
          range: uniqueValues.map(c => chordToMirEvalColor(c, mode)),
        };
      }
      return { range: isMirEvalPitch ? MIR_EVAL_COLORMAPS.pitch : MIR_EVAL_COLORMAPS.fifths };
    }
    // If the user selected an alternative palette in the switcher (Tableau10, Viridis, etc.)
    if (validVegaSchemes.has(schemeName.toLowerCase())) {
      return { scheme: schemeName.toLowerCase() };
    }
    return { range: MIR_EVAL_COLORMAPS.fifths };
  }

  if (payloadType === 'note_midi' || payloadType === 'hz' || payloadType === 'pitch_contour') {
    if (isMirEvalPitch) {
      if (uniqueValues && uniqueValues.length > 0) {
        return {
          domain: uniqueValues,
          range: uniqueValues.map(v => {
            const num = Number(v);
            const pc = isNaN(num) ? 0 : ((Math.round(num) % 12) + 12) % 12;
            return MIR_EVAL_COLORMAPS.pitch[pc];
          }),
        };
      }
      return { range: MIR_EVAL_COLORMAPS.pitch };
    }
    if (isMirEvalFifths) {
      if (uniqueValues && uniqueValues.length > 0) {
        return {
          domain: uniqueValues,
          range: uniqueValues.map(v => {
            const num = Number(v);
            const pc = isNaN(num) ? 0 : ((Math.round(num) % 12) + 12) % 12;
            return MIR_EVAL_COLORMAPS.fifths[pc];
          }),
        };
      }
      return { range: MIR_EVAL_COLORMAPS.fifths };
    }
    if (validVegaSchemes.has(schemeName.toLowerCase())) {
      return { scheme: schemeName.toLowerCase() };
    }
    return { range: MIR_EVAL_COLORMAPS.fifths };
  }

  if (isMirEvalFifths) {
    return { range: MIR_EVAL_COLORMAPS.fifths };
  }
  if (isMirEvalPitch) {
    return { range: MIR_EVAL_COLORMAPS.pitch };
  }

  if (validVegaSchemes.has(schemeName.toLowerCase())) {
    return { scheme: schemeName.toLowerCase() };
  }

  return { range: MIR_EVAL_COLORMAPS.fifths };
}

export function buildBoppVegaLiteSpec(
  annotation: BoppAnnotation,
  data?: TabularRecord[],
  options: VegaLiteBuilderOptions = {}
): Record<string, unknown> {
  const effectiveData = (data && data.length > 0) ? data : annotationToTabular(annotation);
  data = effectiveData;
  const {
    theme = 'dark',
    colorScheme = 'mir_eval_fifths',
    confidenceChannel = 'meter',
    minConfidenceFilter = 0,
    enableOverviewBrush = true,
    enableZoomPan = true,
    showLabels = true,
    currentTime = null,
    chartWidth = 760,
    chartHeight = 320,
    forceMultiRow = false,
  } = options;

  const resolvedWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : 760;

  const extentType = annotation.extent?.extent_type;
  const payloadType = annotation.payload.payload_type;
  const confidenceType = annotation.confidence?.confidence_type;
  const hasConfidence = Boolean(confidenceType);

  const isDark = theme === 'dark';
  // High contrast typography and borders for white and dark backgrounds
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#334155';
  const cursorColor = '#ef4444';

  // Crisp text fill without outlines for 100% legibility on any colored mark or background
  const textFill = isDark ? '#f8fafc' : '#0f172a';

  // Base Vega-Lite config (transparent for time-frequency charts to allow underlying spectrogram overlay)
  const isTimeFrequencyPlot = extentType === 'time_frequency_box' || payloadType === 'pitch_contour';
  const baseConfig = {
    autosize: {
      type: (chartWidth === 'container' ? 'fit-x' : 'pad') as 'fit-x' | 'pad',
      contains: 'padding' as const,
    },
    padding: { left: 28, right: 28, top: 16, bottom: 16 },
    background: isTimeFrequencyPlot ? 'transparent' : isDark ? '#0f172a' : '#ffffff',
    axis: {
      domainColor: axisColor,
      tickColor: axisColor,
      labelColor: textColor,
      titleColor: textColor,
      gridColor: gridColor,
      labelFont: 'system-ui, -apple-system, sans-serif',
      titleFont: 'system-ui, -apple-system, sans-serif',
      labelFontSize: 11,
      titleFontSize: 12,
      titleFontWeight: 'bold' as const,
      titlePadding: 10,
      labelPadding: 6,
    },
    legend: {
      labelColor: textColor,
      titleColor: textColor,
      labelFont: 'system-ui, -apple-system, sans-serif',
      titleFont: 'system-ui, -apple-system, sans-serif',
      orient: 'top',
    },
    view: {
      stroke: isDark ? '#334155' : '#cbd5e1',
      fill: isTimeFrequencyPlot ? 'transparent' : undefined,
    },
  };

  // Base data transform (e.g. filter by confidence)
  const transforms: Record<string, unknown>[] = [];
  if (hasConfidence && minConfidenceFilter > 0) {
    transforms.push({
      filter: `datum.confidence == null || datum.confidence >= ${minConfidenceFilter}`,
    });
  }

  // Pre-calculate time domain if applicable without assuming injected time_end
  let minX = 0;
  let maxX = 10;
  if (data.length > 0) {
    const endTimes = data
      .map(d =>
        (typeof d.time === 'number' ? d.time + (typeof d.duration === 'number' ? d.duration : 0) : null) ??
        (typeof d.quarter === 'number' ? d.quarter + (typeof d.duration === 'number' ? d.duration : 0) : null) ??
        (typeof d.tick === 'number' ? d.tick + (typeof d.duration === 'number' ? d.duration : 0) : null) ??
        0
      )
      .filter(t => typeof t === 'number');
    const startTimes = data
      .map(d => d.time ?? d.quarter ?? d.tick ?? 0)
      .filter(t => typeof t === 'number');
    if (startTimes.length > 0 && endTimes.length > 0) {
      minX = Math.min(0, ...startTimes);
      maxX = Math.max(...endTimes);
      if (maxX <= minX) maxX = minX + 1;
    }
  }

  // Helper for playback cursor layer (converts currentTime to continuous axis unit)
  const makeCursorLayer = (timeField = 'time') => {
    if (currentTime === null || currentTime === undefined) return null;
    let cursorVal = currentTime;
    if (timeField === 'tick') {
      cursorVal = currentTime * 960; // Standard 480 PPQ @ 120 BPM
    } else if (timeField === 'quarter') {
      cursorVal = currentTime * 2; // 120 BPM = 2 quarters/s
    }

    return {
      data: { values: [{ [timeField]: cursorVal }] },
      mark: {
        type: 'rule',
        color: cursorColor,
        size: 2.5,
        strokeDash: [4, 2],
        zIndex: 100,
      },
      encoding: {
        x: { field: timeField, type: 'quantitative' },
      },
    };
  };

  // Helper for zoom/pan params on the primary mark layer (binds strictly continuous X, requires Shift for wheel zoom)
  const makeZoomParam = () =>
    enableZoomPan
      ? [
          {
            name: 'grid',
            select: {
              type: 'interval' as const,
              encodings: ['x'],
              zoom: 'wheel![event.shiftKey]',
            },
            bind: 'scales',
          },
        ]
      : [];

  /**
   * Modular timeline spec composer for any plot with a time-like axis:
   * Provides consistent overview/zoom mode across chords, keys, piano roll, beats, segments, pitch contours, tempo, and scores.
   */
  const composeTimelineSpecWithOverview = ({
    data: plotData,
    transforms: plotTransforms,
    detailLayers,
    overviewLayers,
    xField,
    xTitle,
    minXVal,
    maxXVal,
    plotTitle,
    detailPlotHeight,
  }: {
    data: any[];
    transforms: any[];
    detailLayers: any[];
    overviewLayers?: any[];
    xField: string;
    xTitle: string;
    minXVal: number;
    maxXVal: number;
    plotTitle?: any;
    detailPlotHeight?: number;
  }) => {
    const hasTimeExtent = typeof minXVal === 'number' && typeof maxXVal === 'number' && maxXVal > minXVal;
    const vconcatWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : undefined;
    const finalTitle = plotTitle || { text: `BOPP: ${annotation.media_id}`, color: textColor };

    if (enableOverviewBrush && hasTimeExtent && plotData.length > 0) {
      const topHeight = detailPlotHeight ?? Math.max(160, chartHeight - 74);

      // Strip conflicting wheel/drag zoom params from detail layers so brush selection has authoritative control
      const cleanDetailLayers = detailLayers.map(layer => {
        const { params: _p, ...cleanLayer } = layer as Record<string, any>;
        const enc = (cleanLayer.encoding as Record<string, any>) || {};
        if (enc.x && typeof enc.x === 'object') {
          return {
            ...cleanLayer,
            encoding: {
              ...enc,
              x: {
                ...enc.x,
                scale: { domain: { param: 'brush' } },
              },
            },
          };
        }
        return cleanLayer;
      });

      const brushParam = {
        name: 'brush',
        select: {
          type: 'interval',
          encodings: ['x'],
          mark: {
            fill: isDark ? '#38bdf8' : '#0284c7',
            fillOpacity: isDark ? 0.38 : 0.28,
            stroke: isDark ? '#38bdf8' : '#0284c7',
            strokeWidth: 3,
          },
          zoom: true,
          clear: false,
        },
        value: { [xField]: [minXVal, maxXVal] },
      };

      // Fallback overview layer if custom not provided
      const resolvedOverviewLayers = (overviewLayers && overviewLayers.length > 0)
        ? overviewLayers
        : [
            {
              mark: { type: 'rect', opacity: 0.65, cornerRadius: 2 },
              encoding: {
                x: { field: xField, type: 'quantitative' },
                x2: { field: '_calc_end' },
                y: { value: 2 },
                y2: { value: 50 },
                color: { field: 'value', type: 'nominal', legend: null },
              },
            },
          ];

      const overviewUnit = {
        width: vconcatWidth,
        height: 56,
        title: {
          text: '🔍 TIMELINE NAVIGATOR: Drag window to pan · Drag edges or scroll wheel to zoom · Click & drag to select window',
          color: axisColor,
          fontSize: 10.5,
          fontWeight: 'bold',
        },
        params: [brushParam],
        layer: resolvedOverviewLayers.map(ol => ({
          ...ol,
          encoding: {
            ...ol.encoding,
            x: {
              field: xField,
              type: 'quantitative',
              title: xTitle,
              scale: { domain: [minXVal, maxXVal] },
              ...(ol.encoding?.x?.axis ? { axis: ol.encoding.x.axis } : {}),
            },
          },
        })),
      };

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: plotData },
        transform: plotTransforms,
        config: baseConfig,
        vconcat: [
          {
            width: vconcatWidth,
            height: topHeight,
            title: finalTitle,
            layer: cleanDetailLayers,
          },
          overviewUnit,
        ],
      };
    }

    // Single-unit fallback
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: finalTitle,
      data: { values: plotData },
      transform: plotTransforms,
      config: baseConfig,
      layer: detailLayers,
    };
  };

  // =========================================================================
  // 0. NO EXTENT (Global Media Object Annotation)
  // When extent is omitted, the payload applies globally across the entire media object!
  // =========================================================================
  if (!extentType || (extentType as string) === 'none') {
    // 0A. GLOBAL TEMPO DISPLAY (Calibrated Gauge / KPI Card bounded strictly to view)
    if (payloadType === 'tempo') {
      const tempoVal = typeof data[0]?.value === 'number' ? data[0].value : 120;
      const bpmWidth = typeof chartWidth === 'number' ? Math.min(680, Math.max(340, chartWidth - 80)) : 560;

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: bpmWidth,
        height: 190,
        title: {
          text: `Global Tempo: ${tempoVal.toFixed(1)} BPM`,
          subtitle: `Media ID: ${annotation.media_id} (Constant track tempo across media object)`,
          color: textColor,
          subtitleColor: axisColor,
        },
        data: { values: data },
        config: baseConfig,
        layer: [
          // Background reference track (40 to 220 BPM)
          {
            data: { values: [{ min: 40, max: 220, category: 'Tempo' }] },
            mark: {
              type: 'bar',
              height: 22,
              cornerRadius: 11,
              fill: isDark ? '#1e293b' : '#e2e8f0',
              stroke: isDark ? '#334155' : '#cbd5e1',
              strokeWidth: 1,
            },
            encoding: {
              x: { field: 'min', type: 'quantitative', scale: { domain: [40, 220], clamp: true }, axis: null },
              x2: { field: 'max' },
              y: { field: 'category', type: 'nominal', title: null, axis: null },
            },
          },
          // Active tempo bar
          {
            transform: [
              { calculate: '40', as: 'bar_start' },
              { calculate: 'datum.value', as: 'bar_end' },
              { calculate: "'Tempo'", as: 'category' },
            ],
            mark: {
              type: 'bar',
              height: 22,
              cornerRadius: 11,
              fill: '#f59e0b',
            },
            encoding: {
              x: {
                field: 'bar_start',
                type: 'quantitative',
                scale: { domain: [40, 220], clamp: true },
                title: 'Beats Per Minute (BPM)',
                axis: {
                  values: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220],
                  labelExpr: "datum.value + (datum.value === 60 ? ' (Largo)' : datum.value === 80 ? ' (Andante)' : datum.value === 108 ? ' (Mod)' : datum.value === 120 ? ' (Allegro)' : datum.value === 168 ? ' (Presto)' : '')",
                  titleColor: textColor,
                  labelColor: axisColor,
                },
              },
              x2: { field: 'bar_end' },
              y: { field: 'category', type: 'nominal', title: null, axis: null },
            },
          },
          // Needle indicator tick
          {
            transform: [{ calculate: "'Tempo'", as: 'category' }],
            mark: {
              type: 'tick',
              thickness: 5,
              height: 38,
              color: '#ffffff',
              stroke: '#0f172a',
              strokeWidth: 1.5,
              cornerRadius: 2,
            },
            encoding: {
              x: { field: 'value', type: 'quantitative', scale: { domain: [40, 220], clamp: true } },
              y: { field: 'category', type: 'nominal', title: null, axis: null },
            },
          },
          // Prominent BPM KPI Callout Text inside chart bounds
          {
            transform: [{ calculate: "'Tempo'", as: 'category' }],
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'bottom',
              dy: -20,
              fontSize: 22,
              fontWeight: 'bold',
              fill: '#f59e0b',
              font: 'ui-monospace, monospace',
            },
            encoding: {
              x: { field: 'value', type: 'quantitative', scale: { domain: [40, 220], clamp: true } },
              y: { field: 'category', type: 'nominal', title: null, axis: null },
              text: { field: 'value', type: 'nominal', format: '.1f' },
            },
          },
        ],
      };
    }

    // 0B. GLOBAL KEY MODE DISPLAY: Radial Circle of Fifths Plot with C at the top
    // Supports single or multiple global key annotations (e.g. 75% C:maj and 25% A:min)
    if (payloadType === 'key_mode') {
      const isPitchScheme = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
      const mode = isPitchScheme ? 'pitch' : 'fifths';

      // Parse all global key annotations from data records
      const parsedCandidates = data
        .map((d, idx) => {
          const rawKey = String(d.value ?? '');
          const p = parseKeyMode(rawKey);
          const conf = typeof d.confidence === 'number' ? d.confidence : null;
          const split = getSplitKeyColors(rawKey, mode);
          const isMode = p?.isMode ?? false;
          const displayLabel = p?.isMode ? `${p.root} ${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}` : (p ? `${p.root} ${p.isMinor ? 'Minor' : 'Major'}` : rawKey);
          return {
            index: idx,
            rawKey,
            parsed: p,
            root: p?.root ?? 'C',
            semitone: p?.semitone ?? 0,
            isMinor: p?.isMinor ?? false,
            isMode,
            confidence: conf,
            label: displayLabel,
            fullKey: p?.canonicalKey ?? rawKey,
            color: split.tonicColor,
            tonicColor: split.tonicColor,
            relMajColor: split.relativeMajorColor,
            isSplit: split.isSplit,
          };
        })
        .filter(c => Boolean(c.rawKey && c.parsed));

      const candidates = parsedCandidates.length > 0
        ? parsedCandidates
        : [
            {
              index: 0,
              rawKey: 'C:maj',
              parsed: parseKeyMode('C:maj'),
              root: 'C',
              semitone: 0,
              isMinor: false,
              isMode: false,
              confidence: null as number | null,
              label: 'C Major',
              fullKey: 'C:maj',
              color: keyToMirEvalColor('C:maj', mode),
              tonicColor: keyToMirEvalColor('C:maj', mode),
              relMajColor: keyToMirEvalColor('C:maj', mode),
              isSplit: false,
            },
          ];

      // Sort candidates by confidence descending
      const sortedCandidates = [...candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const primaryCandidate = sortedCandidates[0];
      const hasMultipleCandidates = candidates.length > 1;

      // Concentric Donut Plots: Outer Donut = 12 Major Keys, Inner Donut = 12 Minor Keys
      // Both arranged clockwise in Circle of Fifths order starting from C at 12 o'clock
      // Modes use two adjacent patches on the sector:
      // - Outer adjacent patch (outer half of sector) colored to tonic
      // - Inner adjacent patch (inner half of sector) colored to relative major tonic

      // 1. Outer Ring: Major Keys & Major Modes (Ionian, Lydian, Mixolydian)
      const outerRingValues = FIFTHS_ORDER_12_ROOTS.map((k, i) => {
        const kSem = CHROMATIC_ROOT_MAP[k] ?? 0;
        const matchingCand = sortedCandidates.find(c => c.semitone === kSem && !c.isMinor);
        const isActive = Boolean(matchingCand);
        const candConf = matchingCand?.confidence ?? null;

        const sliceColor = mode === 'pitch'
          ? MIR_EVAL_COLORMAPS.pitch[kSem]
          : MIR_EVAL_COLORMAPS.fifths[kSem];

        const isSplit = Boolean(isActive && matchingCand?.isMode);
        const outerColor = isSplit && matchingCand ? matchingCand.tonicColor : sliceColor;
        const innerColor = isSplit && matchingCand ? matchingCand.relMajColor : sliceColor;

        const confPct = candConf !== null ? `${Math.round(candConf * 100)}%` : '';
        const badgeText = isActive && candConf !== null ? confPct : '';

        // Arc meter geometry along outer rim of donut segment
        const theta0 = -Math.PI / 12 + i * (Math.PI / 6);
        const theta1 = Math.PI / 12 + i * (Math.PI / 6);
        const margin = 0.015;
        const meterStart = theta0 + margin;
        const meterTrackEnd = theta1 - margin;
        const confVal = typeof candConf === 'number' ? Math.max(0, Math.min(1, candConf)) : 0;
        const meterFillEnd = meterStart + confVal * (meterTrackEnd - meterStart);
        const hasMeter = Boolean(isActive && typeof candConf === 'number' && confidenceChannel !== 'none');

        return {
          key: k,
          displayKey: k,
          ring: 'Outer (Major)',
          fifths: i,
          count: 1,
          color: sliceColor,
          outerColor,
          innerColor,
          isSplit,
          active: isActive,
          activeOpacity: isActive ? 1.0 : 0.0,
          activeStroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : 'transparent',
          activeStrokeWidth: isActive ? 3 : 0,
          stroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#334155' : '#cbd5e1'),
          strokeWidth: isActive ? 2.5 : 1,
          opacity: isActive
            ? Math.max(0.85, Math.min(1.0, 0.55 + (candConf ?? 1.0) * 0.45))
            : (isDark ? 0.28 : 0.38),
          textColor: isActive ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
          fullKey: matchingCand?.fullKey ?? `${k}:maj`,
          label: matchingCand?.label ?? `${k} Major`,
          modeName: matchingCand?.isMode ? matchingCand.parsed?.mode : 'Major',
          confidence: candConf,
          confPct,
          badge: badgeText,
          badgeOpacity: isActive && candConf !== null ? 1.0 : 0.0,
          meterStart,
          meterTrackEnd,
          meterFillEnd,
          hasMeter,
          confVal,
          status: isActive
            ? (candConf !== null ? `${matchingCand?.label} (${confPct})` : `Detected ${matchingCand?.label}`)
            : 'Major Sector',
        };
      });

      // 2. Inner Ring: Minor Keys & Minor Modes (Aeolian, Dorian, Phrygian, Locrian)
      const innerRingValues = FIFTHS_ORDER_12_ROOTS.map((k, i) => {
        const kSem = CHROMATIC_ROOT_MAP[k] ?? 0;
        const matchingCand = sortedCandidates.find(c => c.semitone === kSem && c.isMinor);
        const isActive = Boolean(matchingCand);
        const candConf = matchingCand?.confidence ?? null;

        const sliceColor = mode === 'pitch'
          ? MIR_EVAL_COLORMAPS.pitch_dark[kSem]
          : MIR_EVAL_COLORMAPS.fifths_dark[kSem];

        const isSplit = Boolean(isActive && matchingCand?.isMode);
        const outerColor = isSplit && matchingCand ? matchingCand.tonicColor : sliceColor;
        const innerColor = isSplit && matchingCand ? matchingCand.relMajColor : sliceColor;

        const confPct = candConf !== null ? `${Math.round(candConf * 100)}%` : '';
        const badgeText = isActive && candConf !== null ? confPct : '';

        // Arc meter geometry along outer rim of inner donut segment
        const theta0 = -Math.PI / 12 + i * (Math.PI / 6);
        const theta1 = Math.PI / 12 + i * (Math.PI / 6);
        const margin = 0.015;
        const meterStart = theta0 + margin;
        const meterTrackEnd = theta1 - margin;
        const confVal = typeof candConf === 'number' ? Math.max(0, Math.min(1, candConf)) : 0;
        const meterFillEnd = meterStart + confVal * (meterTrackEnd - meterStart);
        const hasMeter = Boolean(isActive && typeof candConf === 'number' && confidenceChannel !== 'none');

        return {
          key: k,
          displayKey: k.toLowerCase(), // Standard lowercase notation for minor
          ring: 'Inner (Minor)',
          fifths: i,
          count: 1,
          color: sliceColor,
          outerColor,
          innerColor,
          isSplit,
          active: isActive,
          activeOpacity: isActive ? 1.0 : 0.0,
          activeStroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : 'transparent',
          activeStrokeWidth: isActive ? 3 : 0,
          stroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#334155' : '#cbd5e1'),
          strokeWidth: isActive ? 2.5 : 1,
          opacity: isActive
            ? Math.max(0.85, Math.min(1.0, 0.55 + (candConf ?? 1.0) * 0.45))
            : (isDark ? 0.25 : 0.35),
          textColor: isActive ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#94a3b8' : '#64748b'),
          fullKey: matchingCand?.fullKey ?? `${k}:min`,
          label: matchingCand?.label ?? `${k} Minor`,
          modeName: matchingCand?.isMode ? matchingCand.parsed?.mode : 'Minor',
          confidence: candConf,
          confPct,
          badge: badgeText,
          badgeOpacity: isActive && candConf !== null ? 1.0 : 0.0,
          meterStart,
          meterTrackEnd,
          meterFillEnd,
          hasMeter,
          confVal,
          status: isActive
            ? (candConf !== null ? `${matchingCand?.label} (${confPct})` : `Detected ${matchingCand?.label}`)
            : 'Minor Sector',
        };
      });

      const wheelSize = typeof chartWidth === 'number' ? Math.min(480, Math.max(360, chartWidth - 60)) : 400;

      const otherCount = sortedCandidates.length - 1;
      const centerSubtitle = primaryCandidate.isMode
        ? `${primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 100)}% · ` : ''}Rel Maj: ${primaryCandidate.parsed?.relativeMajorRoot} Maj`
        : hasMultipleCandidates
        ? `${primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 100)}%` : ''} (Primary)`
        : (primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 1000) / 10}% confidence` : 'Harmonic tonal center');

      const centerDetail = hasMultipleCandidates
        ? `${otherCount} other candidate${otherCount > 1 ? 's' : ''}`
        : 'Circle of Fifths';

      const centerData = [
        {
          title: primaryCandidate.label,
          subtitle: centerSubtitle,
          detail: centerDetail,
          color: primaryCandidate.color,
        },
      ];

      const radialChartSpec: Record<string, unknown> = {
        width: wheelSize,
        height: wheelSize,
        title: {
          text: hasMultipleCandidates
            ? `Global Key Candidates (Concentric Circle of Fifths)`
            : `Global Key: ${primaryCandidate.label} (Concentric Circle of Fifths)`,
          subtitle: `Outer Donut: Major · Inner Donut: Minor · Outer Rim Arcs: Confidence Meters · ${annotation.media_id}`,
          color: textColor,
          subtitleColor: axisColor,
        },
        config: baseConfig,
        layer: [
          // 1A. OUTER DONUT: Outer Half of Sector (Radius 126 - 148, Colored to Tonic)
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { field: 'outerColor', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 126, outerRadius: 148 },
          },
          // 1B. OUTER DONUT: Inner Half of Sector (Radius 104 - 126, Colored to Relative Major for modes, Tonic for simple keys)
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { field: 'innerColor', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 104, outerRadius: 126 },
          },
          // 1C. OUTER DONUT: Perimeter Boundary around Entire Sector (leaves no dividing line between annuli segments)
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { value: 'transparent' },
              stroke: { field: 'stroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'strokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 104, outerRadius: 148 },
          },
          // 2. OUTER DONUT: Active Candidate Accent Highlight Border
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { value: 'transparent' },
              opacity: { field: 'activeOpacity', type: 'quantitative', scale: null },
              stroke: { field: 'activeStroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'activeStrokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 104, outerRadius: 148 },
          },
          // 4A. OUTER DONUT: Confidence Meter Track along Outer Rim (Radius 150 - 156)
          {
            data: { values: outerRingValues },
            transform: [{ filter: 'datum.hasMeter === true' }],
            mark: {
              type: 'arc',
              innerRadius: 150,
              outerRadius: 156,
              cornerRadius: 2,
            },
            encoding: {
              theta: { field: 'meterStart', type: 'quantitative', scale: null },
              theta2: { field: 'meterTrackEnd' },
              color: { value: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.15)' },
              stroke: { value: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.2)' },
              strokeWidth: { value: 0.8 },
              tooltip: [
                { field: 'fullKey', type: 'nominal', title: 'Chord / Key' },
                { field: 'confPct', type: 'nominal', title: 'Confidence' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
          },
          // 4B. OUTER DONUT: Confidence Meter Fill Arc along Outer Rim (Radius 150 - 156)
          {
            data: { values: outerRingValues },
            transform: [{ filter: 'datum.hasMeter === true' }],
            mark: {
              type: 'arc',
              innerRadius: 150,
              outerRadius: 156,
              cornerRadius: 2,
            },
            encoding: {
              theta: { field: 'meterStart', type: 'quantitative', scale: null },
              theta2: { field: 'meterFillEnd' },
              color: { value: isDark ? '#ffffff' : '#0f172a' },
              tooltip: [
                { field: 'fullKey', type: 'nominal', title: 'Chord / Key' },
                { field: 'confPct', type: 'nominal', title: 'Confidence' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
          },
          // 4C. OUTER DONUT: Confidence Badges on Active Slices
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              text: { field: 'badge', type: 'nominal' },
              opacity: { field: 'badgeOpacity', type: 'quantitative', scale: null },
            },
            mark: {
              type: 'text',
              radius: 139,
              fontSize: 9.5,
              fontWeight: 'bold',
              fill: isDark ? '#ffffff' : '#0f172a',
            },
          },

          // 5A. INNER DONUT: Outer Half of Sector (Radius 78 - 98, Colored to Tonic)
          {
            data: { values: innerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { field: 'outerColor', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 78, outerRadius: 98 },
          },
          // 5B. INNER DONUT: Inner Half of Sector (Radius 58 - 78, Colored to Relative Major for modes, Tonic for simple keys)
          {
            data: { values: innerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { field: 'innerColor', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 58, outerRadius: 78 },
          },
          // 5C. INNER DONUT: Perimeter Boundary around Entire Sector (leaves no dividing line between annuli segments)
          {
            data: { values: innerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { value: 'transparent' },
              stroke: { field: 'stroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'strokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 58, outerRadius: 98 },
          },
          // 6. INNER DONUT: Active Candidate Accent Highlight Border
          {
            data: { values: innerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              color: { value: 'transparent' },
              opacity: { field: 'activeOpacity', type: 'quantitative', scale: null },
              stroke: { field: 'activeStroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'activeStrokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 58, outerRadius: 98 },
          },
          // 8A. INNER DONUT: Confidence Meter Track along Outer Rim (Radius 99.5 - 103.5)
          {
            data: { values: innerRingValues },
            transform: [{ filter: 'datum.hasMeter === true' }],
            mark: {
              type: 'arc',
              innerRadius: 99.5,
              outerRadius: 103.5,
              cornerRadius: 1.5,
            },
            encoding: {
              theta: { field: 'meterStart', type: 'quantitative', scale: null },
              theta2: { field: 'meterTrackEnd' },
              color: { value: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.15)' },
              stroke: { value: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.2)' },
              strokeWidth: { value: 0.8 },
              tooltip: [
                { field: 'fullKey', type: 'nominal', title: 'Chord / Key' },
                { field: 'confPct', type: 'nominal', title: 'Confidence' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
          },
          // 8B. INNER DONUT: Confidence Meter Fill Arc along Outer Rim (Radius 99.5 - 103.5)
          {
            data: { values: innerRingValues },
            transform: [{ filter: 'datum.hasMeter === true' }],
            mark: {
              type: 'arc',
              innerRadius: 99.5,
              outerRadius: 103.5,
              cornerRadius: 1.5,
            },
            encoding: {
              theta: { field: 'meterStart', type: 'quantitative', scale: null },
              theta2: { field: 'meterFillEnd' },
              color: { value: isDark ? '#ffffff' : '#0f172a' },
              tooltip: [
                { field: 'fullKey', type: 'nominal', title: 'Chord / Key' },
                { field: 'confPct', type: 'nominal', title: 'Confidence' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
          },
          // 8C. INNER DONUT: Confidence Badges on Active Minor Slices
          {
            data: { values: innerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              text: { field: 'badge', type: 'nominal' },
              opacity: { field: 'badgeOpacity', type: 'quantitative', scale: null },
            },
            mark: {
              type: 'text',
              radius: 68,
              fontSize: 9,
              fontWeight: 'bold',
              fill: isDark ? '#ffffff' : '#0f172a',
            },
          },

          // 9. Perimeter Reference Labels Outside Outer Ring
          {
            data: { values: outerRingValues },
            encoding: {
              theta: {
                field: 'count',
                type: 'quantitative',
                stack: true,
                scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
              },
              order: { field: 'fifths', type: 'quantitative' },
              text: { field: 'key', type: 'nominal' },
              color: { field: 'textColor', type: 'nominal', scale: null },
            },
            mark: {
              type: 'text',
              radius: 170,
              fontSize: 12,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
          },

          // 10. Center Backing Disc (ensures complete legibility inside the inner ring)
          {
            data: { values: [{}] },
            mark: {
              type: 'arc',
              innerRadius: 0,
              outerRadius: 56,
              fill: isDark ? '#090d16' : '#ffffff',
              stroke: isDark ? '#1e293b' : '#e2e8f0',
              strokeWidth: 1.5,
            },
            encoding: {},
          },
          // 11. Center Key Primary Title
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: -14,
              fontSize: 13,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
            encoding: {
              text: { field: 'title', type: 'nominal' },
              color: { field: 'color', type: 'nominal', scale: null },
            },
          },
          // 12. Center Subtitle
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: 3,
              fontSize: 9.5,
              fontWeight: '600',
              fill: axisColor,
            },
            encoding: {
              text: { field: 'subtitle', type: 'nominal' },
            },
          },
          // 13. Center Legend / Detail
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: 18,
              fontSize: 8.5,
              fill: axisColor,
            },
            encoding: {
              text: { field: 'detail', type: 'nominal' },
            },
          },
        ],
      };

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        config: baseConfig,
        ...radialChartSpec,
      };
    }

    // 0C. GLOBAL GENRES & TAGS DISPLAY (Full horizontal quantitative axis with visible bars)
    // Note: mood_thayer static affect is processed in section 8 below (Russell Circumplex)
    if (payloadType !== 'mood_thayer') {
      const colorScale = resolveColorScale(colorScheme, payloadType);
    const tagHeight = Math.max(180, Math.min(420, data.length * 44 + 80));
    const sortedData = [...data].sort(
      (a, b) => (typeof b.confidence === 'number' ? b.confidence : 1) - (typeof a.confidence === 'number' ? a.confidence : 1)
    );
    const barWidth = typeof chartWidth === 'number' ? Math.max(260, chartWidth - 140) : chartWidth;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: barWidth,
      height: tagHeight,
      title: {
        text: `Global ${payloadType === 'tag_open' ? 'Genres & Tags' : payloadType.toUpperCase()}: ${annotation.media_id}`,
        subtitle: 'Scope: Entire Media Object (Global classification and metadata tags)',
        color: textColor,
        subtitleColor: axisColor,
      },
      data: { values: sortedData },
      config: baseConfig,
      encoding: {
        y: {
          field: 'value',
          type: 'nominal',
          title: 'Tag / Genre / Mood',
          sort: null,
          axis: {
            labelFontSize: 12,
            labelFontWeight: 'bold',
            labelColor: textColor,
            titleColor: textColor,
            titleFontSize: 12,
            titleFontWeight: 'bold',
            titlePadding: 16,
            labelPadding: 12,
            minExtent: 160,
            labelLimit: 300,
            domain: true,
            domainColor: axisColor,
            ticks: true,
            tickColor: axisColor,
          },
        },
      },
      layer: [
        // Background track bar (0 to 100%)
        {
          transform: [
            { calculate: '1.0', as: 'full_scale' },
          ],
          mark: {
            type: 'bar',
            height: 24,
            cornerRadius: 4,
            fill: isDark ? '#1e293b' : '#f1f5f9',
          },
          encoding: {
            x: {
              field: 'full_scale',
              type: 'quantitative',
              scale: { domain: [0, 1] },
              axis: null,
            },
          },
        },
        // Active confidence / relevance bar with full horizontal axis
        {
          transform: [
            { calculate: 'datum.confidence != null ? datum.confidence : 1.0', as: 'conf_val' },
          ],
          mark: {
            type: 'bar',
            height: 24,
            cornerRadius: 4,
          },
          encoding: {
            x: {
              field: 'conf_val',
              type: 'quantitative',
              title: hasConfidence ? 'Confidence / Relevance (0–100%)' : 'Presence (Global)',
              scale: { domain: [0, 1] },
              axis: {
                format: '%',
                grid: true,
                tickCount: 5,
                titleColor: textColor,
                titleFontSize: 11,
                titleFontWeight: 'bold',
                labelColor: axisColor,
                labelFontSize: 11,
              },
            },
            color: {
              field: 'value',
              type: 'nominal',
              scale: colorScale,
              legend: null,
            },
            tooltip: [
              { field: 'value', type: 'nominal', title: 'Tag / Genre' },
              ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.2%', title: 'Confidence' }] : []),
            ],
          },
        },
        // In-bar Tag label annotation (guarantees tag name is completely readable directly on the plot itself in exports/images)
        {
          mark: {
            type: 'text',
            align: 'left',
            baseline: 'middle',
            dx: 8,
            fontSize: 11,
            fontWeight: 'bold',
            fill: '#ffffff',
          },
          encoding: {
            x: { value: 0 },
            text: { field: 'value', type: 'nominal' },
          },
        },
        // Numeric percentage or presence annotation at bar end
        {
          transform: [
            { calculate: 'datum.confidence != null ? datum.confidence : 1.0', as: 'conf_val' },
            { calculate: "datum.confidence != null ? round(datum.confidence * 1000) / 10 + '%' : 'Present'", as: 'display_txt' },
          ],
          mark: {
            type: 'text',
            align: 'left',
            baseline: 'middle',
            dx: 8,
            fontSize: 11,
            fontWeight: 'bold',
            fill: textColor,
          },
          encoding: {
            x: { field: 'conf_val', type: 'quantitative' },
            text: { field: 'display_txt', type: 'nominal' },
          },
        },
      ],
    };
    }
  }

  // =========================================================================
  // 1. CHORD (e.g., drive.bopp, chopin_score_quarters.bopp)
  // Supports all extent types: time_interval, score_interval, midi_interval, etc.
  // =========================================================================
  if (payloadType === 'chord') {
    const isScore = extentType === 'score_interval' || extentType === 'score_quarter';
    const isMidi = extentType === 'midi_interval' || extentType === 'midi_tick';

    const xField = isScore ? 'quarter' : isMidi ? 'tick' : 'time';
    const xTitle = isScore ? 'Musical Time (Quarter Notes)' : isMidi ? 'MIDI Tick' : 'Time (seconds)';
    const durField = 'duration';

    // Calculate interval end internally in Vega-Lite transform only
    transforms.push({
      calculate: `datum.${xField} + (datum.duration != null ? datum.duration : 0)`,
      as: '_calc_end',
    });

    // Enrich chords with proper unicode accidentals (♭, ♯)
    const enrichedChordData = data.map(d => ({
      ...d,
      _display_value: toUnicodeAccidentals(String(d.value ?? '')),
    }));

    const layers: Record<string, unknown>[] = [];
    const uniqueChords = Array.from(new Set(enrichedChordData.map(d => d._display_value))).filter(Boolean);
    const chordColorScale = resolveColorScale(colorScheme, 'chord', uniqueChords);

    const isMirEvalFifths = colorScheme === 'mir_eval_fifths' || colorScheme === 'fifths';
    const isMirEvalPitch = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    const colorLegendTitle = isMirEvalFifths
      ? 'Chord (mir_eval Circle of Fifths)'
      : isMirEvalPitch
      ? 'Chord (mir_eval Chromatic Pitch)'
      : 'Chord (Harte)';

    const isInstantaneous = !isScore && !isMidi && extentType === 'time' && data.every(d => d.duration === undefined || d.duration === null || d.duration === 0);

    const mainPlotHeight = enableOverviewBrush ? chartHeight - 80 : chartHeight - 40;

    const rectEncoding: Record<string, unknown> = {
      x: {
        field: xField,
        type: 'quantitative',
        title: xTitle,
        scale: { domain: [minX, maxX] },
      },
      x2: { field: '_calc_end' },
      y: { value: 0 },
      y2: { value: mainPlotHeight },
      color: {
        field: '_display_value',
        type: 'nominal',
        title: colorLegendTitle,
        scale: chordColorScale,
      },
      tooltip: [
        { field: '_display_value', type: 'nominal', title: 'Chord' },
        { field: xField, type: 'quantitative', format: '.3f', title: 'Start' },
        { field: durField, type: 'quantitative', format: '.3f', title: 'Duration' },
        ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence' }] : []),
        ...(confidenceType === 'agreement' ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }] : []),
      ],
    };

    if (hasConfidence && confidenceChannel === 'opacity') {
      rectEncoding.opacity = {
        field: 'confidence',
        type: 'quantitative',
        scale: { domain: [0, 1], range: [0.35, 1.0] },
        title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence',
      };
    } else {
      rectEncoding.opacity = { value: 1.0 };
    }

    if (isInstantaneous) {
      // Instantaneous point chords (e.g. drive_time_points): vertical rules + labels + confidence pins
      layers.push({
        mark: {
          type: 'rule',
          strokeWidth: 2,
          color: isDark ? '#38bdf8' : '#0284c7',
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: xField, type: 'quantitative', title: xTitle, scale: { domain: [minX, maxX] } },
          y: { value: 0 },
          y2: { value: mainPlotHeight },
          color: { field: '_display_value', type: 'nominal', title: colorLegendTitle, scale: chordColorScale },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Chord' },
            { field: xField, type: 'quantitative', format: '.3f', title: 'Position' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
            ...(confidenceType === 'agreement' ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }] : []),
          ],
        },
      });

      if (hasConfidence && confidenceChannel !== 'none') {
        layers.push(...buildInstantaneousConfidenceLayers({
          xField,
          chartHeight,
          isDark,
          confidenceType: confidenceType as any,
          channelMode: confidenceChannel,
          yBaseline: mainPlotHeight,
        }));
      }

      if (showLabels) {
        layers.push({
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'top',
            dy: 4,
            fill: textFill,
            fontWeight: 'bold',
            fontSize: 11,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            y: { value: 4 },
            text: { field: '_display_value', type: 'nominal' },
          },
        });
      }
    } else {
      // Interval chords: rect blocks + confidence meter overlay on top edge
      layers.push({
        mark: {
          type: 'rect',
          stroke: isDark ? '#1e293b' : '#334155',
          strokeWidth: 1,
          cornerRadius: 2,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: rectEncoding,
      });

      // Overlay confidence meter along top edge
      if (hasConfidence && confidenceChannel !== 'none') {
        layers.push(...buildIntervalConfidenceLayers({
          xField,
          endField: '_calc_end',
          durField,
          chartHeight,
          isDark,
          confidenceType: confidenceType as any,
          channelMode: confidenceChannel,
          yTop: 8,
          yBottom: mainPlotHeight,
          meterHeight: 14,
        }));
      }

      // Chord text label layer with high-contrast halo and strict patch-boundary clipping
      if (showLabels) {
        const chordLimitExpr = `max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField})) - 4)`;
        const chordTestExpr = `((scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField}))) <= 10`;

        // 1. Halo backing layer
        layers.push({
          transform: [
            { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0)`, as: 'x_mid' },
            { filter: `datum.duration == null || datum.duration >= 0.2` },
          ],
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'middle',
            fill: 'transparent',
            stroke: 'rgba(0,0,0,0.85)',
            strokeWidth: 3,
            strokeJoin: 'round',
            fontWeight: 'bold',
            fontSize: 11,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            clip: true,
            limit: { expr: chordLimitExpr },
          },
          encoding: {
            x: { field: 'x_mid', type: 'quantitative' },
            y: { value: mainPlotHeight / 2 + 10 },
            text: {
              condition: {
                test: chordTestExpr,
                value: '',
              },
              field: '_display_value',
              type: 'nominal',
            },
          },
        });

        // 2. Crisp foreground text layer
        layers.push({
          transform: [
            { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0)`, as: 'x_mid' },
            { filter: `datum.duration == null || datum.duration >= 0.2` },
          ],
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'middle',
            fill: '#ffffff',
            fontWeight: 'bold',
            fontSize: 11,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            clip: true,
            limit: { expr: chordLimitExpr },
          },
          encoding: {
            x: { field: 'x_mid', type: 'quantitative' },
            y: { value: mainPlotHeight / 2 + 10 },
            text: {
              condition: {
                test: chordTestExpr,
                value: '',
              },
              field: '_display_value',
              type: 'nominal',
            },
          },
        });
      }
    }

    // Cursor
    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    const chordTitle = { text: `BOPP Chords: ${annotation.media_id}`, color: textColor };
    const overviewLayers = isInstantaneous
      ? [
          {
            mark: { type: 'rule', size: 1.5, stroke: isDark ? '#38bdf8' : '#0284c7', opacity: 0.75 },
            encoding: {
              x: { field: xField, type: 'quantitative' },
              y: { value: 4 },
              y2: { value: 50 },
            },
          },
        ]
      : [
          {
            mark: { type: 'rect', opacity: 0.55, cornerRadius: 2 },
            encoding: {
              x: { field: xField, type: 'quantitative' },
              x2: { field: '_calc_end' },
              y: { value: 2 },
              y2: { value: 52 },
              color: { field: '_display_value', type: 'nominal', legend: null, scale: chordColorScale },
            },
          },
        ];

    return composeTimelineSpecWithOverview({
      data: enrichedChordData,
      transforms,
      detailLayers: layers,
      overviewLayers,
      xField,
      xTitle,
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: chordTitle,
      detailPlotHeight: mainPlotHeight,
    });
  }

  // =========================================================================
  // 1.5. KEY_MODE (Key & Mode Modulations)
  // Supports standard keys (C:maj, A:min) and modal tonalities (dorian, phrygian, etc.)
  // When disjoint in time: renders as a single row on the vertical axis!
  // When overlapping: renders across multiple rows on the vertical axis.
  // Modes use split coloring: top/outer colored to tonic, bottom/inner colored to relative major tonic.
  // =========================================================================
  if (payloadType === 'key_mode') {
    const isMidi = extentType?.includes('midi') || extentType?.includes('tick') || (data.length > 0 && typeof data[0].tick === 'number');
    const isScore = extentType?.includes('score') || extentType?.includes('quarter') || (data.length > 0 && typeof data[0].quarter === 'number');

    const xField = isMidi ? 'tick' : isScore ? 'quarter' : 'time';
    const xTitle = isMidi ? 'MIDI Tick' : isScore ? 'Musical Time (Quarter Notes)' : 'Time (seconds)';
    const durField = 'duration';

    const isInterval = extentType?.includes('interval') || data.some(d => typeof d.duration === 'number');

    if (isInterval) {
      transforms.push({
        calculate: `datum.${xField} + (datum.duration != null && datum.duration > 0 ? datum.duration : 1)`,
        as: '_calc_end',
      });
    }

    const intervalAnalysis = isInterval ? analyzeIntervalAnnotation(annotation, data) : null;
    const useSingleRow = Boolean(!forceMultiRow && isInterval && intervalAnalysis?.shouldUseSingleRow);

    const isPitchScheme = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    const mode = isPitchScheme ? 'pitch' : 'fifths';

    // Enrich records with tonic and relative-major split colors and proper unicode accidentals
    const enrichedData = data.map((d, idx) => {
      const rawVal = String(d.value ?? '');
      const parsed = parseKeyMode(rawVal);
      const split = getSplitKeyColors(rawVal, mode);
      const rowKey = parsed ? `${parsed.root}:${parsed.isMinor ? 'min' : 'maj'}` : toUnicodeAccidentals(rawVal);
      const displayVal = toUnicodeAccidentals(rawVal);
      return {
        ...d,
        __key_idx: idx,
        _parsed_root: parsed?.root ?? 'C',
        _row_key: rowKey,
        _display_value: displayVal,
        _is_mode: parsed?.isMode ?? false,
        _mode_name: parsed?.mode ?? 'maj',
        _rel_maj_key: parsed?.relativeMajorKey ?? 'C:maj',
        _color_tonic: split.tonicColor,
        _color_rel: split.relativeMajorColor,
        _is_split: split.isSplit,
      };
    });

    const extraKeys = data.map(d => String(d.value ?? '')).filter(k => k && !ALL_24_KEYS_TOP_TO_BOTTOM.includes(k as any));
    const keyDomain = [...ALL_24_KEYS_TOP_TO_BOTTOM, ...new Set(extraKeys)];
    const keyColors = keyDomain.map(k => keyToMirEvalColor(k, mode));

    const keyColorScale = {
      domain: keyDomain,
      range: keyColors,
    };

    const singleRowAxisTitle = intervalAnalysis?.singleRowLabel || 'Harmonic Key / Mode';
    if (useSingleRow) {
      transforms.push({
        calculate: `'${singleRowAxisTitle}'`,
        as: '_single_row',
      });
    }

    const yField = useSingleRow ? '_single_row' : 'value';
    const yType = 'nominal';
    const yTitle = useSingleRow ? singleRowAxisTitle : 'Tonic Pitch (C at bottom)';

    const layers: Record<string, unknown>[] = [];

    if (!isInterval) {
      // Instantaneous ticks
      layers.push({
        mark: {
          type: 'tick',
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 2,
          size: 24,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: xField,
            type: 'quantitative',
            title: xTitle,
            scale: { domain: [minX, maxX] },
          },
          y: {
            field: yField,
            type: yType,
            title: yTitle,
            scale: { domain: keyDomain },
            axis: {
              labelFontWeight: 'bold',
              labelFontSize: 11,
              titlePadding: 14,
              labelPadding: 8,
              minExtent: 70,
            },
          },
          color: {
            field: '_color_tonic',
            type: 'nominal',
            scale: null,
          },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.75, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Key/Mode' },
            { field: '_rel_maj_key', type: 'nominal', title: 'Relative Major' },
            { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      });
    } else if (useSingleRow) {
      // DISJOINT: Single horizontal track with two adjacent patches for modal annotations
      const trackHeight = 44;
      const halfHeight = trackHeight / 2;

      // Outer bounding container / border
      layers.push({
        mark: {
          type: 'rect',
          height: trackHeight,
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 1.5,
          cornerRadius: 4,
          fill: 'transparent',
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: xField,
            type: 'quantitative',
            title: xTitle,
            scale: { domain: [minX, maxX] },
          },
          x2: { field: '_calc_end' },
          y: {
            field: yField,
            type: yType,
            title: yTitle,
            axis: {
              labels: false,
              ticks: false,
              titlePadding: 14,
              minExtent: 80,
            },
          },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.75, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Key / Mode' },
            { field: '_rel_maj_key', type: 'nominal', title: 'Relative Major' },
            { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
            { field: durField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Duration' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      });

      // Patch 1 (Top adjacent patch): colored to tonic
      layers.push({
        mark: {
          type: 'rect',
          height: halfHeight,
          yOffset: -halfHeight / 2,
          cornerRadiusTopLeft: 4,
          cornerRadiusTopRight: 4,
        },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: yField, type: yType },
          color: { field: '_color_tonic', type: 'nominal', scale: null },
        },
      });

      // Patch 2 (Bottom adjacent patch): colored to relative major tonic for modes, or tonic for simple keys
      layers.push({
        mark: {
          type: 'rect',
          height: halfHeight,
          yOffset: halfHeight / 2,
          cornerRadiusBottomLeft: 4,
          cornerRadiusBottomRight: 4,
        },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: yField, type: yType },
          color: {
            condition: { test: 'datum._is_mode === true', field: '_color_rel', type: 'nominal', scale: null },
            field: '_color_tonic',
            type: 'nominal',
            scale: null,
          },
        },
      });
    } else {
      // OVERLAPPING INTERVALS: Multi-row vertical axis with two adjacent patches per row
      const rowHeight = 22;
      const halfHeight = rowHeight / 2;

      // Outer bounding container / border per row
      layers.push({
        mark: {
          type: 'rect',
          height: rowHeight,
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 1.5,
          cornerRadius: 3,
          fill: 'transparent',
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: xField,
            type: 'quantitative',
            title: xTitle,
            scale: { domain: [minX, maxX] },
          },
          x2: { field: '_calc_end' },
          y: {
            field: yField,
            type: 'nominal',
            title: 'Tonic Pitch (C at bottom)',
            scale: { domain: keyDomain },
            axis: {
              labelFontWeight: 'bold',
              labelFontSize: 11,
              titlePadding: 14,
              labelPadding: 8,
              minExtent: 70,
            },
          },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.75, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Key / Mode' },
            { field: '_rel_maj_key', type: 'nominal', title: 'Relative Major' },
            { field: '_row_key', type: 'nominal', title: 'Tonic Row' },
            { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
            { field: durField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Duration' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      });

      // Patch 1 (Top adjacent patch)
      layers.push({
        mark: {
          type: 'rect',
          height: halfHeight,
          yOffset: -halfHeight / 2,
          cornerRadiusTopLeft: 3,
          cornerRadiusTopRight: 3,
        },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: yField, type: 'nominal', scale: { domain: keyDomain } },
          color: { field: '_color_tonic', type: 'nominal', scale: null },
        },
      });

      // Patch 2 (Bottom adjacent patch)
      layers.push({
        mark: {
          type: 'rect',
          height: halfHeight,
          yOffset: halfHeight / 2,
          cornerRadiusBottomLeft: 3,
          cornerRadiusBottomRight: 3,
        },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: yField, type: 'nominal', scale: { domain: keyDomain } },
          color: {
            condition: { test: 'datum._is_mode === true', field: '_color_rel', type: 'nominal', scale: null },
            field: '_color_tonic',
            type: 'nominal',
            scale: null,
          },
        },
      });
    }

    // Text labels inside patches with high-contrast halo and strict patch-boundary clipping
    if (showLabels && isInterval) {
      const limitExpr = `max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField})) - 4)`;
      const textCondition = {
        test: `((scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField}))) <= 10`,
        value: '',
      };

      // 1. Halo backing layer for absolute legibility on any palette color
      layers.push({
        transform: [
          { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0.5)`, as: 'x_mid' },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: 'transparent',
          stroke: 'rgba(0,0,0,0.85)',
          strokeWidth: 3,
          strokeJoin: 'round',
          fontWeight: 'bold',
          fontSize: 11,
          font: 'system-ui, -apple-system, sans-serif',
          clip: true,
          limit: { expr: limitExpr },
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: useSingleRow ? { field: yField, type: yType } : { field: yField, type: 'nominal', scale: { domain: keyDomain } },
          text: {
            condition: textCondition,
            field: '_display_value',
            type: 'nominal',
          },
        },
      });

      // 2. Crisp foreground text layer
      layers.push({
        transform: [
          { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0.5)`, as: 'x_mid' },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: '#ffffff',
          fontWeight: 'bold',
          fontSize: 11,
          font: 'system-ui, -apple-system, sans-serif',
          clip: true,
          limit: { expr: limitExpr },
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: useSingleRow ? { field: yField, type: yType } : { field: yField, type: 'nominal', scale: { domain: keyDomain } },
          text: {
            condition: textCondition,
            field: '_display_value',
            type: 'nominal',
          },
        },
      });
    }

    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    const keyPlotWidth = typeof chartWidth === 'number' ? Math.max(280, chartWidth - 120) : chartWidth;
    const computedHeight = useSingleRow ? Math.max(160, Math.min(220, chartHeight ?? 180)) : Math.max(520, chartHeight ?? 480);

    const keyTitle = {
      text: `BOPP Key & Mode: ${annotation.media_id}`,
      subtitle: useSingleRow
        ? 'Disjoint Interval Track (1 Row) · Modal Split Colors: Top = Tonic, Bottom = Relative Major Tonic'
        : 'Overlapping Multi-Row Key Tracks · mir_eval Circle of Fifths colors with Modal Split Patches',
      color: textColor,
      subtitleColor: axisColor,
    };

    const overviewLayers = [
      {
        mark: { type: 'rect', opacity: 0.75, cornerRadius: 2 },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { value: 2 },
          y2: { value: 50 },
          color: { field: '_color_tonic', type: 'nominal', scale: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data: enrichedData,
      transforms,
      detailLayers: layers,
      overviewLayers,
      xField,
      xTitle,
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: keyTitle,
      detailPlotHeight: computedHeight,
    });
  }

  // =========================================================================
  // 2. TIME + BEAT (e.g., longbeats.bopp benchmark)
  // =========================================================================
  if (extentType === 'time' && payloadType === 'beat') {
    const isDownbeat = 'datum.value == 1';
    const downbeatColor = isDark ? '#38bdf8' : '#0284c7';
    const regularColor = isDark ? '#475569' : '#94a3b8';

    const layers: Record<string, unknown>[] = [
      // Rules for beats
      {
        mark: { type: 'rule', size: 2 },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: 'time',
            type: 'quantitative',
            title: 'Time (seconds)',
            scale: { domain: [minX, maxX] },
          },
          y: {
            condition: { test: isDownbeat, value: 20 },
            value: 60,
          },
          y2: { value: chartHeight - 40 },
          color: {
            condition: { test: isDownbeat, value: downbeatColor },
            value: regularColor,
          },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Beat Number' },
            { field: 'time', type: 'quantitative', format: '.3f', title: 'Timestamp (s)' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', title: 'Confidence' }] : []),
          ],
        },
      },
      // Accent circle badge on downbeats
      {
        transform: [{ filter: isDownbeat }],
        mark: { type: 'point', filled: true, size: 70, color: downbeatColor },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { value: 20 },
        },
      },
    ];

    if (hasConfidence && confidenceChannel !== 'none') {
      layers.push(...buildInstantaneousConfidenceLayers({
        xField: 'time',
        chartHeight,
        isDark,
        confidenceType: confidenceType as any,
        channelMode: confidenceChannel,
      }));
    }

    if (showLabels) {
      layers.push({
        transform: [{ filter: isDownbeat }],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'bottom',
          dy: -6,
          fill: downbeatColor,
          fontSize: 10,
          fontWeight: 'bold',
        },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { value: 20 },
          text: { value: '1' },
        },
      });
    }

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const beatTitle = { text: `BOPP Beats: ${annotation.media_id}`, color: textColor };
    const overviewLayers = [
      {
        mark: { type: 'rule', size: 1.5, stroke: downbeatColor, opacity: 0.75 },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { value: 4 },
          y2: { value: 50 },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers,
      xField: 'time',
      xTitle: 'Time (seconds)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: beatTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 3. NOTE_MIDI (Piano Roll)
  // Unit height note bars centered on the MIDI pitch number with opaque boxes!
  // Colors matched to mir_eval palette by pitch class (C=0 .. B=11)
  // =========================================================================
  if (payloadType === 'note_midi') {
    const isMidi = extentType?.includes('midi') || extentType?.includes('tick') || (data.length > 0 && typeof data[0].tick === 'number');
    const isScore = extentType?.includes('score') || extentType?.includes('quarter') || (data.length > 0 && typeof data[0].quarter === 'number');
    const xField = isMidi ? 'tick' : isScore ? 'quarter' : 'time';
    const xTitle = isMidi ? 'MIDI Tick' : isScore ? 'Musical Quarter Notes' : 'Time (seconds)';
    
    const isPitchScheme = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    // mir_eval exact pitch class colors: 12 elements for semitones 0 (C) through 11 (B)
    const pitchClassColors = isPitchScheme ? MIR_EVAL_COLORMAPS.pitch : MIR_EVAL_COLORMAPS.fifths;

    // Internal transforms for unit-height centered notes:
    // Centered on datum.value: spans [datum.value - 0.5, datum.value + 0.5], unit height = 1.0!
    // Internal calculate for interval end and pitch class:
    transforms.push(
      { calculate: 'datum.value - 0.5', as: 'y_min' },
      { calculate: 'datum.value + 0.5', as: 'y_max' },
      { calculate: `datum.${xField} + (datum.duration != null && datum.duration > 0 ? datum.duration : 0.25)`, as: '_calc_end' },
      { calculate: '((floor(datum.value) % 12) + 12) % 12', as: 'pitch_class' },
      { calculate: "['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((floor(datum.value) % 12) + 12) % 12]", as: 'pitch_class_name' }
    );

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: 'rect',
          cornerRadius: 2,
          opacity: 1,
          fillOpacity: 1,
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 0.8,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: xField, type: 'quantitative', title: xTitle, scale: { domain: [minX, maxX] } },
          x2: { field: '_calc_end' },
          y: {
            field: 'y_min',
            type: 'quantitative',
            title: 'Pitch / Note',
            scale: { zero: false, padding: 8 },
            axis: {
              tickMinStep: 1,
              labelExpr: "['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][datum.value % 12] + (floor(datum.value / 12) - 1) + ' (' + datum.value + ')'",
            },
          },
          y2: { field: 'y_max' },
          color: {
            field: 'pitch_class',
            type: 'nominal',
            scale: {
              domain: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
              range: pitchClassColors,
            },
            legend: {
              title: 'Pitch Class',
              labelExpr: "['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][datum.value]",
              orient: 'right',
            },
          },
          opacity: { value: 1.0 },
          tooltip: [
            { field: 'note_name', type: 'nominal', title: 'Note' },
            { field: 'pitch_class_name', type: 'nominal', title: 'Pitch Class' },
            { field: 'value', type: 'quantitative', title: 'MIDI Pitch' },
            { field: xField, type: 'quantitative', format: '.2f', title: 'Start' },
            { field: 'duration', type: 'quantitative', format: '.2f', title: 'Duration' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    // Overlay confidence meter along the top edge of each piano note
    if (hasConfidence && confidenceChannel === 'meter') {
      layers.push(
        // Backing track
        {
          transform: [
            { filter: 'datum.confidence != null' },
            { calculate: 'datum.value + 0.3', as: '_note_meter_y1' },
          ],
          mark: {
            type: 'rect',
            fill: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.25)',
            cornerRadius: 1,
          },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            x2: { field: '_calc_end' },
            y: { field: '_note_meter_y1', type: 'quantitative' },
            y2: { field: 'y_max' },
          },
        },
        // Active confidence fill
        {
          transform: [
            { filter: 'datum.confidence != null && datum.confidence > 0' },
            { calculate: 'datum.value + 0.3', as: '_note_meter_y1' },
            {
              calculate: `datum.${xField} + (datum.duration != null ? datum.duration * datum.confidence : 0.25 * datum.confidence)`,
              as: '_note_conf_end',
            },
          ],
          mark: { type: 'rect', cornerRadius: 1 },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            x2: { field: '_note_conf_end' },
            y: { field: '_note_meter_y1', type: 'quantitative' },
            y2: { field: 'y_max' },
            color: {
              field: 'confidence',
              type: 'quantitative',
              scale: {
                domain: [0, 0.65, 0.85, 1.0],
                range: isDark
                  ? ['#64748b', '#94a3b8', '#e2e8f0', '#ffffff']
                  : ['#94a3b8', '#64748b', '#334155', '#0f172a'],
              },
              legend: null,
            },
          },
        }
      );
    }

    if (showLabels) {
      layers.push({
        transform: [
          { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0.125)`, as: 'x_mid' },
          { filter: `datum.duration == null || datum.duration >= 0.15` },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fontSize: 9,
          fontWeight: 'bold',
          fill: '#000000',
          clip: true,
          limit: { expr: `max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField})) - 2)` },
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: { field: 'value', type: 'quantitative' },
          text: {
            condition: {
              test: `((scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField}))) <= 8`,
              value: '',
            },
            field: 'note_name',
            type: 'nominal',
          },
        },
      });
    }

    const cursor = makeCursorLayer(xField);
    const pianoTitle = { text: `BOPP MIDI Piano Roll: ${annotation.media_id}`, color: textColor };
    const overviewLayers = [
      {
        mark: { type: 'rect', opacity: 0.75, cornerRadius: 1 },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: 'y_min', type: 'quantitative', scale: { zero: false }, axis: null },
          y2: { field: 'y_max' },
          color: {
            field: 'pitch_class',
            type: 'nominal',
            scale: { domain: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], range: pitchClassColors },
            legend: null,
          },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers,
      xField,
      xTitle,
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: pianoTitle,
      detailPlotHeight: chartHeight + 20,
    });
  }

  // =========================================================================
  // 4. TIME_INTERVAL + MULTI_SEGMENT / SEGMENT_OPEN (Structural Analysis)
  // =========================================================================
  if (extentType === 'time_interval' && (payloadType === 'multi_segment' || payloadType === 'segment_open')) {
    const isMulti = payloadType === 'multi_segment';
    const intervalAnalysis = analyzeIntervalAnnotation(annotation, data);
    const useSingleRow = Boolean(!forceMultiRow && !isMulti && intervalAnalysis.shouldUseSingleRow);

    if (useSingleRow) {
      transforms.push({
        calculate: `'${intervalAnalysis.singleRowLabel}'`,
        as: '_single_row',
      });
    }

    const yField = isMulti ? 'level' : useSingleRow ? '_single_row' : 'value';
    const yType = isMulti ? 'ordinal' : 'nominal';
    const yTitle = isMulti ? 'Structural Level' : useSingleRow ? intervalAnalysis.singleRowLabel : 'Section';
    const colorField = isMulti ? 'label' : 'value';
    const colorScale = resolveColorScale(colorScheme, payloadType);

    transforms.push({
      calculate: 'datum.time + (datum.duration != null ? datum.duration : 0)',
      as: '_calc_end',
    });

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: 'rect',
          stroke: isDark ? '#0f172a' : '#1e293b',
          strokeWidth: 1,
          cornerRadius: 4,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
          x2: { field: '_calc_end' },
          y: {
            field: yField,
            type: yType,
            title: yTitle,
            axis: {
              ...(useSingleRow ? { labels: false, ticks: false } : { labelFontWeight: 'bold', labelPadding: 8 }),
              titlePadding: 14,
              minExtent: 75,
            },
          },
          color: { field: colorField, type: 'nominal', title: 'Segment', scale: colorScale },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: colorField, type: 'nominal', title: 'Section' },
            ...(payloadType === 'multi_segment' ? [{ field: 'level', type: 'quantitative', title: 'Level' }] : []),
            { field: 'time', type: 'quantitative', format: '.2f', title: 'Start (s)' },
            { field: 'duration', type: 'quantitative', format: '.2f', title: 'Duration (s)' },
            ...(hasConfidence ? [
              { field: 'confidence', type: 'quantitative', format: '.1%', title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence' },
              ...(confidenceType === 'agreement' ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }] : []),
            ] : []),
          ],
        },
      },
    ];

    // Centered text labels for single row disjoint segments when enabled
    if (useSingleRow && showLabels) {
      transforms.push({
        calculate: '(datum.time + (datum.time + (datum.duration != null ? datum.duration : 0))) / 2',
        as: '_label_midpoint',
      });
      layers.push({
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: textFill,
          fontWeight: 'bold',
          fontSize: 11,
          clip: true,
          limit: { expr: "max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.time) != null ? scale('concat_0_x', datum.time) : scale('x', datum.time)) - 4)" },
        },
        encoding: {
          x: { field: '_label_midpoint', type: 'quantitative' },
          y: { field: yField, type: yType },
          text: {
            condition: {
              test: "((scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.time) != null ? scale('concat_0_x', datum.time) : scale('x', datum.time))) <= 12",
              value: '',
            },
            field: colorField,
            type: 'nominal',
          },
        },
      });
    }

    // Overlay horizontal confidence / agreement meter strip along the top edge of each segment block
    if (hasConfidence && confidenceChannel === 'meter') {
      layers.push(
        // Backing track
        {
          mark: {
            type: 'rect',
            yOffset: -12,
            height: 3.5,
            fill: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.25)',
            cornerRadius: 1,
          },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_calc_end' },
            y: { field: yField, type: yType },
          },
        },
        // Active agreement fill
        {
          transform: [
            { calculate: 'datum.time + (datum.duration != null ? datum.duration * (datum.confidence != null ? datum.confidence : 1.0) : 0)', as: '_seg_conf_end' },
          ],
          mark: {
            type: 'rect',
            yOffset: -12,
            height: 3.5,
            cornerRadius: 1,
          },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_seg_conf_end' },
            y: { field: yField, type: yType },
            color: {
              field: 'confidence',
              type: 'quantitative',
              scale: {
                domain: [0, 0.65, 0.85, 1.0],
                range: isDark
                  ? ['#64748b', '#94a3b8', '#e2e8f0', '#ffffff']
                  : ['#94a3b8', '#64748b', '#334155', '#0f172a'],
              },
              legend: null,
            },
          },
        }
      );
    }

    if (showLabels) {
      layers.push({
        transform: [
          { calculate: 'datum.time + (datum.duration != null ? datum.duration / 2 : 0)', as: 'time_mid' },
          {
            calculate: hasConfidence && confidenceType === 'agreement' && Boolean(data.some(d => d.agreement_ratio_str))
              ? "datum." + colorField + " + (datum.agreement_ratio_str != null ? ' · 👥 ' + datum.agreement_ratio_str : '')"
              : hasConfidence
              ? "datum." + colorField + " + (datum.confidence != null ? ' (' + round(datum.confidence * 100) + '%)' : '')"
              : "datum." + colorField,
            as: '_display_label',
          },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: textFill,
          fontWeight: 'bold',
          fontSize: 11,
          clip: true,
          limit: { expr: "max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.time) != null ? scale('concat_0_x', datum.time) : scale('x', datum.time)) - 4)" },
        },
        encoding: {
          x: { field: 'time_mid', type: 'quantitative' },
          y: { field: yField, type: yType },
          text: {
            condition: {
              test: "((scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.time) != null ? scale('concat_0_x', datum.time) : scale('x', datum.time))) <= 12",
              value: '',
            },
            field: '_display_label',
            type: 'nominal',
          },
        },
      });
    }

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const segTitle = { text: `BOPP Structural Segmentation: ${annotation.media_id}`, color: textColor };
    const segOverviewLayers = [
      {
        mark: { type: 'rect', opacity: 0.85, cornerRadius: 2 },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          x2: { field: '_calc_end' },
          ...(isMulti
            ? { y: { field: 'level', type: 'ordinal', axis: null } }
            : { y: { value: 2 }, y2: { value: 50 } }),
          color: { field: colorField, type: 'nominal', scale: colorScale, legend: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers: segOverviewLayers,
      xField: 'time',
      xTitle: 'Time (seconds)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: segTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 5. TIME_FREQUENCY_BOX (Spectrogram TF Bounding Boxes)
  // =========================================================================
  if (extentType === 'time_frequency_box') {
    const colorScale = resolveColorScale(colorScheme, payloadType);
    transforms.push({
      calculate: 'datum.time + (datum.duration != null ? datum.duration : 0)',
      as: '_calc_end',
    });

    // Harmonize scale domains with standard 0..8000 Hz spectrogram audio analysis
    const tfMaxTime = Math.max(12.0, Math.ceil(maxX + 0.5));
    const tfMaxFreq = 8000;

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: 'rect',
          fillOpacity: isDark ? 0.45 : 0.4,
          strokeWidth: 2,
          cornerRadius: 2,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [0, tfMaxTime] } },
          x2: { field: '_calc_end' },
          y: {
            field: 'freq_min',
            type: 'quantitative',
            title: 'Frequency (Hz)',
            scale: { domain: [0, tfMaxFreq], zero: true },
          },
          y2: { field: 'freq_max' },
          color: { field: 'value', type: 'nominal', title: 'Event / Sound Class', scale: colorScale },
          stroke: { field: 'value', type: 'nominal', scale: colorScale },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Class' },
            { field: 'time', type: 'quantitative', format: '.3f', title: 'Start Time (s)' },
            { field: 'duration', type: 'quantitative', format: '.3f', title: 'Duration (s)' },
            { field: 'freq_min', type: 'quantitative', format: '.1f', title: 'Freq Min (Hz)' },
            { field: 'freq_max', type: 'quantitative', format: '.1f', title: 'Freq Max (Hz)' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    // Top-edge confidence meter overlay for bounding boxes
    if (hasConfidence && confidenceChannel === 'meter') {
      layers.push(
        // Backing track along the top border (freq_max)
        {
          transform: [
            { calculate: 'datum.freq_max - max(80, (datum.freq_max - datum.freq_min) * 0.08)', as: '_tf_meter_bottom' },
          ],
          mark: { type: 'rect', fill: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)', cornerRadius: 1 },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_calc_end' },
            y: { field: '_tf_meter_bottom', type: 'quantitative' },
            y2: { field: 'freq_max' },
          },
        },
        // Active confidence fill
        {
          transform: [
            { calculate: 'datum.freq_max - max(80, (datum.freq_max - datum.freq_min) * 0.08)', as: '_tf_meter_bottom' },
            { calculate: 'datum.time + (datum.duration != null ? datum.duration * (datum.confidence != null ? datum.confidence : 1.0) : 0)', as: '_tf_conf_end' },
          ],
          mark: { type: 'rect', cornerRadius: 1 },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_tf_conf_end' },
            y: { field: '_tf_meter_bottom', type: 'quantitative' },
            y2: { field: 'freq_max' },
            color: {
              field: 'confidence',
              type: 'quantitative',
              scale: {
                domain: [0, 0.65, 0.85, 1.0],
                range: isDark
                  ? ['#64748b', '#94a3b8', '#e2e8f0', '#ffffff']
                  : ['#94a3b8', '#64748b', '#334155', '#0f172a'],
              },
              legend: null,
            },
          },
        }
      );
    }

    if (showLabels) {
      layers.push({
        transform: [
          {
            calculate: "datum.value + (datum.confidence != null ? ' (' + round(datum.confidence * 100) + '%)' : '')",
            as: '_tf_label',
          },
        ],
        mark: {
          type: 'text',
          align: 'left',
          baseline: 'bottom',
          dx: 4,
          dy: -2,
          fontSize: 10,
          fontWeight: 'bold',
          fill: textFill,
        },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { field: 'freq_max', type: 'quantitative' },
          text: { field: '_tf_label', type: 'nominal' },
        },
      });
    }

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const tfTitle = { text: `BOPP Time-Frequency Bounding Boxes: ${annotation.media_id}`, color: textColor };
    const tfOverviewLayers = [
      {
        mark: { type: 'rect', fillOpacity: 0.5, strokeWidth: 1 },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: { field: 'freq_min', type: 'quantitative', scale: { domain: [0, tfMaxFreq], zero: true }, axis: null },
          y2: { field: 'freq_max' },
          color: { field: 'value', type: 'nominal', scale: colorScale, legend: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers: tfOverviewLayers,
      xField: 'time',
      xTitle: 'Time (seconds)',
      minXVal: 0,
      maxXVal: tfMaxTime,
      plotTitle: tfTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 6. PIXEL_BOX (Image / Optical Music Bounding Boxes)
  // =========================================================================
  if (extentType === 'pixel_box') {
    const colorScale = resolveColorScale(colorScheme, payloadType);
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Pixel Bounding Boxes: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: [
        {
          transform: [
            { calculate: 'datum.x + datum.width', as: 'x2' },
            { calculate: 'datum.y + datum.height', as: 'y2' },
          ],
          mark: { type: 'rect', fillOpacity: isDark ? 0.35 : 0.25, strokeWidth: 2 },
          ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
          encoding: {
            x: { field: 'x', type: 'quantitative', title: 'X (pixels)' },
            x2: { field: 'x2' },
            // Invert Y axis for image coordinates standard (top-left 0,0)
            y: { field: 'y', type: 'quantitative', title: 'Y (pixels)', scale: { reverse: true } },
            y2: { field: 'y2' },
            color: { field: 'value', type: 'nominal', title: 'Object Class', scale: colorScale },
            stroke: { field: 'value', type: 'nominal', scale: colorScale },
            tooltip: [
              { field: 'value', type: 'nominal', title: 'Object' },
              { field: 'x', type: 'quantitative', title: 'X' },
              { field: 'y', type: 'quantitative', title: 'Y' },
              { field: 'width', type: 'quantitative', title: 'Width' },
              { field: 'height', type: 'quantitative', title: 'Height' },
            ],
          },
        },
      ],
    };
  }

  // =========================================================================
  // 7. TIME + PITCH_CONTOUR (Continuous F0 vocal/instrument melody)
  // =========================================================================
  if (extentType === 'time' && (payloadType === 'pitch_contour' || (payloadType as string) === 'note_hz')) {
    const layers: Record<string, unknown>[] = [];

    // If variance confidence is present, add shaded 95% Confidence Interval error ribbon (±1.96σ)
    if (hasConfidence && confidenceType === 'variance' && confidenceChannel !== 'none') {
      layers.push({
        transform: [
          { filter: 'datum.frequency_ci_lower != null && datum.frequency_ci_upper != null' },
        ],
        mark: {
          type: 'area',
          opacity: isDark ? 0.16 : 0.10,
          color: isDark ? '#ffffff' : '#000000',
        },
        encoding: {
          x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
          y: { field: 'frequency_ci_lower', type: 'quantitative', title: 'Pitch F0 (Hz)', scale: { zero: false } },
          y2: { field: 'frequency_ci_upper' },
        },
      });

      // Whiskers and horizontal caps (Achromatic: white in dark mode, dark charcoal in light mode)
      layers.push(...buildVarianceErrorBarLayers({
        xField: 'time',
        yField: 'frequency',
        lowerField: 'frequency_ci_lower',
        upperField: 'frequency_ci_upper',
        isDark,
        capWidth: 8,
        whiskerColor: isDark ? '#ffffff' : '#0f172a',
      }));
    }

    // Trajectory smooth guide line
    layers.push({
      mark: {
        type: 'line',
        strokeWidth: 2,
        stroke: isDark ? '#38bdf8' : '#0284c7',
        interpolate: 'monotone',
      },
      encoding: {
        x: { field: 'time', type: 'quantitative', scale: { domain: [minX, maxX] } },
        y: { field: 'frequency', type: 'quantitative', scale: { zero: false } },
      },
    });

    // Sample points colored by voiced state
    layers.push({
      mark: { type: 'point', filled: true, size: 55 },
      ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
      encoding: {
        x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
        y: { field: 'frequency', type: 'quantitative', title: 'Fundamental Frequency F0 (Hz)', scale: { zero: false } },
        color: {
          field: 'voicing',
          type: 'nominal',
          scale: { domain: [0, 1], range: ['#94a3b8', isDark ? '#38bdf8' : '#0284c7'] },
          legend: {
            title: 'Voicing',
            labelExpr: "datum.value == 1 ? 'Voiced' : 'Unvoiced'",
          },
        },
        tooltip: [
          { field: 'time', type: 'quantitative', format: '.3f', title: 'Time (s)' },
          { field: 'frequency', type: 'quantitative', format: '.2f', title: 'Pitch F0 (Hz)' },
          { field: 'voicing', type: 'nominal', title: 'Voiced (1=yes, 0=no)' },
          ...(hasConfidence ? [
            { field: 'confidence_variance', type: 'quantitative', format: '.2f', title: 'Variance (σ²)' },
            { field: 'confidence_std', type: 'quantitative', format: '.2f', title: 'Std Dev (σ Hz)' },
            { field: 'frequency_ci_lower', type: 'quantitative', format: '.2f', title: '95% CI Lower (Hz)' },
            { field: 'frequency_ci_upper', type: 'quantitative', format: '.2f', title: '95% CI Upper (Hz)' },
          ] : []),
        ],
      },
    });

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const contourTitle = { text: `BOPP Vocal Melody & Pitch Contour (F0): ${annotation.media_id}`, color: textColor };
    const overviewLayers = [
      {
        mark: {
          type: 'line',
          interpolate: 'monotone',
          strokeWidth: 2,
          color: isDark ? '#38bdf8' : '#0284c7',
        },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { field: 'frequency', type: 'quantitative', scale: { zero: false }, axis: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers,
      xField: 'time',
      xTitle: 'Time (seconds)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: contourTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 8. MOOD_THAYER (Circumplex Valence-Arousal Trajectory or Static Affect)
  // =========================================================================
  if (payloadType === 'mood_thayer') {
    const hasTimeExtent = Boolean(extentType && data.some(d => typeof d.time === 'number'));

    // Case A: Static mood without time dynamics (e.g., overall track emotional appraisal)
    if (!hasTimeExtent) {
      // 1:1 square isometric dimensions to match the 2D Circumplex subplot
      const circumplexSize = typeof chartWidth === 'number'
        ? Math.min(460, Math.max(340, chartWidth - 80))
        : 380;

      const hasVariance = data.some(
        d => (typeof d.confidence_variance === 'number' && d.confidence_variance > 0) ||
             (typeof d.confidence_std === 'number' && d.confidence_std > 0)
      ) || annotation.confidence?.confidence_type === 'variance';

      // Circumplex Quadrant Background Lines & Quadrant Labels (Matching right-hand circumplex subplot)
      const quadrantAxes = [
        {
          data: { values: [{ x: 0 }] },
          mark: { type: 'rule', stroke: gridColor, strokeWidth: 1.5 },
          encoding: { x: { field: 'x', type: 'quantitative', scale: { domain: [-1.1, 1.1] } } },
        },
        {
          data: { values: [{ y: 0 }] },
          mark: { type: 'rule', stroke: gridColor, strokeWidth: 1.5 },
          encoding: { y: { field: 'y', type: 'quantitative', scale: { domain: [-1.1, 1.1] } } },
        },
        {
          data: {
            values: [
              { x: 0.7, y: 0.8, label: 'Happy / Excited' },
              { x: -0.7, y: 0.8, label: 'Angry / Tense' },
              { x: -0.7, y: -0.8, label: 'Sad / Depressed' },
              { x: 0.7, y: -0.8, label: 'Calm / Relaxed' },
            ],
          },
          mark: { type: 'text', fontSize: 10, fill: axisColor, fontWeight: 'bold' },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            text: { field: 'label', type: 'nominal' },
          },
        },
      ];

      if (hasVariance) {
        // Collect points and variances
        const points = data.map((d, idx) => {
          const muV = typeof d.valence === 'number' ? d.valence : 0;
          const muA = typeof d.arousal === 'number' ? d.arousal : 0;
          const variance = typeof d.confidence_variance === 'number' && d.confidence_variance > 0
            ? d.confidence_variance
            : (annotation.confidence?.confidence?.[idx] ?? 0.035);
          const sigma = Math.sqrt(variance);
          return { muV, muA, variance, sigma };
        });

        // 2D Gaussian Density Grid over [-1.1, 1.1] with explicit bounding cells
        const step = 0.05;
        let maxDensity = 0;
        const rawGrid: Array<{ x1: number; x2: number; y1: number; y2: number; d: number }> = [];

        for (let v = -1.1; v <= 1.1; v += step) {
          for (let a = -1.1; a <= 1.1; a += step) {
            let sumD = 0;
            for (const pt of points) {
              const dv = v - pt.muV;
              const da = a - pt.muA;
              const g = Math.exp(-(dv * dv + da * da) / (2 * pt.variance));
              sumD += g;
            }
            if (sumD > maxDensity) maxDensity = sumD;
            rawGrid.push({
              x1: Math.round((v - step / 2) * 1000) / 1000,
              x2: Math.round((v + step / 2) * 1000) / 1000,
              y1: Math.round((a - step / 2) * 1000) / 1000,
              y2: Math.round((a + step / 2) * 1000) / 1000,
              d: sumD,
            });
          }
        }

        const densityGrid = maxDensity > 0
          ? rawGrid
              .map(cell => ({ x1: cell.x1, x2: cell.x2, y1: cell.y1, y2: cell.y2, density: cell.d / maxDensity }))
              .filter(cell => cell.density >= 0.02)
          : [];

        // Generate 1σ and 2σ contour lines around each center
        const contourPoints: Array<{ x: number; y: number; contour: string; order: number }> = [];
        points.forEach((pt, pIdx) => {
          const nSteps = 48;
          // First circle: 1σ contour
          for (let s = 0; s <= nSteps; s++) {
            const angle = (s / nSteps) * 2 * Math.PI;
            contourPoints.push({
              x: pt.muV + pt.sigma * Math.cos(angle),
              y: pt.muA + pt.sigma * Math.sin(angle),
              contour: '1σ (68% Conf)',
              order: pIdx * 200 + s,
            });
          }
          // Second circle: 2σ contour
          for (let s = 0; s <= nSteps; s++) {
            const angle = (s / nSteps) * 2 * Math.PI;
            contourPoints.push({
              x: pt.muV + 1.96 * pt.sigma * Math.cos(angle),
              y: pt.muA + 1.96 * pt.sigma * Math.sin(angle),
              contour: '2σ (95% Conf)',
              order: pIdx * 200 + 100 + s,
            });
          }
        });

        return {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          width: circumplexSize,
          height: circumplexSize,
          title: {
            text: `Global Mood Density (Russell Circumplex): ${annotation.media_id}`,
            subtitle: 'Bivariate Gaussian affect distribution from variance confidence ratings',
            color: textColor,
            subtitleColor: axisColor,
          },
          config: baseConfig,
          layer: [
            ...quadrantAxes,
            // 2D Gaussian Density Heatmap Cells with bounded tile coordinates
            {
              data: { values: densityGrid },
              mark: { type: 'rect', opacity: 0.85 },
              encoding: {
                x: {
                  field: 'x1',
                  type: 'quantitative',
                  title: 'Valence (Pleasure)',
                  scale: { domain: [-1.1, 1.1] },
                  axis: { titleColor: textColor, labelColor: axisColor, grid: true, tickCount: 5 },
                },
                x2: { field: 'x2' },
                y: {
                  field: 'y1',
                  type: 'quantitative',
                  title: 'Arousal (Energy)',
                  scale: { domain: [-1.1, 1.1] },
                  axis: { titleColor: textColor, labelColor: axisColor, grid: true, tickCount: 5 },
                },
                y2: { field: 'y2' },
                color: {
                  field: 'density',
                  type: 'quantitative',
                  scale: { scheme: 'viridis' },
                  title: 'Density',
                },
                tooltip: [
                  { field: 'density', type: 'quantitative', format: '.2%', title: 'Gaussian Density' },
                ],
              },
            },
            // Uncertainty Boundary Contours (1σ and 2σ)
            {
              data: { values: contourPoints },
              mark: { type: 'line', strokeDash: [4, 3], strokeWidth: 1.75 },
              encoding: {
                x: { field: 'x', type: 'quantitative' },
                y: { field: 'y', type: 'quantitative' },
                detail: { field: 'contour', type: 'nominal' },
                order: { field: 'order', type: 'quantitative' },
                color: {
                  field: 'contour',
                  type: 'nominal',
                  scale: { domain: ['1σ (68% Conf)', '2σ (95% Conf)'], range: ['#38bdf8', '#818cf8'] },
                  title: 'Uncertainty Bounds',
                },
              },
            },
            // Center Mean Marker Points
            {
              data: { values: data },
              mark: {
                type: 'circle',
                size: 160,
                fill: '#ef4444',
                stroke: '#ffffff',
                strokeWidth: 2,
              },
              encoding: {
                x: { field: 'valence', type: 'quantitative' },
                y: { field: 'arousal', type: 'quantitative' },
                tooltip: [
                  { field: 'valence', type: 'quantitative', format: '.3f', title: 'Mean Valence' },
                  { field: 'arousal', type: 'quantitative', format: '.3f', title: 'Mean Arousal' },
                  { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
                  { field: 'confidence_std', type: 'quantitative', format: '.3f', title: 'Std Dev (σ)' },
                ],
              },
            },
            // Text Annotation for Mean Point
            {
              data: { values: data },
              transform: [
                {
                  calculate: "'Mean (' + format(datum.valence, '.2f') + ', ' + format(datum.arousal, '.2f') + ')'",
                  as: 'mean_label',
                },
              ],
              mark: {
                type: 'text',
                align: 'left',
                baseline: 'bottom',
                dx: 10,
                dy: -8,
                fontSize: 11,
                fontWeight: 'bold',
                fill: textColor,
              },
              encoding: {
                x: { field: 'valence', type: 'quantitative' },
                y: { field: 'arousal', type: 'quantitative' },
                text: { field: 'mean_label', type: 'nominal' },
              },
            },
          ],
        };
      }

      // Discrete Scatter Plot without Connecting Line (Matching trajectory right-hand subplot without connecting line)
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: circumplexSize,
        height: circumplexSize,
        title: {
          text: `Static Global Mood (Russell Circumplex): ${annotation.media_id}`,
          subtitle: 'Static Valence-Arousal coordinates without connecting time lines',
          color: textColor,
          subtitleColor: axisColor,
        },
        data: { values: data },
        transform: transforms,
        config: baseConfig,
        layer: [
          ...quadrantAxes,
          // Prominent Scatter Points (No connecting line!)
          {
            mark: {
              type: 'circle',
              size: 140,
              stroke: '#ffffff',
              strokeWidth: 1.5,
              opacity: 0.9,
            },
            encoding: {
              x: {
                field: 'valence',
                type: 'quantitative',
                title: 'Valence (Pleasure)',
                scale: { domain: [-1.1, 1.1] },
                axis: { titleColor: textColor, labelColor: axisColor, grid: true, tickCount: 5 },
              },
              y: {
                field: 'arousal',
                type: 'quantitative',
                title: 'Arousal (Energy)',
                scale: { domain: [-1.1, 1.1] },
                axis: { titleColor: textColor, labelColor: axisColor, grid: true, tickCount: 5 },
              },
              color: hasConfidence
                ? { field: 'confidence', type: 'quantitative', scale: { scheme: 'viridis' }, title: 'Confidence' }
                : { value: '#6366f1' },
              tooltip: [
                { field: 'valence', type: 'quantitative', format: '.3f', title: 'Valence' },
                { field: 'arousal', type: 'quantitative', format: '.3f', title: 'Arousal' },
                ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.2%', title: 'Confidence' }] : []),
              ],
            },
          },
          // Coordinate labels beside points
          {
            transform: [
              {
                calculate: "'(' + format(datum.valence, '.2f') + ', ' + format(datum.arousal, '.2f') + ')'",
                as: 'point_coord_label',
              },
            ],
            mark: {
              type: 'text',
              align: 'left',
              baseline: 'bottom',
              dx: 8,
              dy: -6,
              fontSize: 10,
              fontWeight: 'bold',
              fill: textColor,
            },
            encoding: {
              x: { field: 'valence', type: 'quantitative' },
              y: { field: 'arousal', type: 'quantitative' },
              text: { field: 'point_coord_label', type: 'nominal' },
            },
          },
        ],
      };
    }

    // Case B: Dynamic mood with time progression
    const xTimeField = 'time';
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      title: { text: `BOPP Mood Thayer (Circumplex Model): ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      hconcat: [
        // Time series track: Valence and Arousal lines over time with optional variance confidence ribbons
        {
          width: 440,
          height: chartHeight,
          title: { text: 'Valence & Arousal Timeline', color: textColor },
          layer: [
            // If variance confidence is present, add shaded 95% Confidence Interval error bands (±1.96σ)
            ...(hasConfidence && confidenceType === 'variance' && confidenceChannel !== 'none'
              ? [
                  // Valence error band (ribbon)
                  {
                    transform: [{ filter: 'datum.valence_ci_lower != null && datum.valence_ci_upper != null' }],
                    mark: { type: 'area', opacity: 0.22, color: '#06b6d4' },
                    encoding: {
                      x: { field: xTimeField, type: 'quantitative' },
                      y: { field: 'valence_ci_lower', type: 'quantitative' },
                      y2: { field: 'valence_ci_upper' },
                    },
                  },
                  // Arousal error band (ribbon)
                  {
                    transform: [{ filter: 'datum.arousal_ci_lower != null && datum.arousal_ci_upper != null' }],
                    mark: { type: 'area', opacity: 0.22, color: '#f59e0b' },
                    encoding: {
                      x: { field: xTimeField, type: 'quantitative' },
                      y: { field: 'arousal_ci_lower', type: 'quantitative' },
                      y2: { field: 'arousal_ci_upper' },
                    },
                  },
                ]
              : []),
            {
              transform: [
                {
                  fold: ['valence', 'arousal'],
                  as: ['dimension', 'score'],
                },
              ],
              mark: { type: 'line', point: true, strokeWidth: 2.5, interpolate: 'monotone' },
              encoding: {
                x: { field: xTimeField, type: 'quantitative', title: 'Time (seconds)' },
                y: { field: 'score', type: 'quantitative', title: 'Dimension Value', scale: { domain: [-1, 1] } },
                color: {
                  field: 'dimension',
                  type: 'nominal',
                  scale: { domain: ['valence', 'arousal'], range: ['#06b6d4', '#f59e0b'] },
                  title: 'Dimension',
                },
                tooltip: [
                  { field: 'time', type: 'quantitative', format: '.2f', title: 'Time (s)' },
                  { field: 'dimension', type: 'nominal', title: 'Dimension' },
                  { field: 'score', type: 'quantitative', format: '.3f', title: 'Score' },
                  ...(hasConfidence ? [
                    { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
                    { field: 'confidence_std', type: 'quantitative', format: '.3f', title: 'Std Dev (σ)' },
                  ] : []),
                ],
              },
            },
            ...(currentTime !== null && currentTime !== undefined
              ? [
                  {
                    data: { values: [{ time: currentTime }] },
                    mark: { type: 'rule', color: cursorColor, size: 2, strokeDash: [4, 2] },
                    encoding: { x: { field: 'time', type: 'quantitative' } },
                  },
                ]
              : []),
          ],
        },
        // 2D Circumplex Scatter Plot with crosshair error bars
        {
          width: 320,
          height: chartHeight,
          title: { text: 'Russell Circumplex 2D Space', color: textColor },
          layer: [
            // Quadrant axes lines
            {
              data: { values: [{ x: 0 }] },
              mark: { type: 'rule', stroke: gridColor, strokeWidth: 1.5 },
              encoding: { x: { field: 'x', type: 'quantitative', scale: { domain: [-1.1, 1.1] } } },
            },
            {
              data: { values: [{ y: 0 }] },
              mark: { type: 'rule', stroke: gridColor, strokeWidth: 1.5 },
              encoding: { y: { field: 'y', type: 'quantitative', scale: { domain: [-1.1, 1.1] } } },
            },
            // Quadrant text labels
            {
              data: {
                values: [
                  { x: 0.7, y: 0.8, label: 'Happy / Excited' },
                  { x: -0.7, y: 0.8, label: 'Angry / Tense' },
                  { x: -0.7, y: -0.8, label: 'Sad / Depressed' },
                  { x: 0.7, y: -0.8, label: 'Calm / Relaxed' },
                ],
              },
              mark: { type: 'text', fontSize: 10, fill: axisColor, fontWeight: 'bold' },
              encoding: {
                x: { field: 'x', type: 'quantitative' },
                y: { field: 'y', type: 'quantitative' },
                text: { field: 'label', type: 'nominal' },
              },
            },
            // Path trajectory
            {
              mark: { type: 'line', color: '#6366f1', opacity: 0.5, strokeWidth: 1.75 },
              encoding: {
                x: { field: 'valence', type: 'quantitative' },
                y: { field: 'arousal', type: 'quantitative' },
                order: { field: '__index' },
              },
            },
            // Crosshair error bars when variance confidence is present
            ...(hasConfidence && confidenceType === 'variance' && confidenceChannel !== 'none'
              ? [
                  // Horizontal Valence error bar: [valence_ci_lower, valence_ci_upper] at y = arousal
                  {
                    transform: [{ filter: 'datum.valence_ci_lower != null && datum.valence_ci_upper != null' }],
                    mark: { type: 'rule', stroke: '#06b6d4', strokeWidth: 1.5, opacity: 0.65 },
                    encoding: {
                      x: { field: 'valence_ci_lower', type: 'quantitative', scale: { domain: [-1.1, 1.1] } },
                      x2: { field: 'valence_ci_upper' },
                      y: { field: 'arousal', type: 'quantitative', scale: { domain: [-1.1, 1.1] } },
                    },
                  },
                  // Vertical Arousal error bar: [arousal_ci_lower, arousal_ci_upper] at x = valence
                  {
                    transform: [{ filter: 'datum.arousal_ci_lower != null && datum.arousal_ci_upper != null' }],
                    mark: { type: 'rule', stroke: '#f59e0b', strokeWidth: 1.5, opacity: 0.65 },
                    encoding: {
                      x: { field: 'valence', type: 'quantitative', scale: { domain: [-1.1, 1.1] } },
                      y: { field: 'arousal_ci_lower', type: 'quantitative', scale: { domain: [-1.1, 1.1] } },
                      y2: { field: 'arousal_ci_upper' },
                    },
                  },
                ]
              : []),
            // Points colored by time progression
            {
              mark: { type: 'circle', size: 90, stroke: isDark ? '#ffffff' : '#0f172a', strokeWidth: 1 },
              encoding: {
                x: { field: 'valence', type: 'quantitative', title: 'Valence (Pleasure)', scale: { domain: [-1.1, 1.1] } },
                y: { field: 'arousal', type: 'quantitative', title: 'Arousal (Energy)', scale: { domain: [-1.1, 1.1] } },
                color: {
                  field: 'time',
                  type: 'quantitative',
                  title: 'Time (s)',
                  scale: { scheme: 'viridis' },
                },
                tooltip: [
                  { field: 'time', type: 'quantitative', format: '.2f', title: 'Time (s)' },
                  { field: 'valence', type: 'quantitative', format: '.3f', title: 'Valence' },
                  { field: 'arousal', type: 'quantitative', format: '.3f', title: 'Arousal' },
                  ...(hasConfidence ? [
                    { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
                    { field: 'confidence_std', type: 'quantitative', format: '.3f', title: 'Std Dev (σ)' },
                  ] : []),
                ],
              },
            },
          ],
        },
      ],
    };
  }

  // =========================================================================
  // 9. SCORE_INTERVAL / SCORE_QUARTER (Fractional notation)
  // =========================================================================
  if (extentType === 'score_interval' || extentType === 'score_quarter') {
    const isInterval = extentType === 'score_interval';
    const intervalAnalysis = isInterval ? analyzeIntervalAnnotation(annotation, data) : null;
    const useSingleRow = Boolean(!forceMultiRow && isInterval && intervalAnalysis?.shouldUseSingleRow);

    const markType = isInterval ? 'rect' : 'tick';
    const colorScale = resolveColorScale(colorScheme, payloadType);

    if (isInterval) {
      transforms.push({
        calculate: 'datum.quarter + (datum.duration != null ? datum.duration : 0)',
        as: '_calc_end',
      });
      if (useSingleRow && intervalAnalysis) {
        transforms.push({
          calculate: `'${intervalAnalysis.singleRowLabel}'`,
          as: '_single_row',
        });
      }
    }

    const yEncoding = useSingleRow && intervalAnalysis
      ? {
          field: '_single_row',
          type: 'nominal',
          title: intervalAnalysis.singleRowLabel,
          axis: {
            titlePadding: 14,
            labelPadding: 8,
            labelFontWeight: 'bold',
            minExtent: 70,
          },
        }
      : {
          field: 'value',
          type: 'nominal',
          title: 'Payload',
          axis: {
            titlePadding: 14,
            labelPadding: 8,
            labelFontWeight: 'bold',
            minExtent: 70,
          },
        };

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: markType,
          cornerRadius: 2,
          stroke: isDark ? '#1e293b' : '#334155',
          strokeWidth: 1,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: 'quarter',
            type: 'quantitative',
            title: 'Musical Time (Fractional Quarter Notes)',
            scale: { domain: [minX, maxX] },
          },
          ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
          y: yEncoding,
          color: { field: 'value', type: 'nominal', scale: colorScale },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Value' },
            { field: 'quarter_str', type: 'nominal', title: 'Quarter Fraction' },
            ...(isInterval ? [{ field: 'duration', type: 'quantitative', title: 'Duration' }] : []),
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    if (isInterval && useSingleRow && showLabels) {
      transforms.push({
        calculate: '(datum.quarter + (datum.quarter + (datum.duration != null ? datum.duration : 0))) / 2',
        as: '_label_midpoint',
      });
      layers.push({
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: textFill,
          fontWeight: 'bold',
          fontSize: 10,
          limit: 120,
        },
        encoding: {
          x: { field: '_label_midpoint', type: 'quantitative' },
          y: yEncoding,
          text: { field: 'value', type: 'nominal' },
        },
      });
    }

    const scoreTitle = { text: `BOPP Score Notation Time: ${annotation.media_id}`, color: textColor };
    const scoreOverviewLayers = [
      {
        mark: { type: isInterval ? 'rect' : 'tick', opacity: 0.7, cornerRadius: 2 },
        encoding: {
          x: { field: 'quarter', type: 'quantitative' },
          ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
          y: { value: 2 },
          y2: { value: 50 },
          color: { field: 'value', type: 'nominal', legend: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers: scoreOverviewLayers,
      xField: 'quarter',
      xTitle: 'Musical Time (Fractional Quarter Notes)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: scoreTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 10. TEMPO (BPM over time)
  // =========================================================================
  if (payloadType === 'tempo') {
    const xTime = extentType?.includes('time') ? 'time' : '__index';
    const isInterval = extentType?.includes('interval');
    const layers: Record<string, unknown>[] = [];

    if (isInterval) {
      transforms.push({
        calculate: `datum.${xTime} + (datum.duration != null ? datum.duration : 0)`,
        as: '_calc_end',
      });

      // Horizontal Rubato Tempo Shelves (clean shelf line for each section)
      layers.push({
        mark: {
          type: 'rule',
          strokeWidth: 4,
          stroke: '#f59e0b',
          strokeCap: 'round',
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: xTime, type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
          x2: { field: '_calc_end' },
          y: { field: 'value', type: 'quantitative', title: 'Tempo (BPM)', scale: { zero: false } },
          tooltip: [
            { field: 'value', type: 'quantitative', format: '.1f', title: 'Rubato Tempo (BPM)' },
            { field: xTime, type: 'quantitative', format: '.2f', title: 'Start (s)' },
            { field: 'duration', type: 'quantitative', format: '.2f', title: 'Duration (s)' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
          ],
        },
      });

      // Step transition guide connecting tempo changes
      layers.push({
        mark: {
          type: 'line',
          interpolate: 'step-after',
          strokeWidth: 1.5,
          strokeDash: [4, 4],
          stroke: isDark ? '#94a3b8' : '#64748b',
        },
        encoding: {
          x: { field: xTime, type: 'quantitative', scale: { domain: [minX, maxX] } },
          y: { field: 'value', type: 'quantitative', scale: { zero: false } },
        },
      });

      // Section start circle and BPM label
      layers.push(
        {
          mark: { type: 'circle', size: 65, color: '#f59e0b' },
          encoding: {
            x: { field: xTime, type: 'quantitative' },
            y: { field: 'value', type: 'quantitative', scale: { zero: false } },
          },
        },
        {
          transform: [
            { calculate: "datum.value + ' BPM'", as: '_bpm_label' },
          ],
          mark: {
            type: 'text',
            dy: -12,
            fontSize: 10.5,
            fontWeight: 'bold',
            fill: textFill,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          encoding: {
            x: { field: xTime, type: 'quantitative' },
            y: { field: 'value', type: 'quantitative', scale: { zero: false } },
            text: { field: '_bpm_label', type: 'nominal' },
          },
        }
      );

      // Top-edge confidence meter for each rubato interval
      if (hasConfidence && confidenceChannel !== 'none') {
        layers.push(...buildIntervalConfidenceLayers({
          xField: xTime,
          endField: '_calc_end',
          durField: 'duration',
          chartHeight,
          isDark,
          confidenceType: confidenceType as any,
          channelMode: confidenceChannel,
          yTop: 10,
          yBottom: chartHeight - 60,
          meterHeight: 12,
        }));
      }
    } else {
      // Step line tempo trajectory
      // If variance is present, add shaded 95% CI error band
      if (hasConfidence && confidenceType === 'variance' && confidenceChannel !== 'none') {
        layers.push({
          transform: [{ filter: 'datum.value_ci_lower != null && datum.value_ci_upper != null' }],
          mark: { type: 'area', opacity: 0.25, color: '#f59e0b' },
          encoding: {
            x: { field: xTime, type: 'quantitative', scale: { domain: [minX, maxX] } },
            y: { field: 'value_ci_lower', type: 'quantitative', scale: { zero: false } },
            y2: { field: 'value_ci_upper' },
          },
        });
        layers.push(...buildVarianceErrorBarLayers({ xField: xTime, yField: 'value', isDark }));
      }

      layers.push(
        {
          mark: { type: 'line', interpolate: 'step-after', strokeWidth: 2.5, color: '#f59e0b' },
          ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
          encoding: {
            x: { field: xTime, type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
            y: { field: 'value', type: 'quantitative', title: 'Tempo (BPM)', scale: { zero: false } },
            tooltip: [
              { field: xTime, type: 'quantitative', format: '.2f', title: 'Time (s)' },
              { field: 'value', type: 'quantitative', format: '.1f', title: 'Tempo (BPM)' },
              ...(hasConfidence ? [
                { field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' },
                { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
              ] : []),
            ],
          },
        },
        {
          mark: { type: 'circle', size: 60, color: '#f59e0b' },
          encoding: {
            x: { field: xTime, type: 'quantitative' },
            y: { field: 'value', type: 'quantitative' },
          },
        }
      );
    }

    const tempoTitle = { text: `BOPP Tempo (BPM): ${annotation.media_id}`, color: textColor };
    const tempoOverviewLayers = [
      {
        mark: { type: 'line', interpolate: 'step-after', stroke: '#f59e0b', strokeWidth: 1.8, opacity: 0.8 },
        encoding: {
          x: { field: xTime, type: 'quantitative' },
          y: { field: 'value', type: 'quantitative', scale: { zero: false }, axis: null },
        },
      },
    ];

    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers: tempoOverviewLayers,
      xField: xTime,
      xTitle: 'Time (seconds)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: tempoTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  // =========================================================================
  // 11. GENERAL FALLBACK COMPOSITION (Supports any extent + payload)
  // =========================================================================
  const isMidi = extentType?.includes('midi') || extentType?.includes('tick') || (data.length > 0 && typeof data[0].tick === 'number');
  const isScore = extentType?.includes('score') || extentType?.includes('quarter') || (data.length > 0 && typeof data[0].quarter === 'number');
  const isTime = extentType?.includes('time') || (data.length > 0 && typeof data[0].time === 'number');

  const xField = isTime
    ? 'time'
    : isMidi
    ? 'tick'
    : isScore
    ? 'quarter'
    : '__index';

  const isInterval = isIntervalExtentType(extentType) || data.some(d => typeof d.duration === 'number');
  const intervalAnalysis = isInterval ? analyzeIntervalAnnotation(annotation, data) : null;
  const useSingleRow = Boolean(!forceMultiRow && isInterval && intervalAnalysis?.shouldUseSingleRow);

  if (isInterval) {
    transforms.push({
      calculate: `datum.${xField} + (datum.duration != null ? datum.duration : 0)`,
      as: '_calc_end',
    });
    if (useSingleRow && intervalAnalysis) {
      transforms.push({
        calculate: `'${intervalAnalysis.singleRowLabel}'`,
        as: '_single_row',
      });
    }
  }
  const colorScale = resolveColorScale(colorScheme, payloadType);

  const yEncoding = useSingleRow && intervalAnalysis
    ? {
        field: '_single_row',
        type: 'nominal',
        title: intervalAnalysis.singleRowLabel,
        axis: {
          titlePadding: 14,
          labelPadding: 8,
          labelFontWeight: 'bold',
          minExtent: 70,
        },
      }
    : {
        field: 'value',
        type: 'nominal',
        title: payloadType,
        axis: {
          titlePadding: 14,
          labelPadding: 8,
          labelFontWeight: 'bold',
          minExtent: 70,
        },
      };

  const layers: Record<string, unknown>[] = [
    {
      mark: isInterval ? { type: 'bar', cornerRadius: 2 } : { type: 'tick', thickness: 3 },
      ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
      encoding: {
        x: { field: xField, type: 'quantitative', title: xField, scale: { domain: [minX, maxX] } },
        ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
        y: yEncoding,
        color: { field: 'value', type: 'nominal', scale: colorScale, title: payloadType },
        opacity: hasConfidence && confidenceChannel === 'opacity'
          ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.75, 1.0] } }
          : { value: 1.0 },
        tooltip: [
          { field: 'value', type: 'nominal', title: 'Value' },
          { field: xField, type: 'quantitative', format: '.3f', title: 'Position' },
          ...(isInterval ? [{ field: 'duration', type: 'quantitative', format: '.3f', title: 'Duration' }] : []),
          ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', title: 'Confidence' }] : []),
        ],
      },
    },
  ];

  if (isInterval && useSingleRow && showLabels) {
    transforms.push({
      calculate: `(datum.${xField} + (datum.${xField} + (datum.duration != null ? datum.duration : 0))) / 2`,
      as: '_label_midpoint',
    });
    layers.push({
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'middle',
        fill: textFill,
        fontWeight: 'bold',
        fontSize: 10,
        limit: 120,
      },
      encoding: {
        x: { field: '_label_midpoint', type: 'quantitative' },
        y: yEncoding,
        text: { field: 'value', type: 'nominal' },
      },
    });
  }

  // Active playhead indicator if playing
  if (typeof currentTime === 'number' && currentTime >= 0) {
    layers.push({
      mark: { type: 'rule', stroke: cursorColor, strokeWidth: 2 },
      encoding: { x: { datum: currentTime } },
    });
  }

  const fallbackTitle = { text: `BOPP Visualization: ${annotation.media_id} (${payloadType})`, color: textColor };
  const fallbackOverviewLayers = [
    isInterval
      ? {
          mark: { type: 'rect', opacity: 0.65, cornerRadius: 2 },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            x2: { field: '_calc_end' },
            y: { value: 2 },
            y2: { value: 50 },
            color: { field: 'value', type: 'nominal', legend: null },
          },
        }
      : {
          mark: { type: 'rule', size: 1.5, stroke: '#38bdf8', opacity: 0.75 },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            y: { value: 4 },
            y2: { value: 50 },
          },
        },
  ];

  if (isTime || isMidi || isScore) {
    return composeTimelineSpecWithOverview({
      data,
      transforms,
      detailLayers: layers,
      overviewLayers: fallbackOverviewLayers,
      xField,
      xTitle: isTime ? 'Time (seconds)' : isMidi ? 'MIDI Tick' : 'Musical Time (Quarter Notes)',
      minXVal: minX,
      maxXVal: maxX,
      plotTitle: fallbackTitle,
      detailPlotHeight: chartHeight - 74,
    });
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: chartWidth,
    height: chartHeight,
    title: fallbackTitle,
    data: { values: data },
    transform: transforms,
    config: baseConfig,
    layer: layers,
  };
}
