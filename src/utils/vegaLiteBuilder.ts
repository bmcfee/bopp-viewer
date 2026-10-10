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
  getKeyTonicRank,
  normalizeKeyName,
  parseKeyMode,
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
    chartWidth = 'container',
    chartHeight = 320,
  } = options;

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
      minX = Math.min(...startTimes);
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
          return {
            index: idx,
            rawKey,
            parsed: p,
            root: p?.root ?? 'C',
            semitone: p?.semitone ?? 0,
            isMinor: p?.isMinor ?? false,
            confidence: conf,
            label: p ? `${p.root} ${p.isMinor ? 'Minor' : 'Major'}` : rawKey,
            fullKey: p ? `${p.root}:${p.isMinor ? 'min' : 'maj'}` : rawKey,
            color: p ? keyToMirEvalColor(rawKey, mode) : MIR_EVAL_COLORMAPS.neutral_gray,
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
              confidence: null as number | null,
              label: 'C Major',
              fullKey: 'C:maj',
              color: keyToMirEvalColor('C:maj', mode),
            },
          ];

      // Sort candidates by confidence descending
      const sortedCandidates = [...candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      const primaryCandidate = sortedCandidates[0];
      const hasMultipleCandidates = candidates.length > 1;

      // Concentric Donut Plots: Outer Donut = 12 Major Keys, Inner Donut = 12 Minor Keys
      // Both arranged clockwise in Circle of Fifths order starting from C at 12 o'clock

      // 1. Outer Ring: Major Keys
      const outerRingValues = FIFTHS_ORDER_12_ROOTS.map((k, i) => {
        const kSem = CHROMATIC_ROOT_MAP[k] ?? 0;
        const matchingCand = sortedCandidates.find(c => c.semitone === kSem && !c.isMinor);
        const isActive = Boolean(matchingCand);
        const candConf = matchingCand?.confidence ?? null;

        const sliceColor = mode === 'pitch'
          ? MIR_EVAL_COLORMAPS.pitch[kSem]
          : MIR_EVAL_COLORMAPS.fifths[kSem];

        const confPct = candConf !== null ? `${Math.round(candConf * 100)}%` : '';
        const badgeText = isActive && candConf !== null ? confPct : '';

        return {
          key: k,
          displayKey: k,
          ring: 'Outer (Major)',
          fifths: i,
          count: 1,
          color: sliceColor,
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
          fullKey: `${k}:maj`,
          label: `${k} Major`,
          modeName: 'Major',
          confidence: candConf,
          confPct,
          badge: badgeText,
          badgeOpacity: isActive && candConf !== null ? 1.0 : 0.0,
          status: isActive
            ? (candConf !== null ? `Major Candidate (${confPct})` : 'Detected Major Key')
            : 'Major Sector',
        };
      });

      // 2. Inner Ring: Minor Keys
      const innerRingValues = FIFTHS_ORDER_12_ROOTS.map((k, i) => {
        const kSem = CHROMATIC_ROOT_MAP[k] ?? 0;
        const matchingCand = sortedCandidates.find(c => c.semitone === kSem && c.isMinor);
        const isActive = Boolean(matchingCand);
        const candConf = matchingCand?.confidence ?? null;

        const sliceColor = mode === 'pitch'
          ? MIR_EVAL_COLORMAPS.pitch_dark[kSem]
          : MIR_EVAL_COLORMAPS.fifths_dark[kSem];

        const confPct = candConf !== null ? `${Math.round(candConf * 100)}%` : '';
        const badgeText = isActive && candConf !== null ? confPct : '';

        return {
          key: k,
          displayKey: k.toLowerCase(), // Standard lowercase notation for minor
          ring: 'Inner (Minor)',
          fifths: i,
          count: 1,
          color: sliceColor,
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
          fullKey: `${k}:min`,
          label: `${k} Minor`,
          modeName: 'Minor',
          confidence: candConf,
          confPct,
          badge: badgeText,
          badgeOpacity: isActive && candConf !== null ? 1.0 : 0.0,
          status: isActive
            ? (candConf !== null ? `Minor Candidate (${confPct})` : 'Detected Minor Key')
            : 'Minor Sector',
        };
      });

      const wheelSize = typeof chartWidth === 'number' ? Math.min(460, Math.max(340, chartWidth - 60)) : 380;

      const centerData = [
        {
          title: primaryCandidate.label,
          subtitle: hasMultipleCandidates
            ? `${primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 100)}%` : ''} (Primary)`
            : (primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 1000) / 10}% confidence` : 'Harmonic tonal center'),
          detail: hasMultipleCandidates
            ? sortedCandidates.slice(1).map(c => `${c.label} (${c.confidence !== null ? `${Math.round(c.confidence * 100)}%` : ''})`).join(' · ')
            : '',
          legendInfo: 'Outer: Major · Inner: Minor',
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
          subtitle: `Outer Donut: Major Keys · Inner Donut: Minor Keys · C at 12 o'clock · ${annotation.media_id}`,
          color: textColor,
          subtitleColor: axisColor,
        },
        config: baseConfig,
        layer: [
          // 1. OUTER DONUT: Major Key Arc Ring (Radius 104 - 148)
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
              color: { field: 'color', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              stroke: { field: 'stroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'strokeWidth', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 104, outerRadius: 148 },
          },
          // 2. OUTER DONUT: Active Candidate Accent Highlight Ring
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
              color: { field: 'color', type: 'nominal', scale: null },
              opacity: { field: 'activeOpacity', type: 'quantitative', scale: null },
              stroke: { field: 'activeStroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'activeStrokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 100, outerRadius: 152 },
          },
          // 3. OUTER DONUT: Major Tonic Label Centered in Sector
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
              text: { field: 'displayKey', type: 'nominal' },
              color: { field: 'textColor', type: 'nominal', scale: null },
            },
            mark: {
              type: 'text',
              radius: 126,
              fontSize: 12,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
          },
          // 4. OUTER DONUT: Confidence Badges on Active Slices
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
              radius: 140,
              fontSize: 10,
              fontWeight: 'bold',
              fill: isDark ? '#ffffff' : '#0f172a',
            },
          },

          // 5. INNER DONUT: Minor Key Arc Ring (Radius 58 - 98)
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
              color: { field: 'color', type: 'nominal', scale: null },
              opacity: { field: 'opacity', type: 'quantitative', scale: null },
              stroke: { field: 'stroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'strokeWidth', type: 'quantitative', scale: null },
              tooltip: [
                { field: 'ring', type: 'nominal', title: 'Ring' },
                { field: 'key', type: 'nominal', title: 'Tonic Root' },
                { field: 'modeName', type: 'nominal', title: 'Mode' },
                { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
                { field: 'status', type: 'nominal', title: 'Status' },
              ],
            },
            mark: { type: 'arc', innerRadius: 58, outerRadius: 98 },
          },
          // 6. INNER DONUT: Active Candidate Accent Highlight Ring
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
              color: { field: 'color', type: 'nominal', scale: null },
              opacity: { field: 'activeOpacity', type: 'quantitative', scale: null },
              stroke: { field: 'activeStroke', type: 'nominal', scale: null },
              strokeWidth: { field: 'activeStrokeWidth', type: 'quantitative', scale: null },
            },
            mark: { type: 'arc', innerRadius: 55, outerRadius: 101 },
          },
          // 7. INNER DONUT: Minor Tonic Label Centered in Sector (e.g. c, g, d, a...)
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
              text: { field: 'displayKey', type: 'nominal' },
              color: { field: 'textColor', type: 'nominal', scale: null },
            },
            mark: {
              type: 'text',
              radius: 78,
              fontSize: 11,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
          },
          // 8. INNER DONUT: Confidence Badges on Active Minor Slices
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
              radius: 165,
              fontSize: 12,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
          },

          // 10. Center Key Primary Title
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: hasMultipleCandidates ? -14 : -8,
              fontSize: 17,
              fontWeight: 'bold',
              font: 'system-ui, -apple-system, sans-serif',
            },
            encoding: {
              text: { field: 'title', type: 'nominal' },
              color: { field: 'color', type: 'nominal', scale: null },
            },
          },
          // 11. Center Subtitle
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: hasMultipleCandidates ? 4 : 12,
              fontSize: 11,
              fill: axisColor,
            },
            encoding: {
              text: { field: 'subtitle', type: 'nominal' },
            },
          },
          // 12. Center Legend / Detail
          {
            data: { values: centerData },
            mark: {
              type: 'text',
              align: 'center',
              baseline: 'middle',
              dy: hasMultipleCandidates ? 19 : 24,
              fontSize: 9,
              fontWeight: 'bold',
              fill: axisColor,
            },
            encoding: {
              text: { field: hasMultipleCandidates ? 'detail' : 'legendInfo', type: 'nominal' },
            },
          },
        ],
      };

      // If multiple candidates are present, append a Candidate Likelihood bar chart breakdown
      if (hasMultipleCandidates) {
        const candidateBarData = sortedCandidates.map(c => ({
          key: c.label,
          confidence: c.confidence ?? 0,
          confPct: c.confidence !== null ? `${Math.round(c.confidence * 100)}%` : '',
          color: c.color,
        }));

        const barChartSpec = {
          width: wheelSize,
          height: Math.max(90, sortedCandidates.length * 28 + 40),
          title: {
            text: 'Key Likelihood Distribution',
            fontSize: 12,
            color: textColor,
          },
          data: { values: candidateBarData },
          encoding: {
            y: {
              field: 'key',
              type: 'nominal',
              sort: candidateBarData.map(d => d.key),
              title: null,
              axis: { labelColor: textColor, labelFontWeight: 'bold' },
            },
            x: {
              field: 'confidence',
              type: 'quantitative',
              title: 'Likelihood',
              scale: { domain: [0, 1] },
              axis: { format: '%', titleColor: textColor, labelColor: axisColor },
            },
          },
          layer: [
            {
              mark: { type: 'bar', cornerRadius: 4, height: 16 },
              encoding: {
                color: { field: 'color', type: 'nominal', scale: null },
              },
            },
            {
              mark: { type: 'text', align: 'left', dx: 6, fontSize: 11, fontWeight: 'bold' },
              encoding: {
                text: { field: 'confPct', type: 'nominal' },
                color: { value: textColor },
              },
            },
          ],
        };

        return {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          config: baseConfig,
          vconcat: [radialChartSpec, barChartSpec],
        };
      }

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
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

    const layers: Record<string, unknown>[] = [];
    const uniqueChords = Array.from(new Set(data.map(d => String(d.value ?? '')))).filter(Boolean);
    const chordColorScale = resolveColorScale(colorScheme, 'chord', uniqueChords);

    const isMirEvalFifths = colorScheme === 'mir_eval_fifths' || colorScheme === 'fifths';
    const isMirEvalPitch = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    const colorLegendTitle = isMirEvalFifths
      ? 'Chord (mir_eval Circle of Fifths)'
      : isMirEvalPitch
      ? 'Chord (mir_eval Chromatic Pitch)'
      : 'Chord (Harte)';

    const isInstantaneous = !isScore && !isMidi && extentType === 'time' && data.every(d => d.duration === undefined || d.duration === null || d.duration === 0);

    const mainPlotHeight = (enableOverviewBrush && data.length > 20) ? chartHeight - 80 : chartHeight - 40;

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
        field: 'value',
        type: 'nominal',
        title: colorLegendTitle,
        scale: chordColorScale,
      },
      tooltip: [
        { field: 'value', type: 'nominal', title: 'Chord' },
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
          color: { field: 'value', type: 'nominal', title: colorLegendTitle, scale: chordColorScale },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Chord' },
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
            text: { field: 'value', type: 'nominal' },
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

      // Chord text label layer with high-contrast halo
      if (showLabels) {
        layers.push({
          transform: [
            { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0)`, as: 'x_mid' },
            { filter: `datum.duration == null || datum.duration >= 0.2` },
          ],
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'middle',
            fill: textFill,
            fontWeight: 'bold',
            fontSize: 11,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            clip: true,
          },
          encoding: {
            x: { field: 'x_mid', type: 'quantitative' },
            y: { value: mainPlotHeight / 2 + 10 },
            text: { field: 'value', type: 'nominal' },
          },
        });
      }
    }

    // Cursor
    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    // If overview brush is enabled and dataset has > 20 items, make an interactive overview + detail spec
    if (enableOverviewBrush && data.length > 20) {
      const vconcatWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : undefined;
      const detailHeight = chartHeight - 80;

      // Strip conflicting grid zoom/pan params on detail when overview brush is active
      const detailLayers = layers.map(layer => {
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

      // Initial visible window: cover first ~35% of piece (or 30s) so brush is immediately visible & draggable
      const initialSpan = Math.min(30, (maxX - minX) * 0.35);
      const initialEnd = minX + (initialSpan > 0 ? initialSpan : (maxX - minX));

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        transform: transforms,
        config: baseConfig,
        vconcat: [
          {
            width: vconcatWidth,
            height: detailHeight,
            title: { text: `BOPP Chords: ${annotation.media_id}`, color: textColor },
            layer: detailLayers,
          },
          // Direct Overview Unit (official Vega-Lite interactive overview + detail pattern)
          {
            width: vconcatWidth,
            height: 64,
            title: {
              text: '🔍 TIMELINE NAVIGATOR: Drag window to pan · Drag edges or scroll wheel to zoom · Click & drag to select window',
              color: axisColor,
              fontSize: 10.5,
              fontWeight: 'bold',
            },
            mark: {
              type: 'rect',
              opacity: 0.50,
              cornerRadius: 2,
            },
            params: [
              {
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
                value: { [xField]: [minX, initialEnd] },
              },
            ],
            encoding: {
              x: {
                field: xField,
                type: 'quantitative',
                title: xTitle,
                scale: { domain: [minX, maxX] },
              },
              x2: { field: '_calc_end' },
              y: { value: 2 },
              y2: { value: 60 },
              color: {
                field: 'value',
                type: 'nominal',
                legend: null,
                scale: chordColorScale,
              },
            },
          },
        ],
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Chords: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
  }

  // =========================================================================
  // 1.5. KEY_MODE (Key & Mode Modulations)
  // Pitch axis ordered consistently by tonic note (alternating Major and Minor)
  // Colors matched to mir_eval circle of fifths!
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

    // Standard 24 musical keys in tonic order going UP from C at the bottom:
    // In Vega-Lite ordinal y-scale, domain[0] is placed at the top and domain[last] is placed at the bottom.
    // ALL_24_KEYS_TOP_TO_BOTTOM (ordered from B:min down to C:maj) ensures C:maj is at the bottom!
    // Each tonic groups Major and Minor together consistently across all datasets.
    const isPitchScheme = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    const mode = isPitchScheme ? 'pitch' : 'fifths';
    const keyDomain = [...ALL_24_KEYS_TOP_TO_BOTTOM];
    const keyColors = keyDomain.map(k => keyToMirEvalColor(k, mode));

    const keyColorScale = {
      domain: keyDomain,
      range: keyColors,
    };

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: isInterval ? 'rect' : 'tick',
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 1.5,
          cornerRadius: 3,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: xField,
            type: 'quantitative',
            title: xTitle,
            scale: { domain: [minX, maxX] },
          },
          ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
          y: {
            field: 'value',
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
          color: {
            field: 'value',
            type: 'nominal',
            title: isPitchScheme ? 'Key (Chromatic Pitch)' : 'Key (Circle of Fifths)',
            scale: keyColorScale,
            legend: {
              orient: 'top',
              titleFontWeight: 'bold',
            },
          },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.75, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Key' },
            { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
            ...(isInterval ? [{ field: durField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Duration' }] : []),
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    if (showLabels && isInterval) {
      layers.push({
        transform: [
          { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0.5)`, as: 'x_mid' },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: textFill,
          fontWeight: 'bold',
          fontSize: 11,
          font: 'system-ui, -apple-system, sans-serif',
          clip: true,
          limit: { expr: `max(0, scale('x', datum._calc_end) - scale('x', datum.${xField}) - 4)` },
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: { field: 'value', type: 'nominal', scale: { domain: keyDomain } },
          text: { field: 'value', type: 'nominal' },
        },
      });
    }

    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    const keyPlotWidth = typeof chartWidth === 'number' ? Math.max(280, chartWidth - 120) : chartWidth;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: keyPlotWidth,
      height: Math.max(520, chartHeight ?? 480),
      title: {
        text: `BOPP Key Modulations: ${annotation.media_id}`,
        subtitle: 'All 24 tonics (grouped Major/Minor, C at bottom) · mir_eval Circle of Fifths colors',
        color: textColor,
        subtitleColor: axisColor,
      },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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

    if (enableOverviewBrush && data.length > 40) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        transform: transforms,
        config: baseConfig,
        vconcat: [
          {
            width: chartWidth,
            height: chartHeight - 80,
            title: { text: `BOPP Beats: ${annotation.media_id}`, color: textColor },
            layer: [
              {
                mark: { type: 'rule', size: 2 },
                encoding: {
                  x: {
                    field: 'time',
                    type: 'quantitative',
                    title: 'Time (seconds)',
                    scale: { domain: { param: 'brush' } },
                  },
                  y: {
                    condition: { test: isDownbeat, value: 20 },
                    value: 60,
                  },
                  y2: { value: chartHeight - 120 },
                  color: {
                    condition: { test: isDownbeat, value: downbeatColor },
                    value: regularColor,
                  },
                  tooltip: [
                    { field: 'value', type: 'nominal', title: 'Beat Number' },
                    { field: 'time', type: 'quantitative', format: '.3f', title: 'Timestamp (s)' },
                  ],
                },
              },
              {
                transform: [{ filter: isDownbeat }],
                mark: { type: 'point', filled: true, size: 60, color: downbeatColor },
                encoding: {
                  x: { field: 'time', type: 'quantitative', scale: { domain: { param: 'brush' } } },
                  y: { value: 20 },
                },
              },
              ...(cursor ? [cursor] : []),
            ],
          },
          {
            width: chartWidth,
            height: 50,
            title: { text: 'Overview (Drag brush to zoom & pan)', color: axisColor, fontSize: 10 },
            mark: { type: 'tick', opacity: 0.8, color: downbeatColor },
            params: [
              {
                name: 'brush',
                select: { type: 'interval', encodings: ['x'] },
                value: { time: [minX, maxX] },
              },
            ],
            encoding: {
              x: { field: 'time', type: 'quantitative', title: null, scale: { domain: [minX, maxX] } },
            },
          },
        ],
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Beats: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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
      { calculate: "['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((floor(datum.value) % 12) + 12) % 12]", as: 'pitch_class_name' }
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
              labelExpr: "['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][datum.value % 12] + (floor(datum.value / 12) - 1) + ' (' + datum.value + ')'",
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
              labelExpr: "['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][datum.value]",
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
          limit: { expr: `max(0, scale('x', datum._calc_end) - scale('x', datum.${xField}) - 2)` },
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: { field: 'value', type: 'quantitative' },
          text: { field: 'note_name', type: 'nominal' },
        },
      });
    }

    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight + 40,
      title: { text: `BOPP MIDI Piano Roll: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
  }

  // =========================================================================
  // 4. TIME_INTERVAL + MULTI_SEGMENT / SEGMENT_OPEN (Structural Analysis)
  // =========================================================================
  if (extentType === 'time_interval' && (payloadType === 'multi_segment' || payloadType === 'segment_open')) {
    const yField = payloadType === 'multi_segment' ? 'level' : 'value';
    const yType = payloadType === 'multi_segment' ? 'ordinal' : 'nominal';
    const colorField = payloadType === 'multi_segment' ? 'label' : 'value';
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
            title: payloadType === 'multi_segment' ? 'Structural Level' : 'Section',
            axis: {
              titlePadding: 14,
              labelPadding: 8,
              labelFontWeight: 'bold',
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
          limit: { expr: "max(0, scale('x', datum._calc_end) - scale('x', datum.time) - 4)" },
        },
        encoding: {
          x: { field: 'time_mid', type: 'quantitative' },
          y: { field: yField, type: yType },
          text: { field: '_display_label', type: 'nominal' },
        },
      });
    }

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const structPlotWidth = typeof chartWidth === 'number' ? Math.max(280, chartWidth - 80) : chartWidth;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: structPlotWidth,
      height: chartHeight,
      title: { text: `BOPP Structural Segmentation: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight + 40,
      title: { text: `BOPP Time-Frequency Bounding Boxes: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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

    if (enableOverviewBrush && data.length > 25) {
      const vconcatWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : undefined;
      const detailLayers = layers.map(layer => {
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

      const initialSpan = Math.min(1.5, (maxX - minX) * 0.4);
      const initialEnd = minX + (initialSpan > 0 ? initialSpan : (maxX - minX));

      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: data },
        transform: transforms,
        config: baseConfig,
        vconcat: [
          {
            width: vconcatWidth,
            height: chartHeight - 80,
            title: { text: `BOPP Vocal Melody & Pitch Contour (F0): ${annotation.media_id}`, color: textColor },
            layer: detailLayers,
          },
          // Direct Overview Unit for Pitch Contour
          {
            width: vconcatWidth,
            height: 60,
            title: {
              text: '🔍 TIMELINE NAVIGATOR: Drag window to pan · Drag edges or scroll wheel to zoom · Click & drag to select window',
              color: axisColor,
              fontSize: 10.5,
              fontWeight: 'bold',
            },
            mark: {
              type: 'area',
              color: isDark ? '#38bdf8' : '#0284c7',
              opacity: 0.45,
            },
            params: [
              {
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
                value: { time: [minX, initialEnd] },
              },
            ],
            encoding: {
              x: { field: 'time', type: 'quantitative', scale: { domain: [minX, maxX] }, title: 'Time (seconds)' },
              y: { field: 'frequency', type: 'quantitative', scale: { zero: false }, axis: null },
            },
          },
        ],
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Vocal Melody & Pitch Contour (F0): ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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
    const markType = isInterval ? 'rect' : 'tick';
    const colorScale = resolveColorScale(colorScheme, payloadType);

    if (isInterval) {
      transforms.push({
        calculate: 'datum.quarter + (datum.duration != null ? datum.duration : 0)',
        as: '_calc_end',
      });
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Score Notation Time: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: [
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
            y: { field: 'value', type: 'nominal', title: 'Payload' },
            color: { field: 'value', type: 'nominal', scale: colorScale },
            tooltip: [
              { field: 'value', type: 'nominal', title: 'Value' },
              { field: 'quarter_str', type: 'nominal', title: 'Quarter Fraction' },
              ...(isInterval ? [{ field: 'duration', type: 'quantitative', title: 'Duration' }] : []),
              ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', title: 'Confidence' }] : []),
            ],
          },
        },
      ],
    };
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

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Tempo (BPM): ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: layers,
    };
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

  const isInterval = extentType?.includes('interval');
  if (isInterval) {
    transforms.push({
      calculate: `datum.${xField} + (datum.duration != null ? datum.duration : 0)`,
      as: '_calc_end',
    });
  }
  const colorScale = resolveColorScale(colorScheme, payloadType);

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: chartWidth,
    height: chartHeight,
    title: { text: `BOPP Visualization: ${annotation.media_id} (${payloadType})`, color: textColor },
    data: { values: data },
    transform: transforms,
    config: baseConfig,
    mark: isInterval ? { type: 'bar', cornerRadius: 2 } : { type: 'tick', thickness: 3 },
    ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
    encoding: {
      x: { field: xField, type: 'quantitative', title: xField, scale: { domain: [minX, maxX] } },
      ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
      y: { field: 'value', type: 'nominal', title: payloadType },
      color: { field: 'value', type: 'nominal', scale: colorScale },
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
  };
}
