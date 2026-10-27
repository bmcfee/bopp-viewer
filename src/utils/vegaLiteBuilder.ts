/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vega-Lite Specification Builder for BOPP Annotations
 * Composes meaningful visual representations based on extents, payloads, and confidences
 * Integrates mir_eval circle-of-fifths and chromatic pitch color palettes.
 */

import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { annotationToTabular, noteNameToMidi, hzToMidi, midiToHz, midiToNoteName } from './boppParser';
import {
  chordToMirEvalColor,
  keyToMirEvalColor,
  getSplitKeyColors,
  getKeyTonicRank,
  normalizeKeyName,
  parseKeyMode,
  extractChordRoot,
  toUnicodeAccidentals,
  ALL_24_KEYS_TOP_TO_BOTTOM,
  FIFTHS_ORDER_12_ROOTS,
  CHROMATIC_ROOT_MAP,
  MIR_EVAL_COLORMAPS,
  registerMirEvalSchemes,
} from './mirEvalColors';
import {
  type ConfidenceChannelMode,
  buildIntervalConfidenceLayers,
  buildEmbeddedConfidenceMeterLayers,
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

/**
 * Standard Vega-Lite v6 specification schema URL.
 */
export const VEGA_LITE_SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json';

export interface VegaLiteBuilderOptions {
  theme?: 'light' | 'dark';
  colorScheme?: string;
  confidenceChannel?: ConfidenceChannelMode;
  minConfidenceFilter?: number;
  maxConfidenceFilter?: number;
  enableOverviewBrush?: boolean;
  enableZoomPan?: boolean;
  showLabels?: boolean;
  currentTime?: number | null; // For synchronized playback head
  chartWidth?: number | string;
  chartHeight?: number;
  forceMultiRow?: boolean; // When true, flips disjoint interval plots to multi-row overlapping display style
}

/**
 * Compute the total pixel origin [originX, originY] of the Vega scenegraph
 * within its rendered <canvas> or <svg>.
 * Vega's `view.origin()` returns only `view._origin` and omits `view.padding()`,
 * whereas Vega's canvas renderer translates by `[padding.left + origin[0], padding.top + origin[1]]`.
 */
export function getVegaViewPlotOrigin(view: any): [number, number] {
  const origin = typeof view?.origin === 'function' ? view.origin() : [0, 0];
  const pad = typeof view?.padding === 'function' ? view.padding() : { left: 0, top: 0 };
  const ox = (typeof origin?.[0] === 'number' ? origin[0] : 0) + (typeof pad?.left === 'number' ? pad.left : 0);
  const oy = (typeof origin?.[1] === 'number' ? origin[1] : 0) + (typeof pad?.top === 'number' ? pad.top : 0);
  return [ox, oy];
}

/**
 * Resolve a sub-view group item from the root Vega scenegraph item by mark name
 * (e.g. 'concat_0_group' or 'concat_1_group'), falling back to index if unnamed.
 */
export function resolveVegaGroupItem(sgRoot: any, groupName: string, fallbackIndex: number): any {
  if (!sgRoot || !Array.isArray(sgRoot.items)) return sgRoot;
  const namedMark = sgRoot.items.find((m: any) => m?.name === groupName);
  const targetMark = namedMark || sgRoot.items[fallbackIndex];
  return targetMark?.items?.[0] || targetMark || sgRoot;
}

export function getScaleRangeSpan(scale: any, fallbackWidth: number): number {
  if (typeof scale?.range === 'function') {
    const rng = scale.range();
    if (Array.isArray(rng) && rng.length >= 2 && typeof rng[0] === 'number' && typeof rng[rng.length - 1] === 'number') {
      const span = Math.abs(rng[rng.length - 1] - rng[0]);
      if (span > 0) return span;
    }
  }
  return fallbackWidth;
}

/**
 * Resolves the active timeline scale and scenegraph group items from a live Vega View instance.
 * Supports single-view specs, vconcat (detail + overview brush), and hconcat (e.g. dynamic mood trajectory).
 */
export function resolveVegaTimelineScaleInfo(view: any): {
  scaleNames: string[];
  detailScaleName: string | undefined;
  detailYScaleName: string | undefined;
  overviewScaleName: string | undefined;
  isVConcat: boolean;
  detailGroup: any;
  overviewGroup: any;
} {
  const scaleNames = Object.keys(view?._runtime?.scales || {});
  let detailScaleName = ['concat_0_x', 'x', 'layer_0_x', ...scaleNames.filter(k => k.endsWith('_x'))].find(k =>
    scaleNames.includes(k)
  );
  if (detailScaleName === 'concat_0_x' && scaleNames.includes('concat_1_x')) {
    const s0 = typeof view?.scale === 'function' ? view.scale('concat_0_x') : null;
    const d0 = s0 && typeof s0.domain === 'function' ? s0.domain() : null;
    // If concat_0_x is a non-time scale with negative values (e.g. mood valence [-1.2, 1.2])
    if (d0 && typeof d0[0] === 'number' && d0[0] < -0.1) {
      detailScaleName = 'concat_1_x';
    }
  }

  const detailYScaleName = ['concat_0_y', 'y', 'layer_0_y', ...scaleNames.filter(k => k.endsWith('_y'))].find(k =>
    scaleNames.includes(k)
  );
  const overviewScaleName = ['concat_1_x', ...scaleNames.filter(k => k.includes('concat_1') && k.endsWith('_x'))].find(
    k => scaleNames.includes(k)
  );
  const isVConcat = Boolean(
    scaleNames.includes('concat_0_x') && scaleNames.includes('concat_1_x') && detailScaleName === 'concat_0_x'
  );
  const sgRoot = view?.scenegraph?.()?.root?.items?.[0];
  const detailGroup = isVConcat
    ? resolveVegaGroupItem(sgRoot, 'concat_0_group', 0)
    : detailScaleName === 'concat_1_x'
    ? resolveVegaGroupItem(sgRoot, 'concat_1_group', 1)
    : sgRoot;
  const overviewGroup = isVConcat ? resolveVegaGroupItem(sgRoot, 'concat_1_group', 1) : null;

  return {
    scaleNames,
    detailScaleName,
    detailYScaleName,
    overviewScaleName,
    isVConcat,
    detailGroup,
    overviewGroup,
  };
}

/**
 * Computes the optimal default chart height for a BOPP annotation across both the React viewer and JupyterLab widget.
 */
export function computeOptimalChartHeight(
  annotation: BoppAnnotation,
  rowCount: number,
  options: {
    effectiveMultiRow?: boolean;
    isGlobalNoConfGenres?: boolean;
    filteredRowCount?: number;
    containerWidth?: number;
  } = {}
): number {
  const {
    effectiveMultiRow = false,
    isGlobalNoConfGenres = false,
    filteredRowCount = rowCount,
    containerWidth = 760,
  } = options;
  const pType = annotation.payload?.payload_type as string | undefined;
  const eType = annotation.extent?.extent_type as string | undefined;

  if (pType === 'key_mode') {
    if (eType?.includes('interval')) {
      return effectiveMultiRow ? 340 : 220;
    }
    return 540;
  }
  if (pType === 'note_midi' || pType === 'piano_roll') return 460;
  if (pType === 'chord') return effectiveMultiRow ? 420 : 320;
  if (pType === 'multi_segment' || pType === 'segment_open' || pType === 'tag_open') {
    if (!eType || eType === 'none') {
      if (isGlobalNoConfGenres) {
        const numCols = Math.max(1, Math.min(filteredRowCount, Math.floor((containerWidth - 80) / 194)));
        const numRows = Math.ceil(filteredRowCount / numCols);
        return Math.max(120, numRows * 50 + 70);
      }
      return Math.max(180, Math.min(420, rowCount * 44 + 80));
    }
    return effectiveMultiRow ? 360 : 240;
  }
  if (pType === 'pitch_contour' || pType === 'note_hz' || pType === 'frequency_hz') return 380;
  if (!eType || eType === 'none') return 440;
  return effectiveMultiRow ? 420 : 340;
}

export interface ResolvedExtentAxis {
  isMidi: boolean;
  isScore: boolean;
  isTime: boolean;
  isInterval: boolean;
  isInstantaneous: boolean;
  xField: 'time' | 'tick' | 'quarter' | '__index';
  xTitle: string;
  xFormat: string;
}

/**
 * Resolves the horizontal extent axis field, title, format, and interval/instantaneous flags for a BOPP annotation.
 */
export function resolveExtentAxis(
  extentType: string | undefined,
  data: TabularRecord[],
  options: { scoreTitle?: string } = {}
): ResolvedExtentAxis {
  const isMidi = Boolean(
    extentType?.includes('midi') ||
      extentType?.includes('tick') ||
      (data.length > 0 && typeof data[0].tick === 'number')
  );
  const isScore = Boolean(
    extentType?.includes('score') ||
      extentType?.includes('quarter') ||
      (data.length > 0 && typeof data[0].quarter === 'number')
  );
  const isTime = Boolean(extentType?.includes('time') || (data.length > 0 && typeof data[0].time === 'number'));
  const isInterval = Boolean(
    isIntervalExtentType(extentType) || data.some(d => typeof d.duration === 'number')
  );
  const isInstantaneous = Boolean(
    extentType === 'time_instantaneous' ||
      extentType === 'midi_tick' ||
      extentType === 'score_quarter' ||
      !isInterval
  );
  const xField: 'time' | 'tick' | 'quarter' | '__index' = isMidi
    ? 'tick'
    : isScore
    ? 'quarter'
    : isTime
    ? 'time'
    : '__index';
  const xTitle = isMidi
    ? 'MIDI Tick'
    : isScore
    ? options.scoreTitle || 'Score Time (Quarter Notes)'
    : isTime
    ? 'Time (seconds)'
    : 'Observation Index';
  const xFormat = isMidi ? 'd' : '.2f';

  return { isMidi, isScore, isTime, isInterval, isInstantaneous, xField, xTitle, xFormat };
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
  const isMirEval = isMirEvalFifths || isMirEvalPitch;
  const mirPalette = isMirEvalPitch ? MIR_EVAL_COLORMAPS.pitch : MIR_EVAL_COLORMAPS.fifths;

  const validVegaSchemes = new Set([
    'tableau10', 'tableau20', 'category10', 'category20', 'category20b', 'category20c',
    'accent', 'dark2', 'paired', 'pastel1', 'pastel2', 'set1', 'set2', 'set3',
    'viridis', 'magma', 'inferno', 'plasma', 'cividis', 'blues', 'tealblues', 'greens',
    'purples', 'reds', 'oranges', 'spectral', 'warm', 'cool', 'turbo'
  ]);
  const normalizedScheme = schemeName.toLowerCase();
  const isStandardVegaScheme = validVegaSchemes.has(normalizedScheme);

  if (payloadType === 'chord') {
    if (isMirEval) {
      const mode = isMirEvalPitch ? 'pitch' : 'fifths';
      return uniqueValues && uniqueValues.length > 0
        ? { domain: uniqueValues, range: uniqueValues.map(c => chordToMirEvalColor(c, mode)) }
        : { range: mirPalette };
    }
    return isStandardVegaScheme ? { scheme: normalizedScheme } : { range: MIR_EVAL_COLORMAPS.fifths };
  }

  const isPitchPayload =
    payloadType === 'note_midi' ||
    payloadType === 'note_hz' ||
    payloadType === 'frequency_hz' ||
    payloadType === 'note' ||
    payloadType === 'hz' ||
    payloadType === 'pitch_contour' ||
    payloadType === 'piano_roll';

  if (isPitchPayload) {
    if (isMirEval) {
      if (uniqueValues && uniqueValues.length > 0) {
        return {
          domain: uniqueValues,
          range: uniqueValues.map(v => {
            const num = Number(v);
            const pc = isNaN(num) ? 0 : ((Math.round(num) % 12) + 12) % 12;
            return mirPalette[pc];
          }),
        };
      }
      return { range: mirPalette };
    }
    return isStandardVegaScheme ? { scheme: normalizedScheme } : { range: MIR_EVAL_COLORMAPS.fifths };
  }

  if (isMirEval) {
    return uniqueValues && uniqueValues.length > 0
      ? { domain: uniqueValues, range: uniqueValues.map((_, i) => mirPalette[i % 12]) }
      : { range: mirPalette };
  }

  if (isStandardVegaScheme) {
    return uniqueValues && uniqueValues.length > 0
      ? { domain: uniqueValues, scheme: normalizedScheme }
      : { scheme: normalizedScheme };
  }

  return uniqueValues && uniqueValues.length > 0
    ? { domain: uniqueValues, range: uniqueValues.map((_, i) => MIR_EVAL_COLORMAPS.fifths[i % 12]) }
    : { range: MIR_EVAL_COLORMAPS.fifths };
}

/**
 * Extracts base chord label without inversion (e.g. C:maj/3 -> C:maj, G:7/5 -> G:7)
 * to group chord rows cleanly without inversions causing redundant vertical rows.
 */
function getBaseChordLabel(chord: string): string {
  if (!chord) return '';
  return chord.replace(/\/[a-zA-Z0-9#b_]+$/, '');
}

/**
 * Composable helper that builds centered text labels (with optional high-contrast dark halo)
 * inside horizontal interval patches, automatically clipping to the rendered patch pixel width.
 */
function buildIntervalCenteredLabelLayers(params: {
  xField: string;
  endField?: string;
  midField?: string;
  fallbackHalfDur?: number;
  minDuration?: number;
  minPixelWidth?: number;
  paddingPx?: number;
  yEncoding: Record<string, unknown>;
  fgYEncoding?: Record<string, unknown>;
  textField: string;
  font?: string;
  fontSize?: number;
  textColor?: string;
  withHalo?: boolean;
}): Record<string, unknown>[] {
  const {
    xField,
    endField = '_calc_end',
    midField = 'x_mid',
    fallbackHalfDur = 0,
    minDuration,
    minPixelWidth = 10,
    paddingPx = 4,
    yEncoding,
    fgYEncoding,
    textField,
    font = 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize = 11,
    textColor = '#ffffff',
    withHalo = true,
  } = params;

  const pixelWidthExpr = `(scale('concat_0_x', datum.${endField}) != null ? scale('concat_0_x', datum.${endField}) : scale('x', datum.${endField})) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField}))`;
  const limitExpr = `max(0.001, ${pixelWidthExpr} - ${paddingPx})`;
  const testExpr = `(${pixelWidthExpr}) <= ${minPixelWidth}`;

  const labelTransforms: Record<string, unknown>[] = [
    {
      calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : ${fallbackHalfDur})`,
      as: midField,
    },
    ...(typeof minDuration === 'number'
      ? [{ filter: `datum.duration == null || datum.duration >= ${minDuration}` }]
      : []),
  ];

  const textEncoding = {
    condition: {
      test: testExpr,
      value: '',
    },
    field: textField,
    type: 'nominal',
  };

  const out: Record<string, unknown>[] = [];
  if (withHalo) {
    out.push({
      transform: labelTransforms,
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'middle',
        fill: 'transparent',
        stroke: 'rgba(0,0,0,0.85)',
        strokeWidth: 3,
        strokeJoin: 'round',
        fontWeight: 'bold',
        fontSize,
        font,
        clip: true,
        limit: { expr: limitExpr },
      },
      encoding: {
        x: { field: midField, type: 'quantitative' },
        y: yEncoding,
        text: textEncoding,
      },
    });
  }

  out.push({
    transform: labelTransforms,
    mark: {
      type: 'text',
      align: 'center',
      baseline: 'middle',
      fill: textColor,
      fontWeight: 'bold',
      fontSize,
      font,
      clip: true,
      limit: { expr: limitExpr },
    },
    encoding: {
      x: { field: midField, type: 'quantitative' },
      y: fgYEncoding ?? yEncoding,
      text: textEncoding,
    },
  });

  return out;
}

/**
 * Composable 2-layer corner label (halo backdrop + crisp white foreground) for 2D bounding boxes
 * (`time_frequency_box` and `pixel_box`).
 */
function buildBoundingBoxCornerLabelLayers(params: {
  xField: string;
  yField: string;
  yScale?: Record<string, unknown>;
  labelField: string;
  hasConfidence: boolean;
}): Record<string, unknown>[] {
  const { xField, yField, yScale, labelField, hasConfidence } = params;
  const calcTransform = {
    calculate: hasConfidence
      ? "datum.value + (datum.confidence != null ? ' · ' + round(datum.confidence * 100) + '%' : '')"
      : 'datum.value',
    as: labelField,
  };
  const yEnc: Record<string, unknown> = {
    field: yField,
    type: 'quantitative',
    ...(yScale ? { scale: yScale } : {}),
  };

  return [
    {
      transform: [calcTransform],
      mark: {
        type: 'text',
        align: 'left',
        baseline: 'top',
        dx: 4,
        dy: 4,
        fontSize: 10,
        fontWeight: 'bold',
        fill: 'transparent',
        stroke: 'rgba(0,0,0,0.85)',
        strokeWidth: 3,
        strokeJoin: 'round',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: yEnc,
        text: { field: labelField, type: 'nominal' },
      },
    },
    {
      transform: [calcTransform],
      mark: {
        type: 'text',
        align: 'left',
        baseline: 'top',
        dx: 4,
        dy: 4,
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#ffffff',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: yEnc,
        text: { field: labelField, type: 'nominal' },
      },
    },
  ];
}

/**
 * Composable quadrant axes and emotion labels for Russell Circumplex 2D affect plots.
 */
function buildCircumplexQuadrantLayers(gridColor: string, axisColor: string): Record<string, unknown>[] {
  return [
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
}

/**
 * Composable data builder for a 12-sector Circle-of-Fifths donut ring (Major outer ring or Minor inner ring).
 */
function buildKeyDonutRingData(params: {
  isMinorRing: boolean;
  sortedCandidates: Array<{
    fullKey: string;
    root: string;
    semitone: number;
    isMinor: boolean;
    isMode: boolean;
    parsed: ReturnType<typeof parseKeyMode>;
    confidence: number | null;
    tonicColor: string;
    relMajColor: string;
    label: string;
  }>;
  mode: 'fifths' | 'pitch';
  isDark: boolean;
  confidenceChannel: ConfidenceChannelMode;
}): Record<string, unknown>[] {
  const { isMinorRing, sortedCandidates, mode, isDark, confidenceChannel } = params;
  const palette = isMinorRing
    ? mode === 'pitch'
      ? MIR_EVAL_COLORMAPS.pitch_dark
      : MIR_EVAL_COLORMAPS.fifths_dark
    : mode === 'pitch'
    ? MIR_EVAL_COLORMAPS.pitch
    : MIR_EVAL_COLORMAPS.fifths;

  const ringLabel = isMinorRing ? 'Inner (Minor)' : 'Outer (Major)';
  const modeDefaultLabel = isMinorRing ? 'Minor' : 'Major';
  const inactiveOpacity = isMinorRing ? (isDark ? 0.25 : 0.35) : isDark ? 0.28 : 0.38;

  return FIFTHS_ORDER_12_ROOTS.map((k, i) => {
    const kSem = CHROMATIC_ROOT_MAP[k] ?? 0;
    const allMatches = sortedCandidates.filter(c => c.semitone === kSem && Boolean(c.isMinor) === isMinorRing);
    const matchingCand = allMatches[0];
    const isActive = Boolean(matchingCand);
    const isMultiMode = allMatches.length > 1;
    const candConf = matchingCand?.confidence ?? null;

    const sliceColor = palette[kSem];
    const isSplit = Boolean(isActive && matchingCand?.isMode);
    const outerColor = isSplit && matchingCand ? matchingCand.tonicColor : sliceColor;
    const innerColor = isSplit && matchingCand ? matchingCand.relMajColor : sliceColor;

    const confPct = candConf !== null ? `${Math.round(candConf * 100)}%` : '';
    const badgeText = isMultiMode
      ? allMatches
          .map(m => (m.confidence !== null ? `${Math.round(m.confidence * 100)}%` : ''))
          .filter(Boolean)
          .join('/')
      : isActive && candConf !== null
      ? confPct
      : '';

    const theta0 = -Math.PI / 12 + i * (Math.PI / 6);
    const theta1 = Math.PI / 12 + i * (Math.PI / 6);
    const margin = 0.015;
    const meterStart = theta0 + margin;
    const meterTrackEnd = theta1 - margin;
    const totalSpan = meterTrackEnd - meterStart;
    const confVal = typeof candConf === 'number' ? Math.max(0, Math.min(1, candConf)) : 0;
    const meterFillEnd = meterStart + confVal * totalSpan;
    const hasMeter = Boolean(isActive && typeof candConf === 'number' && confidenceChannel !== 'none');

    const multiModeDescription = isMultiMode
      ? allMatches
          .map(m => `${m.label} (${m.confidence !== null ? Math.round(m.confidence * 100) + '%' : 'detected'})`)
          .join(' + ')
      : candConf !== null
      ? `${matchingCand?.label} (${confPct})`
      : `Detected ${matchingCand?.label}`;

    return {
      key: k,
      displayKey: isMinorRing ? k.toLowerCase() : k,
      ring: ringLabel,
      fifths: i,
      count: 1,
      color: sliceColor,
      outerColor,
      innerColor,
      isSplit,
      isMultiMode,
      active: isActive,
      activeOpacity: isActive ? 1.0 : 0.0,
      activeStroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : 'transparent',
      activeStrokeWidth: isActive ? 3 : 0,
      stroke: isActive ? (isDark ? '#ffffff' : '#0f172a') : isDark ? '#334155' : '#cbd5e1',
      strokeWidth: isActive ? 2.5 : 1,
      opacity: isActive ? Math.max(0.85, Math.min(1.0, 0.55 + (candConf ?? 1.0) * 0.45)) : inactiveOpacity,
      textColor: isActive ? (isDark ? '#ffffff' : '#0f172a') : isDark ? '#94a3b8' : '#64748b',
      fullKey: isMultiMode
        ? allMatches.map(m => m.fullKey).join(' / ')
        : matchingCand?.fullKey ?? `${k}:${isMinorRing ? 'min' : 'maj'}`,
      label: isMultiMode
        ? allMatches.map(m => m.label).join(' / ')
        : matchingCand?.label ?? `${k} ${modeDefaultLabel}`,
      modeName: isMultiMode
        ? allMatches.map(m => m.parsed?.mode ?? modeDefaultLabel).join(' + ')
        : matchingCand?.isMode
        ? matchingCand.parsed?.mode
        : modeDefaultLabel,
      confidence: candConf,
      confPct,
      badge: badgeText,
      badgeOpacity: isActive && badgeText ? 1.0 : 0.0,
      meterStart,
      meterTrackEnd,
      meterFillEnd,
      hasMeter,
      confVal,
      status: isActive ? multiModeDescription : `${modeDefaultLabel} Sector`,
    };
  });
}

/**
 * Composable Vega-Lite layer builder for a single Circle-of-Fifths donut ring
 * (split tonic/relative-major sectors, perimeter border, active highlight, rim confidence meter, and badge).
 */
function buildKeyDonutRingLayers(params: {
  ringValues: Record<string, unknown>[];
  innerRadius: number;
  splitRadius: number;
  outerRadius: number;
  meterInnerRadius: number;
  meterOuterRadius: number;
  meterCornerRadius: number;
  badgeRadius: number;
  badgeFontSize: number;
  isDark: boolean;
  trackAlphaDark?: number;
  trackStrokeAlphaDark?: number;
}): Record<string, unknown>[] {
  const {
    ringValues,
    innerRadius,
    splitRadius,
    outerRadius,
    meterInnerRadius,
    meterOuterRadius,
    meterCornerRadius,
    badgeRadius,
    badgeFontSize,
    isDark,
    trackAlphaDark = 0.18,
    trackStrokeAlphaDark = 0.25,
  } = params;

  const thetaEncoding = {
    field: 'count',
    type: 'quantitative',
    stack: true,
    scale: { range: [-Math.PI / 12, 2 * Math.PI - Math.PI / 12] },
  };
  const sectorTooltip = [
    { field: 'ring', type: 'nominal', title: 'Ring' },
    { field: 'key', type: 'nominal', title: 'Tonic Root' },
    { field: 'modeName', type: 'nominal', title: 'Mode' },
    { field: 'fullKey', type: 'nominal', title: 'Chord/Key' },
    { field: 'status', type: 'nominal', title: 'Status' },
  ];
  const meterTooltip = [
    { field: 'fullKey', type: 'nominal', title: 'Chord / Key' },
    { field: 'confPct', type: 'nominal', title: 'Confidence' },
    { field: 'status', type: 'nominal', title: 'Status' },
  ];

  return [
    // Outer 80% of sector (Tonic color)
    {
      data: { values: ringValues },
      encoding: {
        theta: thetaEncoding,
        order: { field: 'fifths', type: 'quantitative' },
        color: { field: 'outerColor', type: 'nominal', scale: null },
        opacity: { field: 'opacity', type: 'quantitative', scale: null },
        tooltip: sectorTooltip,
      },
      mark: { type: 'arc', innerRadius: splitRadius, outerRadius },
    },
    // Inner 20% of sector (Relative Major color for modes, Tonic for simple keys)
    {
      data: { values: ringValues },
      encoding: {
        theta: thetaEncoding,
        order: { field: 'fifths', type: 'quantitative' },
        color: { field: 'innerColor', type: 'nominal', scale: null },
        opacity: { field: 'opacity', type: 'quantitative', scale: null },
        tooltip: sectorTooltip,
      },
      mark: { type: 'arc', innerRadius, outerRadius: splitRadius },
    },
    // Perimeter boundary around entire sector
    {
      data: { values: ringValues },
      encoding: {
        theta: thetaEncoding,
        order: { field: 'fifths', type: 'quantitative' },
        color: { value: 'transparent' },
        stroke: { field: 'stroke', type: 'nominal', scale: null },
        strokeWidth: { field: 'strokeWidth', type: 'quantitative', scale: null },
      },
      mark: { type: 'arc', innerRadius, outerRadius },
    },
    // Active candidate accent highlight border
    {
      data: { values: ringValues },
      encoding: {
        theta: thetaEncoding,
        order: { field: 'fifths', type: 'quantitative' },
        color: { value: 'transparent' },
        opacity: { field: 'activeOpacity', type: 'quantitative', scale: null },
        stroke: { field: 'activeStroke', type: 'nominal', scale: null },
        strokeWidth: { field: 'activeStrokeWidth', type: 'quantitative', scale: null },
      },
      mark: { type: 'arc', innerRadius, outerRadius },
    },
    // Confidence meter track along outer rim
    {
      data: { values: ringValues },
      transform: [{ filter: 'datum.hasMeter === true' }],
      mark: {
        type: 'arc',
        innerRadius: meterInnerRadius,
        outerRadius: meterOuterRadius,
        cornerRadius: meterCornerRadius,
      },
      encoding: {
        theta: { field: 'meterStart', type: 'quantitative', scale: null },
        theta2: { field: 'meterTrackEnd' },
        color: { value: isDark ? `rgba(255,255,255,${trackAlphaDark})` : 'rgba(15,23,42,0.15)' },
        stroke: { value: isDark ? `rgba(255,255,255,${trackStrokeAlphaDark})` : 'rgba(15,23,42,0.2)' },
        strokeWidth: { value: 0.8 },
        tooltip: meterTooltip,
      },
    },
    // Confidence meter fill arc along outer rim
    {
      data: { values: ringValues },
      transform: [{ filter: 'datum.hasMeter === true' }],
      mark: {
        type: 'arc',
        innerRadius: meterInnerRadius,
        outerRadius: meterOuterRadius,
        cornerRadius: meterCornerRadius,
      },
      encoding: {
        theta: { field: 'meterStart', type: 'quantitative', scale: null },
        theta2: { field: 'meterFillEnd' },
        color: { value: isDark ? '#ffffff' : '#0f172a' },
        tooltip: meterTooltip,
      },
    },
    // Confidence percentage badge on active slices
    {
      data: { values: ringValues },
      encoding: {
        theta: thetaEncoding,
        order: { field: 'fifths', type: 'quantitative' },
        text: { field: 'badge', type: 'nominal' },
        opacity: { field: 'badgeOpacity', type: 'quantitative', scale: null },
      },
      mark: {
        type: 'text',
        radius: badgeRadius,
        fontSize: badgeFontSize,
        fontWeight: 'bold',
        fill: isDark ? '#ffffff' : '#0f172a',
      },
    },
  ];
}

/**
 * Composable 80%/20% modal split interval patch builder for `key_mode` intervals
 * (used for both single-row disjoint tracks and multi-row overlapping tracks).
 */
function buildModalSplitIntervalLayers(params: {
  trackHeight: number;
  cornerRadius: number;
  xField: string;
  xTitle: string;
  minX: number;
  maxX: number;
  durField: string;
  isMidi: boolean;
  isDark: boolean;
  hasConfidence: boolean;
  confidenceChannel: ConfidenceChannelMode;
  zoomParams: Record<string, unknown>[];
  containerYEncoding: Record<string, unknown>;
  patchYEncoding: Record<string, unknown>;
  includeRowKeyTooltip?: boolean;
  includeSingleRowPctBadge?: boolean;
}): Record<string, unknown>[] {
  const {
    trackHeight,
    cornerRadius,
    xField,
    xTitle,
    minX,
    maxX,
    durField,
    isMidi,
    isDark,
    hasConfidence,
    confidenceChannel,
    zoomParams,
    containerYEncoding,
    patchYEncoding,
    includeRowKeyTooltip = false,
    includeSingleRowPctBadge = false,
  } = params;

  const tonicHeight = Math.round(trackHeight * 0.8);
  const relMajHeight = trackHeight - tonicHeight;
  const tonicOffset = -trackHeight / 2 + tonicHeight / 2;
  const relMajOffset = trackHeight / 2 - relMajHeight / 2;

  const opacityEncoding =
    hasConfidence && confidenceChannel === 'opacity'
      ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] } }
      : { value: 1.0 };

  const layers: Record<string, unknown>[] = [
    // Outer bounding container / border
    {
      mark: {
        type: 'rect',
        height: trackHeight,
        stroke: isDark ? '#ffffff' : '#0f172a',
        strokeWidth: 1.5,
        cornerRadius,
        fill: 'transparent',
      },
      ...(zoomParams.length ? { params: zoomParams } : {}),
      encoding: {
        x: {
          field: xField,
          type: 'quantitative',
          title: xTitle,
          scale: { domain: [minX, maxX] },
        },
        x2: { field: '_calc_end' },
        y: containerYEncoding,
        opacity: opacityEncoding,
        tooltip: [
          { field: '_display_value', type: 'nominal', title: 'Key / Mode' },
          { field: '_rel_maj_key', type: 'nominal', title: 'Relative Major' },
          ...(includeRowKeyTooltip ? [{ field: '_row_key', type: 'nominal', title: 'Tonic Row' }] : []),
          { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
          { field: durField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Duration' },
          ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
        ],
      },
    },
    // Top 80% patch: colored to tonic
    {
      mark: {
        type: 'rect',
        height: tonicHeight,
        yOffset: tonicOffset,
        cornerRadiusTopLeft: cornerRadius,
        cornerRadiusTopRight: cornerRadius,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: '_calc_end' },
        y: patchYEncoding,
        color: { field: '_color_tonic', type: 'nominal', scale: null },
        opacity: opacityEncoding,
      },
    },
    // Bottom 20% patch: colored to relative major tonic for modes, or tonic for simple keys
    {
      mark: {
        type: 'rect',
        height: relMajHeight,
        yOffset: relMajOffset,
        cornerRadiusBottomLeft: cornerRadius,
        cornerRadiusBottomRight: cornerRadius,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: '_calc_end' },
        y: patchYEncoding,
        color: {
          condition: { test: 'datum._is_mode === true', field: '_color_rel', type: 'nominal', scale: null },
          field: '_color_tonic',
          type: 'nominal',
          scale: null,
        },
        opacity: opacityEncoding,
      },
    },
  ];

  if (hasConfidence && confidenceChannel !== 'none') {
    layers.push(
      ...buildEmbeddedConfidenceMeterLayers({
        xField,
        endField: '_calc_end',
        confX2Field: '_conf_end',
        isDark,
        trackBackingFill: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.25)',
        cornerRadius: 1,
        yEncoding: patchYEncoding,
        markProps: {
          height: 3,
          yOffset: -trackHeight / 2 + 2.5,
          stroke: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
          strokeWidth: 0.5,
        },
        activeMarkProps: {
          stroke: isDark ? '#ffffff' : '#09090b',
          strokeWidth: 0.5,
        },
      })
    );

    if (includeSingleRowPctBadge) {
      layers.push({
        transform: [
          { filter: 'datum.confidence != null && (datum.duration == null || datum.duration >= 8)' },
          { calculate: `datum.${xField} + (datum.duration != null ? datum.duration / 2 : 0.5)`, as: 'x_mid' },
          { calculate: "round(datum.confidence * 100) + '%'", as: '_conf_pct_str' },
        ],
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          yOffset: -trackHeight / 2 + 10,
          fontSize: 9.5,
          fontWeight: 'bold',
          fill: isDark ? '#ffffff' : '#0f172a',
          font: 'ui-monospace, monospace',
        },
        encoding: {
          x: { field: 'x_mid', type: 'quantitative' },
          y: patchYEncoding,
          text: { field: '_conf_pct_str', type: 'nominal' },
        },
      });
    }
  }

  return layers;
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
    maxConfidenceFilter = 1,
    enableOverviewBrush = true,
    enableZoomPan = true,
    showLabels = true,
    currentTime = null,
    chartWidth = 760,
    chartHeight = 320,
    forceMultiRow,
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
  const isTimeFrequencyPlot = extentType === 'time_frequency_box' || payloadType === 'pitch_contour' || payloadType === 'note_hz' || payloadType === 'frequency_hz';
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

  // Base data transform (bidirectional confidence filtering)
  const transforms: Record<string, unknown>[] = [];
  if (hasConfidence) {
    const hasMin = typeof minConfidenceFilter === 'number' && minConfidenceFilter > 0;
    const hasMax = typeof maxConfidenceFilter === 'number' && maxConfidenceFilter < 1;
    if (hasMin && hasMax) {
      transforms.push({
        filter: `datum.confidence == null || (datum.confidence >= ${minConfidenceFilter} && datum.confidence <= ${maxConfidenceFilter})`,
      });
    } else if (hasMin) {
      transforms.push({
        filter: `datum.confidence == null || datum.confidence >= ${minConfidenceFilter}`,
      });
    } else if (hasMax) {
      transforms.push({
        filter: `datum.confidence == null || datum.confidence <= ${maxConfidenceFilter}`,
      });
    }
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
      // Bind scale to 'brush' across all layers encoding x so Vega-Lite establishes domainRaw bound to the brush signal
      const applyBrushScale = (layer: Record<string, any>): Record<string, any> => {
        if (Array.isArray(layer.layer)) {
          return {
            ...layer,
            layer: layer.layer.map(applyBrushScale),
          };
        }
        const { params: _p, ...cleanLayer } = layer;
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
      };
      const cleanDetailLayers = detailLayers.map(applyBrushScale);

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
              scale: { domain: [minXVal, maxXVal], nice: false },
              ...(ol.encoding?.x?.axis ? { axis: ol.encoding.x.axis } : {}),
            },
          },
        })),
      };

      return {
        $schema: VEGA_LITE_SCHEMA,
        data: { values: plotData },
        transform: plotTransforms,
        config: baseConfig,
        vconcat: [
          {
            width: vconcatWidth,
            height: topHeight,
            title: finalTitle,
            layer: cleanDetailLayers,
            resolve: {
              scale: { color: 'independent' },
            },
          },
          overviewUnit,
        ],
        resolve: {
          scale: { color: 'independent' },
        },
      };
    }

    // Single-unit fallback
    return {
      $schema: VEGA_LITE_SCHEMA,
      width: chartWidth,
      height: chartHeight,
      title: finalTitle,
      data: { values: plotData },
      transform: plotTransforms,
      config: baseConfig,
      layer: detailLayers,
      resolve: {
        scale: { color: 'independent' },
      },
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
        $schema: VEGA_LITE_SCHEMA,
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
      const outerRingValues = buildKeyDonutRingData({
        isMinorRing: false,
        sortedCandidates,
        mode,
        isDark,
        confidenceChannel,
      });

      // 2. Inner Ring: Minor Keys & Minor Modes (Aeolian, Dorian, Phrygian, Locrian)
      const innerRingValues = buildKeyDonutRingData({
        isMinorRing: true,
        sortedCandidates,
        mode,
        isDark,
        confidenceChannel,
      });

      const wheelSize = typeof chartWidth === 'number' ? Math.min(480, Math.max(360, chartWidth - 60)) : 400;

      const sameTonicCandidates = sortedCandidates.filter(c => c.root === primaryCandidate.root);
      const isMultiModeOnSameTonic = sameTonicCandidates.length > 1;

      const otherCount = sortedCandidates.length - 1;
      const centerSubtitle = isMultiModeOnSameTonic
        ? sameTonicCandidates.map(c => `${c.parsed?.mode ?? (c.isMinor ? 'min' : 'maj')} ${c.confidence !== null ? Math.round(c.confidence * 100) + '%' : ''}`).join(' · ')
        : primaryCandidate.isMode
        ? `${primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 100)}% · ` : ''}Rel Maj: ${primaryCandidate.parsed?.relativeMajorRoot} Maj`
        : hasMultipleCandidates
        ? `${primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 100)}%` : ''} (Primary)`
        : (primaryCandidate.confidence !== null ? `${Math.round(primaryCandidate.confidence * 1000) / 10}% confidence` : 'Harmonic tonal center');

      const centerDetail = isMultiModeOnSameTonic
        ? `Tonic: ${primaryCandidate.root} (${sameTonicCandidates.length} modes estimated)`
        : hasMultipleCandidates
        ? `${otherCount} other candidate${otherCount > 1 ? 's' : ''}`
        : '';

      const centerData = [
        {
          title: isMultiModeOnSameTonic ? `${primaryCandidate.root} Multi-Mode` : primaryCandidate.label,
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
            ? `Global Key Candidates`
            : `Global Key: ${primaryCandidate.label}`,
          subtitle: `Outer Donut: Major · Inner Donut: Minor · Outer Rim Arcs: Confidence Meters · ${annotation.media_id}`,
          color: textColor,
          subtitleColor: axisColor,
        },
        config: baseConfig,
        layer: [
          ...buildKeyDonutRingLayers({
            ringValues: outerRingValues,
            innerRadius: 104,
            splitRadius: 114,
            outerRadius: 148,
            meterInnerRadius: 150,
            meterOuterRadius: 156,
            meterCornerRadius: 2,
            badgeRadius: 139,
            badgeFontSize: 9.5,
            isDark,
            trackAlphaDark: 0.18,
            trackStrokeAlphaDark: 0.25,
          }),
          ...buildKeyDonutRingLayers({
            ringValues: innerRingValues,
            innerRadius: 58,
            splitRadius: 68,
            outerRadius: 98,
            meterInnerRadius: 99.5,
            meterOuterRadius: 103.5,
            meterCornerRadius: 1.5,
            badgeRadius: 68,
            badgeFontSize: 9,
            isDark,
            trackAlphaDark: 0.2,
            trackStrokeAlphaDark: 0.3,
          }),

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
        $schema: VEGA_LITE_SCHEMA,
        config: baseConfig,
        ...radialChartSpec,
      };
    }

    // 0C. GLOBAL GENRES & TAGS DISPLAY
    // Note: mood_thayer static affect is processed in section 8 below (Russell Circumplex)
    if (payloadType !== 'mood_thayer') {
      const colorScale = resolveColorScale(colorScheme, payloadType);

      // When NO confidence rating is provided, full-width quantitative bars are completely redundant.
      // Instead, render as an alphabetized collection of badges!
      const hasConfidenceData = hasConfidence && data.some(d => typeof d.confidence === 'number');

      if (!hasConfidenceData) {
        // Strictly alphabetize tags/genres
        const alphabetizedData = [...data].sort((a, b) =>
          String(a.value ?? '').localeCompare(String(b.value ?? ''), undefined, {
            sensitivity: 'base',
            numeric: true,
          })
        );

        const count = alphabetizedData.length;
        const availableW = typeof chartWidth === 'number' && chartWidth > 0 ? Math.max(300, chartWidth - 80) : 680;
        const badgeHeight = 38;
        const gapX = 14;
        const gapY = 12;
        const minBadgeWidth = 180;
        const numCols = Math.max(1, Math.min(count, Math.floor(availableW / (minBadgeWidth + gapX))));
        const numRows = Math.ceil(count / numCols);
        const actualColCount = Math.min(numCols, count);
        const actualBadgeWidth = Math.floor((availableW - (actualColCount - 1) * gapX) / actualColCount);
        const totalW = actualColCount * actualBadgeWidth + (actualColCount - 1) * gapX;
        const totalH = numRows * badgeHeight + (numRows - 1) * gapY;

        // Flow alphabetized badges in rows: left-to-right, then top-to-bottom
        const badgeValues = alphabetizedData.map((d, i) => {
          const col = i % numCols;
          const row = Math.floor(i / numCols);
          const x1 = col * (actualBadgeWidth + gapX);
          const x2 = x1 + actualBadgeWidth;
          const y1 = row * (badgeHeight + gapY);
          const y2 = y1 + badgeHeight;
          const valStr = String(d.value ?? '');
          return {
            value: valStr,
            x1,
            x2,
            y1,
            y2,
            dotX: x1 + 16,
            textX: x1 + 30,
            cy: y1 + badgeHeight / 2,
            rank: `#${i + 1} of ${count}`,
            scope: 'Global (Entire Media Object)',
          };
        });

        return {
          $schema: VEGA_LITE_SCHEMA,
          width: totalW,
          height: totalH,
          title: {
            text: `Global ${payloadType === 'tag' || payloadType === 'tag_open' ? 'Genres & Tags' : payloadType.toUpperCase()}: ${annotation.media_id}`,
            subtitle: `Alphabetized collection · Scope: Entire Media Object · ${count} ${count === 1 ? 'badge' : 'badges'} (No confidence rating)`,
            anchor: 'start',
            fontSize: 14,
            fontWeight: 'bold',
            subtitleFontSize: 11,
            color: textColor,
            subtitleColor: axisColor,
            offset: 20,
          },
          data: { values: badgeValues },
          config: {
            ...baseConfig,
            view: { stroke: 'transparent' },
          },
          layer: [
            // Badge background pill card
            {
              mark: {
                type: 'rect',
                cornerRadius: 19,
                strokeWidth: 1.5,
                cursor: 'pointer',
                fillOpacity: isDark ? 0.22 : 0.12,
              },
              encoding: {
                x: { field: 'x1', type: 'quantitative', scale: { domain: [0, totalW] }, axis: null },
                x2: { field: 'x2' },
                y: { field: 'y1', type: 'quantitative', scale: { domain: [0, totalH], reverse: true }, axis: null },
                y2: { field: 'y2' },
                color: { field: 'value', type: 'nominal', scale: colorScale, legend: null },
                stroke: { field: 'value', type: 'nominal', scale: colorScale, legend: null },
                tooltip: [
                  { field: 'value', type: 'nominal', title: 'Tag / Genre' },
                  { field: 'rank', type: 'nominal', title: 'Alphabetical Order' },
                  { field: 'scope', type: 'nominal', title: 'Scope' },
                ],
              },
            },
            // Badge accent circle / indicator dot
            {
              mark: {
                type: 'circle',
                size: 55,
                cursor: 'pointer',
              },
              encoding: {
                x: { field: 'dotX', type: 'quantitative', scale: { domain: [0, totalW] }, axis: null },
                y: { field: 'cy', type: 'quantitative', scale: { domain: [0, totalH], reverse: true }, axis: null },
                color: { field: 'value', type: 'nominal', scale: colorScale, legend: null },
                tooltip: [
                  { field: 'value', type: 'nominal', title: 'Tag / Genre' },
                ],
              },
            },
            // Badge text label
            {
              mark: {
                type: 'text',
                align: 'left',
                baseline: 'middle',
                fontSize: 12.5,
                fontWeight: 'bold',
                fill: textColor,
                font: 'system-ui, -apple-system, sans-serif',
                limit: actualBadgeWidth - 42,
                cursor: 'pointer',
              },
              encoding: {
                x: { field: 'textX', type: 'quantitative', scale: { domain: [0, totalW] }, axis: null },
                y: { field: 'cy', type: 'quantitative', scale: { domain: [0, totalH], reverse: true }, axis: null },
                text: { field: 'value', type: 'nominal' },
                tooltip: [
                  { field: 'value', type: 'nominal', title: 'Tag / Genre' },
                  { field: 'rank', type: 'nominal', title: 'Alphabetical Order' },
                ],
              },
            },
          ],
        };
      }

      // WITH Confidence rating: full horizontal quantitative axis with visible bars representing confidence %
      const tagHeight = Math.max(180, Math.min(420, data.length * 44 + 80));
      const sortedData = [...data].sort(
        (a, b) => (typeof b.confidence === 'number' ? b.confidence : 1) - (typeof a.confidence === 'number' ? a.confidence : 1)
      );
      const barWidth = typeof chartWidth === 'number' ? Math.max(260, chartWidth - 140) : chartWidth;

      return {
        $schema: VEGA_LITE_SCHEMA,
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
                title: 'Confidence / Relevance (0–100%)',
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
                { field: 'confidence', type: 'quantitative', format: '.2%', title: 'Confidence' },
              ],
            },
          },
          // In-bar Tag label annotation
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
          // Numeric percentage annotation at bar end
          {
            transform: [
              { calculate: 'datum.confidence != null ? datum.confidence : 1.0', as: 'conf_val' },
              { calculate: "datum.confidence != null ? round(datum.confidence * 1000) / 10 + '%' : ''", as: 'display_txt' },
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
    const { isMidi, isScore, xField: rawXField, xTitle } = resolveExtentAxis(extentType, data, {
      scoreTitle: 'Musical Time (Quarter Notes)',
    });
    const xField = rawXField === '__index' ? 'time' : rawXField;
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

    const colorLegendTitle = 'Chord';

    const isPointExtent = extentType === 'score_quarter' || extentType === 'midi_tick' || extentType === 'time';
    const isInstantaneous = isPointExtent && data.every(d => d.duration === undefined || d.duration === null || d.duration === 0);

    const intervalAnalysis = isInstantaneous ? null : analyzeIntervalAnnotation(annotation, data);
    const isOverlapping = Boolean(!isInstantaneous && intervalAnalysis && !intervalAnalysis.isDisjoint);
    const shouldMultiRow = Boolean(!isInstantaneous && (forceMultiRow !== undefined ? forceMultiRow : isOverlapping));

    // Assign rows per base chord label (ignoring inversions so e.g. C:maj and C:maj/3 share the same row)
    const chordDataWithLanes = enrichedChordData.map(d => {
      const rawVal = String(d.value ?? '');
      const baseLabel = toUnicodeAccidentals(getBaseChordLabel(rawVal));
      if (!shouldMultiRow) {
        return { ...d, _chord_row: 'Chords', _base_chord: baseLabel };
      }
      return {
        ...d,
        _chord_row: baseLabel || 'N',
        _base_chord: baseLabel || 'N',
      };
    });

    const getChordSemitone = (chordStr: string): number => {
      const root = extractChordRoot(chordStr);
      if (!root) return -1;
      return CHROMATIC_ROOT_MAP[root] ?? -1;
    };

    const uniqueChordRows = Array.from(new Set(chordDataWithLanes.map(d => d._chord_row))).filter(Boolean);
    uniqueChordRows.sort((a, b) => {
      const semA = getChordSemitone(a);
      const semB = getChordSemitone(b);
      // 'N' or unparsed non-harmonic tags go to the bottom
      if (semA === -1 && semB === -1) return a.localeCompare(b);
      if (semA === -1) return 1;
      if (semB === -1) return -1;
      if (semA !== semB) {
        // Chromatic pitch height: higher pitch at top (domain[0]), C at bottom
        return semB - semA;
      }
      return a.localeCompare(b);
    });

    const mainPlotHeight = enableOverviewBrush ? chartHeight - 80 : chartHeight - 40;
    const patchStroke = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.65)';

    const rectEncoding: Record<string, unknown> = {
      x: {
        field: xField,
        type: 'quantitative',
        title: xTitle,
        scale: { domain: [minX, maxX] },
      },
      x2: { field: '_calc_end' },
      y: shouldMultiRow
        ? {
            field: '_chord_row',
            type: 'nominal',
            title: 'Chord',
            sort: uniqueChordRows,
            scale: { domain: uniqueChordRows },
            axis: {
              labelFontWeight: 'bold',
              labelPadding: 8,
              minExtent: 70,
            },
          }
        : { value: 0 },
      ...(shouldMultiRow ? {} : { y2: { value: mainPlotHeight } }),
      color: {
        field: '_display_value',
        type: 'nominal',
        title: colorLegendTitle,
        scale: chordColorScale,
      },
      tooltip: [
        { field: '_display_value', type: 'nominal', title: 'Chord' },
        ...(shouldMultiRow ? [{ field: '_chord_row', type: 'nominal', title: 'Row' }] : []),
        { field: xField, type: 'quantitative', format: isScore ? '.1f' : isMidi ? 'd' : '.3f', title: 'Start' },
        { field: durField, type: 'quantitative', format: isScore ? '.1f' : isMidi ? 'd' : '.3f', title: 'Duration' },
        ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence' }] : []),
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
      // Instantaneous point chords (e.g. drive_time_points, score_quarter points): vertical rules + circle + labels
      layers.push({
        mark: {
          type: 'rule',
          strokeWidth: 2.5,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: xField, type: 'quantitative', title: xTitle, scale: { domain: [minX, maxX] } },
          y: { value: 36 },
          y2: { value: mainPlotHeight },
          color: { field: '_display_value', type: 'nominal', title: colorLegendTitle, scale: chordColorScale },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Chord' },
            { field: xField, type: 'quantitative', format: isScore ? '.1f' : isMidi ? 'd' : '.3f', title: 'Position' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
            ...(confidenceType === 'agreement' ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }] : []),
          ],
        },
      });

      // Accent circle marker along top
      layers.push({
        mark: { type: 'circle', size: 120 },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          y: { value: 36 },
          color: { field: '_display_value', type: 'nominal', scale: chordColorScale },
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
            baseline: 'middle',
            fill: '#ffffff',
            fontWeight: 'bold',
            fontSize: 10.5,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            y: { value: 36 },
            text: { field: '_display_value', type: 'nominal' },
          },
        });
      }
    } else {
      // Interval chords: rect blocks with clear outlines so patch transitions are razor sharp
      layers.push({
        mark: shouldMultiRow
          ? {
              type: 'bar',
              stroke: patchStroke,
              strokeWidth: 1.5,
              cornerRadius: 3,
            }
          : {
              type: 'rect',
              stroke: patchStroke,
              strokeWidth: 1.5,
              cornerRadius: 2,
            },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: rectEncoding,
      });

      // Overlay confidence meter along top edge for single row
      if (!shouldMultiRow && hasConfidence && confidenceChannel !== 'none') {
        layers.push(...buildIntervalConfidenceLayers({
          xField,
          endField: '_calc_end',
          durField,
          chartHeight,
          isDark,
          confidenceType: confidenceType as any,
          channelMode: confidenceChannel,
          yTop: 4,
          yBottom: mainPlotHeight,
          meterHeight: 4,
        }));
      } else if (shouldMultiRow && hasConfidence && confidenceChannel !== 'none') {
        // Multi-row confidence meter strip along top of each chord bar (unified MIDI note style)
        layers.push(
          ...buildEmbeddedConfidenceMeterLayers({
            xField,
            endField: '_calc_end',
            confX2Field: '_chord_conf_end',
            isDark,
            trackBackingFill: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.25)',
            cornerRadius: 1,
            yEncoding: {
              field: '_chord_row',
              type: 'nominal',
              sort: uniqueChordRows,
              scale: { domain: uniqueChordRows },
            },
            markProps: {
              height: 3,
              yOffset: 2.5,
              stroke: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
              strokeWidth: 0.5,
            },
            activeMarkProps: {
              stroke: isDark ? '#ffffff' : '#09090b',
              strokeWidth: 0.5,
            },
          })
        );
      }

      // Chord text label layer with high-contrast halo and strict patch-boundary clipping
      if (showLabels) {
        const yTextEncoding = shouldMultiRow
          ? { field: '_chord_row', type: 'nominal', sort: uniqueChordRows, scale: { domain: uniqueChordRows } }
          : { value: mainPlotHeight / 2 + 10 };

        layers.push(
          ...buildIntervalCenteredLabelLayers({
            xField,
            endField: '_calc_end',
            fallbackHalfDur: 0,
            minDuration: 0.2,
            minPixelWidth: 10,
            paddingPx: 4,
            yEncoding: yTextEncoding,
            textField: '_display_value',
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            withHalo: true,
          })
        );
      }
    }

    // Cursor
    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    const chordTitle = { text: `BOPP Chords: ${annotation.media_id}`, color: textColor };
    const overviewLayers = isInstantaneous
      ? [
          {
            mark: { type: 'rule', strokeWidth: 2.5 },
            encoding: {
              x: { field: xField, type: 'quantitative' },
              y: { value: 6 },
              y2: { value: 50 },
              color: { field: '_display_value', type: 'nominal', scale: chordColorScale, legend: null },
            },
          },
        ]
      : [
          {
            mark: shouldMultiRow
              ? { type: 'bar', opacity: 0.7, cornerRadius: 2, stroke: patchStroke, strokeWidth: 1 }
              : { type: 'rect', opacity: 0.7, cornerRadius: 2, stroke: patchStroke, strokeWidth: 1 },
            encoding: {
              x: { field: xField, type: 'quantitative' },
              x2: { field: '_calc_end' },
              y: shouldMultiRow ? { field: '_chord_row', type: 'nominal', sort: uniqueChordRows, scale: { domain: uniqueChordRows }, axis: null } : { value: 2 },
              ...(shouldMultiRow ? {} : { y2: { value: 52 } }),
              color: { field: '_display_value', type: 'nominal', legend: null, scale: chordColorScale },
            },
          },
        ];

    return composeTimelineSpecWithOverview({
      data: chordDataWithLanes,
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
    const { isMidi, isInterval, xField: rawXField, xTitle } = resolveExtentAxis(extentType, data, {
      scoreTitle: 'Musical Time (Quarter Notes)',
    });
    const xField = rawXField === '__index' ? 'time' : rawXField;
    const durField = 'duration';

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

    const uniqueKeysInPiece = Array.from(new Set(enrichedData.map(d => String(d.value ?? '')))).filter(Boolean);
    const orderedKeysInPiece = [...uniqueKeysInPiece].sort((a, b) => {
      const pa = parseKeyMode(a);
      const pb = parseKeyMode(b);
      const semA = pa ? pa.semitone : -1;
      const semB = pb ? pb.semitone : -1;
      if (semA === -1 && semB === -1) return a.localeCompare(b);
      if (semA === -1) return 1;
      if (semB === -1) return -1;
      if (semA !== semB) {
        // Chromatic pitch height: higher semitone at top (domain[0]), C at bottom
        return semB - semA;
      }
      const minA = pa?.isMinor ? 1 : 0;
      const minB = pb?.isMinor ? 1 : 0;
      if (minA !== minB) return minA - minB;
      return a.localeCompare(b);
    });
    // In multi-row mode, scale domain ONLY to keys in the piece to avoid 20+ empty rows!
    const keyDomain = orderedKeysInPiece.length > 0 ? orderedKeysInPiece : ALL_24_KEYS_TOP_TO_BOTTOM;
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
    const yTitle = useSingleRow ? singleRowAxisTitle : 'Tonic Pitch';

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
            sort: keyDomain,
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
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: '_display_value', type: 'nominal', title: 'Key/Mode' },
            { field: '_rel_maj_key', type: 'nominal', title: 'Relative Major' },
            { field: xField, type: 'quantitative', format: isMidi ? 'd' : '.3f', title: 'Start' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
          ],
        },
      });
    } else {
      // Composable 80% Tonic / 20% Relative Major modal split interval patches (for single-row disjoint or multi-row overlapping)
      const containerYEncoding = useSingleRow
        ? {
            field: yField,
            type: yType,
            title: yTitle,
            axis: {
              labels: false,
              ticks: false,
              titlePadding: 14,
              minExtent: 80,
            },
          }
        : {
            field: yField,
            type: 'nominal',
            title: 'Tonic Pitch',
            sort: keyDomain,
            scale: { domain: keyDomain },
            axis: {
              labelFontWeight: 'bold',
              labelFontSize: 11,
              titlePadding: 14,
              labelPadding: 8,
              minExtent: 70,
            },
          };

      const patchYEncoding = useSingleRow
        ? { field: yField, type: yType }
        : { field: yField, type: 'nominal', sort: keyDomain, scale: { domain: keyDomain } };

      layers.push(
        ...buildModalSplitIntervalLayers({
          trackHeight: useSingleRow ? 44 : 26,
          cornerRadius: useSingleRow ? 4 : 3,
          xField,
          xTitle,
          minX,
          maxX,
          durField,
          isMidi: Boolean(isMidi),
          isDark,
          hasConfidence,
          confidenceChannel,
          zoomParams: makeZoomParam(),
          containerYEncoding,
          patchYEncoding,
          includeRowKeyTooltip: !useSingleRow,
          includeSingleRowPctBadge: useSingleRow,
        })
      );
    }

    // Text labels inside patches with high-contrast halo and strict patch-boundary clipping
    if (showLabels && isInterval) {
      layers.push(
        ...buildIntervalCenteredLabelLayers({
          xField,
          endField: '_calc_end',
          fallbackHalfDur: 0.5,
          minPixelWidth: 10,
          paddingPx: 4,
          yEncoding: useSingleRow
            ? { field: yField, type: yType }
            : { field: yField, type: 'nominal', scale: { domain: keyDomain } },
          fgYEncoding: useSingleRow
            ? { field: yField, type: yType }
            : { field: yField, type: 'nominal', sort: keyDomain, scale: { domain: keyDomain } },
          textField: '_display_value',
          font: 'system-ui, -apple-system, sans-serif',
          fontSize: 11,
          withHalo: true,
        })
      );
    }

    const cursor = makeCursorLayer(xField);
    if (cursor) layers.push(cursor);

    const keyPlotWidth = typeof chartWidth === 'number' ? Math.max(280, chartWidth - 120) : chartWidth;
    const computedHeight = useSingleRow ? Math.max(160, Math.min(220, chartHeight ?? 180)) : Math.max(520, chartHeight ?? 480);

    const keyTitle = {
      text: `BOPP Key & Mode: ${annotation.media_id}`,
      subtitle: useSingleRow
        ? 'Disjoint Interval Track (1 Row) · Modal Split Colors: Top = Tonic, Bottom = Relative Major Tonic'
        : 'Overlapping Multi-Row Key Tracks · Modal Split Patches',
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
        showTextLabels: false,
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
  // 2.5. TIME / TIME_UNIFORM + ONSET / MARKER (Point Events / Transients)
  // Clean impulse / stem plot proportional to likelihood without crowding!
  // =========================================================================
  if ((extentType === 'time' || extentType === 'time_uniform') && (payloadType === 'onset' || payloadType === 'marker')) {
    const onsetColor = isDark ? '#38bdf8' : '#0284c7';
    const mainPlotHeight = chartHeight - 74;
    const markerDesc = (annotation.payload as any)?.description || (data[0]?.description as string) || (payloadType === 'onset' ? 'onset' : 'marker');

    const layers: Record<string, unknown>[] = [
      // Stems from baseline 0 up to likelihood height
      {
        mark: { type: 'rule', strokeWidth: 2.5, strokeCap: 'round', stroke: onsetColor },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
          y: { datum: 0 },
          y2: {
            field: hasConfidence ? 'confidence' : 'value',
            type: 'quantitative',
            scale: { domain: [0, 1], zero: true },
          },
          tooltip: [
            { field: 'time', type: 'quantitative', format: '.3f', title: 'Timestamp (s)' },
            { field: 'description', type: 'nominal', title: 'Event' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Detection Likelihood' }] : []),
          ],
        },
      },
      // Accent cap circle at peak of each onset spike
      {
        mark: { type: 'circle', size: 48, color: onsetColor },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: {
            field: hasConfidence ? 'confidence' : 'value',
            type: 'quantitative',
            title: hasConfidence ? 'Likelihood' : 'Marker',
            scale: { domain: [0, 1], zero: true },
            axis: hasConfidence
              ? { format: '.0%', titleColor: textColor, labelColor: axisColor, tickCount: 5 }
              : { titleColor: textColor, labelColor: axisColor, tickCount: 5 },
          },
          tooltip: [
            { field: 'time', type: 'quantitative', format: '.3f', title: 'Timestamp (s)' },
            { field: 'description', type: 'nominal', title: 'Event' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Detection Likelihood' }] : []),
          ],
        },
      },
    ];

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const onsetTitle = {
      text: payloadType === 'marker'
        ? `BOPP Event Markers (${markerDesc}): ${annotation.media_id}`
        : `BOPP Percussive Transient Onsets: ${annotation.media_id}`,
      color: textColor,
    };
    const overviewLayers = [
      {
        mark: { type: 'rule', strokeWidth: 1.5, stroke: onsetColor, opacity: 0.8 },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          y: { value: 6 },
          y2: { value: 48 },
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
      plotTitle: onsetTitle,
      detailPlotHeight: mainPlotHeight,
    });
  }

  // =========================================================================
  // 3. NOTE, NOTE_MIDI, FREQUENCY_HZ & NOTE_HZ (Piano Roll)
  // Unit height note bars centered on the MIDI pitch number with opaque boxes!
  // Axis is strictly NUMERICAL (quantitative), never categorical, reflecting true
  // semitone spacing from note names to MIDI numbers (and thus to log frequency).
  // Colors matched to mir_eval palette by pitch class (C=0 .. B=11).
  // Supports dimming unvoiced frequencies using the voiced flag vector.
  // =========================================================================
  if (
    payloadType === 'note_midi' ||
    payloadType === 'note' ||
    (payloadType as string) === 'piano_roll'
  ) {
    const { isMidi, isScore, xField: rawXField, xTitle } = resolveExtentAxis(extentType, data, {
      scoreTitle: 'Musical Quarter Notes',
    });
    const xField = rawXField === '__index' ? 'time' : rawXField;
    
    const isPitchScheme = colorScheme === 'mir_eval_pitch' || colorScheme === 'pitch';
    // mir_eval exact pitch class colors: 12 elements for semitones 0 (C) through 11 (B)
    const pitchClassColors = isPitchScheme ? MIR_EVAL_COLORMAPS.pitch : MIR_EVAL_COLORMAPS.fifths;

    // Normalize each record so that datum.value is strictly a numerical MIDI note number
    // Even if the input provided string note names ("C3", "D3", "E3") or frequencies in Hz
    const enrichedNoteData = data.map(d => {
      let numericMidi = typeof d.value === 'number' && payloadType !== 'note_hz' && payloadType !== 'frequency_hz' ? d.value : null;
      let hzVal = typeof d.hz === 'number' ? d.hz : (typeof d.value === 'number' && (payloadType === 'note_hz' || payloadType === 'frequency_hz') ? d.value : null);
      let noteName = d.note_name ? String(d.note_name) : null;

      // If string note name provided (e.g. "C3", "D3", "E3", "C♯4", "E♭3")
      if (numericMidi === null && typeof d.value === 'string') {
        numericMidi = noteNameToMidi(d.value);
        if (numericMidi !== null && !noteName) {
          noteName = d.value.trim();
        }
      }
      // If frequency in Hz provided
      if (numericMidi === null && hzVal !== null && hzVal > 0) {
        numericMidi = hzToMidi(hzVal);
      }
      if (numericMidi !== null && !noteName) {
        noteName = midiToNoteName(numericMidi);
      }
      if (numericMidi !== null && hzVal === null) {
        hzVal = midiToHz(numericMidi);
      }

      const finalMidi = numericMidi ?? (typeof d.value === 'number' ? d.value : 60);
      const roundedPc = ((Math.round(finalMidi) % 12) + 12) % 12;

      return {
        ...d,
        value: finalMidi,
        midi_pitch: Math.round(finalMidi * 100) / 100,
        hz: hzVal ? Math.round(hzVal * 10) / 10 : null,
        note_name: noteName ?? midiToNoteName(finalMidi),
        pitch_class: roundedPc,
        pitch_class_name: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][roundedPc],
      };
    });

    const hasVoiced = enrichedNoteData.some(d => d.voiced !== undefined);

    // Internal transforms for unit-height centered notes:
    // Centered on datum.value: spans [datum.value - 0.5, datum.value + 0.5], unit height = 1.0 semitone!
    transforms.push(
      { calculate: 'datum.value - 0.5', as: 'y_min' },
      { calculate: 'datum.value + 0.5', as: 'y_max' },
      { calculate: `datum.${xField} + (datum.duration != null && datum.duration > 0 ? datum.duration : 0.25)`, as: '_calc_end' },
      { calculate: '((floor(datum.value) % 12) + 12) % 12', as: 'pitch_class' },
      { calculate: "['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((floor(datum.value) % 12) + 12) % 12]", as: 'pitch_class_name' }
    );

    const pitchValues = enrichedNoteData.map(d => Number(d.value)).filter(v => !isNaN(v));
    const minPitch = pitchValues.length ? Math.min(...pitchValues) : 48;
    const maxPitch = pitchValues.length ? Math.max(...pitchValues) : 84;
    const minInt = Math.floor(minPitch);
    const maxInt = Math.ceil(maxPitch);
    const span = maxInt - minInt;
    const uniquePitches = Array.from(new Set(pitchValues.map(p => Math.round(p)))).sort((a, b) => a - b);

    // Build numerical axis tick positions reflecting true musical semitone distances:
    // C3 (48), D3 (50), E3 (52) are NOT equidistant: distance(C3, D3) = 2, distance(D3, E3) = 2, distance(E3, F3) = 1!
    const tickSet = new Set<number>();
    if (span <= 28) {
      // Small range: show every semitone integer
      for (let m = minInt; m <= maxInt; m++) {
        tickSet.add(m);
      }
    } else if (span <= 52) {
      // Medium range: show all natural notes (white keys) plus active notes in piece
      for (let m = minInt; m <= maxInt; m++) {
        const pc = ((m % 12) + 12) % 12;
        if ([0, 2, 4, 5, 7, 9, 11].includes(pc)) {
          tickSet.add(m);
        }
      }
    } else {
      // Wide range: show all octave C notes plus active notes in piece
      for (let m = minInt; m <= maxInt; m++) {
        const pc = ((m % 12) + 12) % 12;
        if (pc === 0 || pc === 7) {
          tickSet.add(m);
        }
      }
    }
    // Always include any note pitches present in the piece so their categorical tick labels align exactly
    for (const p of uniquePitches) {
      tickSet.add(p);
    }
    const tickValues = Array.from(tickSet).sort((a, b) => a - b);

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
            title: payloadType === 'note_hz' ? 'Pitch (Note / Log Hz)' : 'Pitch / Note',
            scale: {
              domain: [minPitch - 1.5, maxPitch + 1.5],
              zero: false,
              padding: 4,
            },
            axis: {
              tickMinStep: 1,
              values: tickValues,
              labelExpr: "['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((round(datum.value) % 12) + 12) % 12] + (floor(round(datum.value) / 12) - 1)",
              labelFontWeight: 'bold',
              labelFontSize: 10,
              titlePadding: 14,
              labelPadding: 8,
              minExtent: 65,
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
          opacity: hasVoiced
            ? {
                condition: {
                  test: 'datum.voiced === false',
                  value: 0.25,
                },
                value: 0.95,
              }
            : hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: 'note_name', type: 'nominal', title: 'Note' },
            { field: 'pitch_class_name', type: 'nominal', title: 'Pitch Class' },
            { field: 'value', type: 'quantitative', format: '.1f', title: 'MIDI Pitch' },
            ...(payloadType === 'frequency_hz' || payloadType === 'note_hz' || enrichedNoteData.some(d => d.hz != null)
              ? [{ field: 'hz', type: 'quantitative', format: '.1f', title: 'Frequency (Hz)' }]
              : []),
            ...(hasVoiced ? [{ field: 'voiced', type: 'nominal', title: 'Voiced' }] : []),
            { field: xField, type: 'quantitative', format: isScore ? '.2f' : isMidi ? 'd' : '.2f', title: 'Start' },
            { field: 'duration', type: 'quantitative', format: isScore ? '.2f' : isMidi ? 'd' : '.2f', title: 'Duration' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.3f', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    // Overlay confidence meter along the top edge of each piano note
    if (hasConfidence && confidenceChannel === 'meter') {
      layers.push(
        ...buildEmbeddedConfidenceMeterLayers({
          xField,
          endField: '_calc_end',
          confX2Field: '_note_conf_end',
          isDark,
          trackBackingFill: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.25)',
          cornerRadius: 1,
          extraTransforms: [{ calculate: 'datum.value + 0.3', as: '_note_meter_y1' }],
          yEncoding: { field: '_note_meter_y1', type: 'quantitative' },
          y2Encoding: { field: 'y_max' },
        })
      );
    }

    if (showLabels) {
      layers.push(
        ...buildIntervalCenteredLabelLayers({
          xField,
          endField: '_calc_end',
          fallbackHalfDur: 0.125,
          minDuration: 0.15,
          minPixelWidth: 8,
          paddingPx: 2,
          yEncoding: { field: 'value', type: 'quantitative' },
          textField: 'note_name',
          fontSize: 9,
          textColor: '#000000',
          withHalo: false,
        })
      );
    }

    const cursor = makeCursorLayer(xField);
    const pianoTitle = {
      text: payloadType === 'frequency_hz' || payloadType === 'note_hz'
        ? `BOPP Frequency (Hz / Log Pitch) Piano Roll: ${annotation.media_id}`
        : payloadType === 'note'
        ? `BOPP Scientific Pitch Notation Piano Roll: ${annotation.media_id}`
        : `BOPP MIDI Piano Roll: ${annotation.media_id}`,
      subtitle: 'Numerical Pitch Axis (Semitone Spacing / Log Frequency)',
      color: textColor,
      subtitleColor: axisColor,
    };

    const overviewLayers = [
      {
        mark: { type: 'rect', opacity: 0.75, cornerRadius: 1 },
        encoding: {
          x: { field: xField, type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: {
            field: 'y_min',
            type: 'quantitative',
            scale: { domain: [minPitch - 1.5, maxPitch + 1.5], zero: false },
            axis: null,
          },
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
      data: enrichedNoteData,
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
  // 4. TIME_INTERVAL + TAG / LYRICS / MULTI_SEGMENT / SEGMENT_OPEN (Interval Spans)
  // =========================================================================
  if (
    extentType === 'time_interval' &&
    (payloadType === 'multi_segment' ||
      payloadType === 'segment_open' ||
      payloadType === 'tag_open' ||
      payloadType === 'tag' ||
      payloadType === 'lyrics')
  ) {
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
    const yTitle = isMulti
      ? 'Structural Level'
      : useSingleRow
      ? intervalAnalysis.singleRowLabel
      : payloadType === 'tag_open' || payloadType === 'tag'
      ? 'Tags / Labels'
      : payloadType === 'lyrics'
      ? 'Lyrics'
      : 'Section';
    const colorField = isMulti ? 'label' : 'value';
    const uniqueLabels = Array.from(new Set(data.map(d => String(d[colorField] ?? d.value ?? '')))).filter(Boolean);
    const colorScale = resolveColorScale(colorScheme, payloadType, uniqueLabels);

    const levels = isMulti
      ? Array.from(new Set(data.map(d => Number(d.level)).filter(l => !isNaN(l)))).sort((a, b) => a - b)
      : [];

    transforms.push({
      calculate: 'datum.time + (datum.duration != null ? datum.duration : 0)',
      as: '_calc_end',
    });

    const layers: Record<string, unknown>[] = [
      {
        mark: {
          type: 'rect',
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 1.5,
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
            scale: isMulti ? { domain: levels } : !useSingleRow ? { domain: uniqueLabels } : undefined,
            axis: {
              ...(useSingleRow ? { labels: false, ticks: false } : { labelFontWeight: 'bold', labelPadding: 8 }),
              titlePadding: 14,
              minExtent: 75,
            },
          },
          color: { field: colorField, type: 'nominal', title: payloadType === 'tag_open' ? 'Tag' : 'Segment', scale: colorScale },
          opacity: hasConfidence && confidenceChannel === 'opacity'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] } }
            : { value: 1.0 },
          tooltip: [
            { field: colorField, type: 'nominal', title: payloadType === 'tag_open' ? 'Tag' : 'Section' },
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

    // Centered single crisp text label inside patch (NO redundant text layers)
    if (showLabels) {
      transforms.push({
        calculate: 'datum.time + (datum.duration != null ? datum.duration / 2 : 0)',
        as: '_label_midpoint',
      });
      layers.push({
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fill: '#ffffff',
          fontWeight: 'bold',
          fontSize: 11,
          clip: true,
          limit: { expr: "max(0.001, (scale('concat_0_x', datum._calc_end) != null ? scale('concat_0_x', datum._calc_end) : scale('x', datum._calc_end)) - (scale('concat_0_x', datum.time) != null ? scale('concat_0_x', datum.time) : scale('x', datum.time)) - 4)" },
        },
        encoding: {
          x: { field: '_label_midpoint', type: 'quantitative' },
          y: { field: yField, type: yType, scale: isMulti ? { domain: levels } : !useSingleRow ? { domain: uniqueLabels } : undefined },
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

    // Confidence meter: pinned strictly along the top edge of each segment patch
    if (useSingleRow && hasConfidence && confidenceChannel !== 'none') {
      layers.push(...buildIntervalConfidenceLayers({
        xField: 'time',
        endField: '_calc_end',
        durField: 'duration',
        chartHeight,
        isDark,
        confidenceType: confidenceType as any,
        channelMode: confidenceChannel,
        yTop: 4,
        yBottom: chartHeight - 74,
        meterHeight: 4,
        showTextLabels: false,
      }));
    } else if (!useSingleRow && hasConfidence && confidenceChannel === 'meter') {
      layers.push(
        // Backing track (unified MIDI note style)
        {
          transform: [{ filter: 'datum.confidence != null' }],
          mark: {
            type: 'rect',
            height: 3,
            fill: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.25)',
            stroke: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)',
            strokeWidth: 0.5,
            cornerRadius: 1,
          },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_calc_end' },
            y: { field: yField, type: yType, scale: isMulti ? { domain: levels } : { domain: uniqueLabels } },
            yOffset: { value: 2.5 },
          },
        },
        // Active confidence fill (unified MIDI note style)
        {
          transform: [
            { filter: 'datum.confidence != null && datum.confidence > 0' },
            { calculate: 'datum.time + (datum.duration != null ? datum.duration * datum.confidence : 0)', as: '_seg_conf_end' },
          ],
          mark: {
            type: 'rect',
            height: 3,
            cornerRadius: 1,
            stroke: isDark ? '#ffffff' : '#09090b',
            strokeWidth: 0.5,
          },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            x2: { field: '_seg_conf_end' },
            y: { field: yField, type: yType, scale: isMulti ? { domain: levels } : { domain: uniqueLabels } },
            yOffset: { value: 2.5 },
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

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const segTitle = { text: `BOPP Structural Analysis: ${annotation.media_id}`, color: textColor };
    const segOverviewLayers = [
      {
        mark: { type: useSingleRow ? 'rect' : 'bar', opacity: 0.85, cornerRadius: 2 },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          x2: { field: '_calc_end' },
          y: isMulti
            ? { field: 'level', type: 'ordinal', scale: { domain: levels }, axis: null }
            : useSingleRow
            ? { value: 2 }
            : { field: 'value', type: 'nominal', scale: { domain: uniqueLabels }, axis: null },
          ...(useSingleRow ? { y2: { value: 50 } } : {}),
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
        ...buildEmbeddedConfidenceMeterLayers({
          xField: 'time',
          endField: '_calc_end',
          confX2Field: '_tf_conf_end',
          isDark,
          trackBackingFill: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.25)',
          cornerRadius: 1,
          extraTransforms: [
            { calculate: 'datum.freq_max - max(80, (datum.freq_max - datum.freq_min) * 0.08)', as: '_tf_meter_bottom' },
          ],
          yEncoding: { field: '_tf_meter_bottom', type: 'quantitative' },
          y2Encoding: { field: 'freq_max' },
        })
      );
    }

    if (showLabels) {
      layers.push(
        ...buildBoundingBoxCornerLabelLayers({
          xField: 'time',
          yField: 'freq_max',
          labelField: '_tf_label',
          hasConfidence,
        })
      );
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
    const boxLayers: Record<string, unknown>[] = [
      {
        transform: [
          { calculate: 'datum.x + datum.width', as: 'x2' },
          { calculate: 'datum.y + datum.height', as: 'y2' },
        ],
        mark: {
          type: 'rect',
          fillOpacity: hasConfidence && confidenceChannel === 'opacity'
            ? undefined
            : isDark ? 0.35 : 0.25,
          strokeWidth: 2,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'x', type: 'quantitative', title: 'X (pixels)' },
          x2: { field: 'x2' },
          // Invert Y axis for image coordinates standard (top-left 0,0)
          y: { field: 'y', type: 'quantitative', title: 'Y (pixels)', scale: { reverse: true } },
          y2: { field: 'y2' },
          color: { field: 'value', type: 'nominal', title: 'Object Class', scale: colorScale },
          stroke: { field: 'value', type: 'nominal', scale: colorScale },
          ...(hasConfidence && confidenceChannel === 'opacity' ? {
            opacity: { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] }, title: 'Confidence' }
          } : {}),
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Object' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
            { field: 'x', type: 'quantitative', title: 'X' },
            { field: 'y', type: 'quantitative', title: 'Y' },
            { field: 'width', type: 'quantitative', title: 'Width' },
            { field: 'height', type: 'quantitative', title: 'Height' },
          ],
        },
      },
    ];

    // Top-edge confidence meter for pixel bounding boxes
    if (hasConfidence && confidenceChannel !== 'none') {
      boxLayers.push(
        ...buildEmbeddedConfidenceMeterLayers({
          xField: 'x',
          endField: 'x2',
          confX2Field: '_pixel_conf_end',
          isDark,
          trackBackingFill: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.75)',
          cornerRadius: 1,
          extraTransforms: [
            { calculate: 'datum.x + datum.width', as: 'x2' },
            { calculate: 'datum.y + max(4, min(10, datum.height * 0.15))', as: '_pixel_meter_bottom' },
          ],
          yEncoding: { field: 'y', type: 'quantitative', scale: { reverse: true } },
          y2Encoding: { field: '_pixel_meter_bottom' },
        })
      );
    }

    if (showLabels) {
      boxLayers.push(
        ...buildBoundingBoxCornerLabelLayers({
          xField: 'x',
          yField: 'y',
          yScale: { reverse: true },
          labelField: '_box_label',
          hasConfidence,
        })
      );
    }

    return {
      $schema: VEGA_LITE_SCHEMA,
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP Pixel Bounding Boxes: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: boxLayers,
    };
  }

  // =========================================================================
  // 6b. PIXEL (2D Point Coordinates in Pixel Space)
  // =========================================================================
  if (extentType === 'pixel') {
    const colorScale = resolveColorScale(colorScheme, payloadType);
    const pixelLayers: Record<string, unknown>[] = [
      // Optional faint connecting trajectory line if sequential
      {
        mark: {
          type: 'line',
          strokeDash: [4, 4],
          opacity: 0.45,
          stroke: isDark ? '#94a3b8' : '#64748b',
          strokeWidth: 1.5,
        },
        encoding: {
          x: { field: 'x', type: 'quantitative', title: 'X (pixels)' },
          y: { field: 'y', type: 'quantitative', title: 'Y (pixels)', scale: { reverse: true } },
          order: { field: '__index', type: 'quantitative' },
        },
      },
      // 2D Pixel point markers
      {
        mark: {
          type: 'circle',
          size: 110,
          stroke: isDark ? '#ffffff' : '#0f172a',
          strokeWidth: 1.5,
          opacity: 0.9,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'x', type: 'quantitative', title: 'X (pixels)' },
          y: { field: 'y', type: 'quantitative', title: 'Y (pixels)', scale: { reverse: true } },
          color: { field: 'value', type: 'nominal', title: 'Label / Class', scale: colorScale },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Observation' },
            { field: 'x', type: 'quantitative', title: 'X' },
            { field: 'y', type: 'quantitative', title: 'Y' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
          ],
        },
      },
    ];

    if (showLabels) {
      pixelLayers.push({
        mark: {
          type: 'text',
          align: 'left',
          baseline: 'bottom',
          dx: 8,
          dy: -6,
          fontSize: 10,
          fontWeight: 'bold',
          color: textColor,
        },
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative', scale: { reverse: true } },
          text: { field: 'value', type: 'nominal' },
        },
      });
    }

    return {
      $schema: VEGA_LITE_SCHEMA,
      width: chartWidth,
      height: chartHeight,
      title: { text: `BOPP 2D Pixel Coordinates: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      layer: pixelLayers,
    };
  }

  // =========================================================================
  // 6c. TEXT & TEXT_INTERVAL (Character Offset Highlighting & Spans)
  // =========================================================================
  if (extentType === 'text' || extentType === 'text_interval') {
    const isInterval = extentType === 'text_interval';
    const colorScale = resolveColorScale(colorScheme, payloadType);
    const textTransforms = [...transforms];

    const maxOffset = Math.max(
      ...data.map(d => Number(d._offset_end) || (Number(d.offset) || 0) + (Number(d.length) || 1)),
      10
    );

    const textLayers: Record<string, unknown>[] = [];

    if (isInterval) {
      const maxLane = Math.max(...data.map(d => Number(d._lane) || 0), 0);
      const numLanes = maxLane + 1;
      const textPlotHeight = Math.max(160, numLanes * 50 + 80);

      // Horizontal interval span pill
      textLayers.push({
        mark: {
          type: 'rect',
          cornerRadius: 4,
          stroke: isDark ? '#38bdf8' : '#0284c7',
          strokeWidth: 1.5,
          opacity: 0.85,
        },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: {
            field: 'offset',
            type: 'quantitative',
            title: 'Document Character Offset',
            scale: { domain: [0, maxOffset + 2], zero: true },
          },
          x2: { field: '_offset_end' },
          y: {
            field: '_lane',
            type: 'ordinal',
            title: null,
            axis: null,
          },
          color: { field: 'value', type: 'nominal', title: 'Category', scale: colorScale },
          tooltip: [
            { field: 'value', type: 'nominal', title: 'Text Span' },
            { field: 'offset', type: 'quantitative', title: 'Start Offset' },
            { field: '_offset_end', type: 'quantitative', title: 'End Offset' },
            { field: 'length', type: 'quantitative', title: 'Length (chars)' },
            ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
          ],
        },
      });

      // Centered text label inside the pill (uses _mid_offset without invalid x2)
      textLayers.push({
        mark: {
          type: 'text',
          align: 'center',
          baseline: 'middle',
          fontSize: 11,
          fontWeight: 'bold',
          fill: isDark ? '#ffffff' : '#0f172a',
        },
        encoding: {
          x: { field: '_mid_offset', type: 'quantitative' },
          y: { field: '_lane', type: 'ordinal', title: null, axis: null },
          text: { field: 'value', type: 'nominal' },
        },
      });

      return {
        $schema: VEGA_LITE_SCHEMA,
        width: chartWidth,
        height: textPlotHeight,
        title: { text: `BOPP Text Spans & Offsets: ${annotation.media_id}`, color: textColor },
        data: { values: data },
        transform: textTransforms,
        config: baseConfig,
        layer: textLayers,
      };
    } else {
      // Point / tick markers at character offset with pin caret and label
      textLayers.push(
        // Vertical pin stem
        {
          mark: {
            type: 'rule',
            strokeWidth: 2,
            stroke: isDark ? '#38bdf8' : '#0284c7',
          },
          ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
          encoding: {
            x: {
              field: 'offset',
              type: 'quantitative',
              title: 'Document Character Offset',
              scale: { domain: [0, maxOffset + 2], zero: true },
            },
            y: { datum: 15 },
            y2: { datum: 65 },
            tooltip: [
              { field: 'value', type: 'nominal', title: 'Token Label' },
              { field: 'offset', type: 'quantitative', title: 'Char Offset' },
              ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
            ],
          },
        },
        // Pin head marker
        {
          mark: {
            type: 'point',
            shape: 'triangle-down',
            size: 110,
            filled: true,
            color: isDark ? '#38bdf8' : '#0284c7',
          },
          encoding: {
            x: { field: 'offset', type: 'quantitative' },
            y: { datum: 65 },
          },
        },
        // Token label badge above the pin
        {
          mark: {
            type: 'text',
            align: 'center',
            baseline: 'bottom',
            dy: -6,
            fontSize: 10,
            fontWeight: 'bold',
            fill: textColor,
          },
          encoding: {
            x: { field: 'offset', type: 'quantitative' },
            y: { datum: 15 },
            text: { field: 'value', type: 'nominal' },
          },
        }
      );

      return {
        $schema: VEGA_LITE_SCHEMA,
        width: chartWidth,
        height: 180,
        title: { text: `BOPP Token Offsets & Boundaries: ${annotation.media_id}`, color: textColor },
        data: { values: data },
        transform: textTransforms,
        config: baseConfig,
        layer: textLayers,
      };
    }
  }

  // =========================================================================
  // 6d. SPHERICAL, SPHERICAL_TIME, SPHERICAL_TIME_INTERVAL (Polar Coordinates & DoA vs Time)
  // =========================================================================
  if (extentType === 'spherical' || extentType === 'spherical_time' || extentType === 'spherical_time_interval') {
    const isTemporal = extentType === 'spherical_time' || extentType === 'spherical_time_interval';
    const totalWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : 760;
    const totalHeight = typeof chartHeight === 'number' && chartHeight > 0 ? chartHeight : 340;
    const panelWidth = Math.max(300, Math.floor((totalWidth - 60) / 2));
    const panelHeight = Math.max(300, totalHeight - 40);

    const maxR = Math.max(...data.map(d => Number(d.radius) || 1), 1);
    const rLimit = +(maxR * 1.2).toFixed(2);
    const rStep = +(rLimit / 3).toFixed(2);
    const ringRadii = [rStep, +(rStep * 2).toFixed(2), rLimit];

    // Background polar grid range rings
    const ringPoints: { ring: number; x: number; y: number; order: number }[] = [];
    for (const r of ringRadii) {
      for (let a = 0; a <= 360; a += 10) {
        const rad = (a * Math.PI) / 180;
        ringPoints.push({
          ring: r,
          x: +(r * Math.sin(rad)).toFixed(3),
          y: +(r * Math.cos(rad)).toFixed(3),
          order: a,
        });
      }
    }

    // Background polar radial spokes
    const spokePoints: { spoke: number; x: number; y: number; order: number }[] = [];
    for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (a * Math.PI) / 180;
      spokePoints.push({ spoke: a, x: 0, y: 0, order: 0 });
      spokePoints.push({ spoke: a, x: +(rLimit * Math.sin(rad)).toFixed(3), y: +(rLimit * Math.cos(rad)).toFixed(3), order: 1 });
    }

    // Outer compass direction labels
    const compassLabels: { text: string; x: number; y: number }[] = [
      { text: '0° (Front)', x: 0, y: rLimit + 0.15 },
      { text: '+45°', x: +(rLimit * 0.707 * 1.08).toFixed(2), y: +(rLimit * 0.707 * 1.08).toFixed(2) },
      { text: '+90° (Right)', x: rLimit + 0.15, y: 0 },
      { text: '+135°', x: +(rLimit * 0.707 * 1.08).toFixed(2), y: +(-rLimit * 0.707 * 1.08).toFixed(2) },
      { text: '180° (Back)', x: 0, y: -(rLimit + 0.15) },
      { text: '-135°', x: +(-rLimit * 0.707 * 1.08).toFixed(2), y: +(-rLimit * 0.707 * 1.08).toFixed(2) },
      { text: '-90° (Left)', x: -(rLimit + 0.15), y: 0 },
      { text: '-45°', x: +(-rLimit * 0.707 * 1.08).toFixed(2), y: +(rLimit * 0.707 * 1.08).toFixed(2) },
    ];

    const sphericalTransforms = [
      ...transforms,
      {
        calculate: 'datum.radius * sin(datum.azimuth * PI / 180)',
        as: '_x_polar',
      },
      {
        calculate: 'datum.radius * cos(datum.azimuth * PI / 180)',
        as: '_y_polar',
      },
    ];

    const hoverConditions = (activeVal: any, defaultVal: any) => ({
      condition: [
        { param: 'obs_hover_sph_1', empty: false, value: activeVal },
        { param: 'obs_hover_sph_2', empty: false, value: activeVal },
      ],
      value: defaultVal,
    });

    const sharedPointEncoding = {
      size: hoverConditions(220, 85),
      opacity: hoverConditions(1.0, 0.8),
      stroke: { value: isDark ? '#ffffff' : '#0f172a' },
      strokeWidth: hoverConditions(2.5, 1.2),
      tooltip: [
        { field: 'value', type: 'nominal', title: 'Observation' },
        { field: 'azimuth', type: 'quantitative', format: '.1f', title: 'Azimuth θ (°)' },
        { field: 'elevation', type: 'quantitative', format: '.1f', title: 'Elevation φ (°)' },
        { field: 'radius', type: 'quantitative', format: '.2f', title: 'Radius r (meters)' },
        ...(isTemporal ? [{ field: 'time', type: 'quantitative', format: '.2f', title: 'Time (s)' }] : []),
        ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
      ],
    };

    // Panel 1: Traditional Polar Soundfield Map
    const polarPanel: Record<string, unknown> = {
      title: { text: 'Polar Soundfield Plan (Azimuth θ & Radius r)', color: textColor, fontSize: 12 },
      width: panelWidth,
      height: panelHeight,
      layer: [
        // Concentric range rings
        {
          data: { values: ringPoints },
          mark: { type: 'line', strokeDash: [3, 3], stroke: isDark ? '#64748b' : '#94a3b8', opacity: 0.35 },
          encoding: {
            x: {
              field: 'x',
              type: 'quantitative',
              title: 'Lateral Distance (meters: r · sin θ)',
              scale: { domain: [-rLimit * 1.3, rLimit * 1.3] },
            },
            y: {
              field: 'y',
              type: 'quantitative',
              title: 'Frontal Distance (meters: r · cos θ)',
              scale: { domain: [-rLimit * 1.3, rLimit * 1.3] },
            },
            detail: { field: 'ring', type: 'nominal' },
            order: { field: 'order', type: 'quantitative' },
          },
        },
        // Radial compass spokes
        {
          data: { values: spokePoints },
          mark: { type: 'line', strokeDash: [2, 2], stroke: isDark ? '#64748b' : '#94a3b8', opacity: 0.25 },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            detail: { field: 'spoke', type: 'nominal' },
            order: { field: 'order', type: 'quantitative' },
          },
        },
        // Compass perimeter direction labels
        {
          data: { values: compassLabels },
          mark: { type: 'text', fontSize: 10, fontWeight: 'bold', fill: isDark ? '#94a3b8' : '#64748b', align: 'center', baseline: 'middle' },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
            text: { field: 'text', type: 'nominal' },
          },
        },
        // Sound source trajectory path in polar space
        {
          mark: { type: 'line', interpolate: 'monotone', strokeWidth: 2, opacity: 0.6, stroke: isDark ? '#38bdf8' : '#0284c7' },
          encoding: {
            x: { field: '_x_polar', type: 'quantitative' },
            y: { field: '_y_polar', type: 'quantitative' },
            order: { field: '__index', type: 'quantitative' },
          },
        },
        // Observation points colored by Elevation φ (Altitude)
        {
          params: [
            { name: 'obs_hover_sph_1', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
          ],
          mark: { type: 'circle' },
          encoding: {
            x: { field: '_x_polar', type: 'quantitative' },
            y: { field: '_y_polar', type: 'quantitative' },
            color: {
              field: 'elevation',
              type: 'quantitative',
              title: 'Elevation φ (°)',
              scale: { domain: [-90, 90], scheme: 'spectral' },
            },
            ...sharedPointEncoding,
          },
        },
      ],
    };

    // Panel 2: Direction of Arrival Angles vs Time (or DoA Map)
    let panel2: Record<string, unknown>;
    if (isTemporal) {
      panel2 = {
        title: { text: 'Direction of Arrival (DoA) & Elevation vs Time', color: textColor, fontSize: 12 },
        width: panelWidth,
        height: panelHeight,
        layer: [
          // Horizon reference line at 0 degrees
          {
            mark: { type: 'rule', strokeDash: [4, 4], stroke: isDark ? '#64748b' : '#94a3b8', opacity: 0.45 },
            encoding: { y: { datum: 0 } },
          },
          // Multi-line trajectory for Azimuth and Elevation
          {
            transform: [
              { fold: ['azimuth', 'elevation'], as: ['angle_type', 'angle_deg'] },
            ],
            mark: { type: 'line', strokeWidth: 2.2, interpolate: 'monotone' },
            encoding: {
              x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
              y: { field: 'angle_deg', type: 'quantitative', title: 'Angle (degrees [°])', scale: { domain: [-185, 185] } },
              color: {
                field: 'angle_type',
                type: 'nominal',
                title: 'Direction',
                scale: { domain: ['azimuth', 'elevation'], range: ['#38bdf8', '#f59e0b'] },
              },
            },
          },
          // Linked observation points
          {
            params: [
              { name: 'obs_hover_sph_2', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
            ],
            mark: { type: 'circle' },
            encoding: {
              x: { field: 'time', type: 'quantitative' },
              y: { field: 'azimuth', type: 'quantitative' },
              color: { value: '#38bdf8' },
              ...sharedPointEncoding,
            },
          },
        ],
      };
    } else {
      panel2 = {
        title: { text: 'Direction of Arrival Map (Azimuth vs Elevation)', color: textColor, fontSize: 12 },
        width: panelWidth,
        height: panelHeight,
        layer: [
          {
            mark: { type: 'rule', strokeDash: [4, 4], stroke: isDark ? '#64748b' : '#94a3b8', opacity: 0.45 },
            encoding: { y: { datum: 0 } },
          },
          {
            mark: { type: 'line', interpolate: 'monotone', strokeWidth: 1.5, opacity: 0.45, stroke: isDark ? '#38bdf8' : '#0284c7' },
            encoding: {
              x: { field: 'azimuth', type: 'quantitative', title: 'Azimuth θ (degrees [-180°, +180°))', scale: { domain: [-180, 180] } },
              y: { field: 'elevation', type: 'quantitative', title: 'Elevation φ (degrees [-90°, +90°])', scale: { domain: [-90, 90] } },
              order: { field: '__index', type: 'quantitative' },
            },
          },
          {
            params: [
              { name: 'obs_hover_sph_2', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
            ],
            mark: { type: 'circle' },
            encoding: {
              x: { field: 'azimuth', type: 'quantitative', title: 'Azimuth θ (degrees [-180°, +180°))', scale: { domain: [-180, 180] } },
              y: { field: 'elevation', type: 'quantitative', title: 'Elevation φ (degrees [-90°, +90°])', scale: { domain: [-90, 90] } },
              color: { field: 'radius', type: 'quantitative', title: 'Radius r (m)', scale: { scheme: 'viridis' } },
              ...sharedPointEncoding,
            },
          },
        ],
      };
    }

    return {
      $schema: VEGA_LITE_SCHEMA,
      title: { text: `BOPP Spherical Polar Coordinates: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: sphericalTransforms,
      config: baseConfig,
      hconcat: [polarPanel, panel2],
    };
  }

  // =========================================================================
  // 6e. CARTESIAN, CARTESIAN_TIME, CARTESIAN_TIME_INTERVAL (Planar Trajectory & Time Profile)
  // =========================================================================
  if (extentType === 'cartesian' || extentType === 'cartesian_time' || extentType === 'cartesian_time_interval') {
    const isTemporal = extentType === 'cartesian_time' || extentType === 'cartesian_time_interval';
    const totalWidth = typeof chartWidth === 'number' && chartWidth > 0 ? chartWidth : 760;
    const totalHeight = typeof chartHeight === 'number' && chartHeight > 0 ? chartHeight : 340;
    const panelWidth = Math.max(300, Math.floor((totalWidth - 60) / 2));
    const panelHeight = Math.max(300, totalHeight - 40);

    const hoverConditions = (activeVal: any, defaultVal: any) => ({
      condition: [
        { param: 'obs_hover_cart_1', empty: false, value: activeVal },
        { param: 'obs_hover_cart_2', empty: false, value: activeVal },
      ],
      value: defaultVal,
    });

    const sharedPointEncoding = {
      size: hoverConditions(220, 85),
      opacity: hoverConditions(1.0, 0.8),
      stroke: { value: isDark ? '#ffffff' : '#0f172a' },
      strokeWidth: hoverConditions(2.5, 1.2),
      tooltip: [
        { field: 'value', type: 'nominal', title: 'Observation' },
        { field: 'x', type: 'quantitative', format: '.2f', title: 'Lateral Position X (m)' },
        { field: 'y', type: 'quantitative', format: '.2f', title: 'Forward Position Y (m)' },
        { field: 'z', type: 'quantitative', format: '.2f', title: 'Vertical Height Z (m)' },
        ...(isTemporal ? [{ field: 'time', type: 'quantitative', format: '.2f', title: 'Time (s)' }] : []),
        ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
      ],
    };

    // Panel 1: Planar Trajectory Map (X vs Y colored by Z)
    const mapPanel: Record<string, unknown> = {
      title: { text: 'Spatial Trajectory (X vs Y Plane)', color: textColor, fontSize: 12 },
      width: panelWidth,
      height: panelHeight,
      layer: [
        {
          mark: { type: 'line', interpolate: 'monotone', strokeWidth: 2, opacity: 0.5, stroke: isDark ? '#94a3b8' : '#64748b' },
          encoding: {
            x: { field: 'x', type: 'quantitative', title: 'Lateral Position X (meters)' },
            y: { field: 'y', type: 'quantitative', title: 'Forward Position Y (meters)' },
            order: { field: '__index', type: 'quantitative' },
          },
        },
        {
          params: [
            { name: 'obs_hover_cart_1', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
          ],
          mark: { type: 'circle' },
          encoding: {
            x: { field: 'x', type: 'quantitative', title: 'Lateral Position X (meters)' },
            y: { field: 'y', type: 'quantitative', title: 'Forward Position Y (meters)' },
            color: { field: 'z', type: 'quantitative', title: 'Vertical Height Z (meters)', scale: { scheme: 'turbo' } },
            ...sharedPointEncoding,
          },
        },
      ],
    };

    let panel2: Record<string, unknown>;
    if (isTemporal) {
      // Panel 2: 3D Coordinate Trajectories vs Time (X(t), Y(t), Z(t))
      panel2 = {
        title: { text: '3D Coordinates vs Time (X, Y, Z)', color: textColor, fontSize: 12 },
        width: panelWidth,
        height: panelHeight,
        layer: [
          {
            mark: { type: 'rule', strokeDash: [4, 4], stroke: isDark ? '#64748b' : '#94a3b8', opacity: 0.4 },
            encoding: { y: { datum: 0 } },
          },
          {
            transform: [
              { fold: ['x', 'y', 'z'], as: ['coord', 'pos'] },
            ],
            mark: { type: 'line', strokeWidth: 2.2, interpolate: 'monotone' },
            encoding: {
              x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
              y: { field: 'pos', type: 'quantitative', title: 'Position (meters)' },
              color: {
                field: 'coord',
                type: 'nominal',
                title: 'Coordinate',
                scale: { domain: ['x', 'y', 'z'], range: ['#06b6d4', '#f59e0b', '#10b981'] },
              },
            },
          },
          {
            params: [
              { name: 'obs_hover_cart_2', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
            ],
            mark: { type: 'circle' },
            encoding: {
              x: { field: 'time', type: 'quantitative' },
              y: { field: 'x', type: 'quantitative' },
              color: { value: '#06b6d4' },
              ...sharedPointEncoding,
            },
          },
        ],
      };
    } else {
      // Panel 2: Front View (XZ Plane)
      panel2 = {
        title: { text: 'Front View (XZ Plane)', color: textColor, fontSize: 12 },
        width: panelWidth,
        height: panelHeight,
        layer: [
          {
            mark: { type: 'line', interpolate: 'monotone', strokeWidth: 1.5, opacity: 0.45, stroke: isDark ? '#94a3b8' : '#64748b' },
            encoding: {
              x: { field: 'x', type: 'quantitative', title: 'Lateral Position X (meters)' },
              y: { field: 'z', type: 'quantitative', title: 'Vertical Height Z (meters)' },
              order: { field: '__index', type: 'quantitative' },
            },
          },
          {
            params: [
              { name: 'obs_hover_cart_2', select: { type: 'point', on: 'pointerover', fields: ['__index'], clear: 'pointerout' } },
            ],
            mark: { type: 'circle' },
            encoding: {
              x: { field: 'x', type: 'quantitative', title: 'Lateral Position X (meters)' },
              y: { field: 'z', type: 'quantitative', title: 'Vertical Height Z (meters)' },
              color: { field: 'y', type: 'quantitative', title: 'Forward Position Y (meters)', scale: { scheme: 'turbo' } },
              ...sharedPointEncoding,
            },
          },
        ],
      };
    }

    return {
      $schema: VEGA_LITE_SCHEMA,
      title: { text: `BOPP 3D Cartesian Coordinates: ${annotation.media_id}`, color: textColor },
      data: { values: data },
      transform: transforms,
      config: baseConfig,
      hconcat: [mapPanel, panel2],
    };
  }

  // =========================================================================
  // 7. TIME / TIME_UNIFORM / TIME_INTERVAL + FREQUENCY_HZ (Frequency in Hz)
  // =========================================================================
  if (
    (extentType === 'time' || extentType === 'time_uniform' || extentType === 'time_interval') &&
    (payloadType === 'pitch_contour' || payloadType === 'frequency_hz')
  ) {
    const isInterval = extentType === 'time_interval';
    const layers: Record<string, unknown>[] = [];
    const freqValues = data.map(d => Number(d.hz ?? d.frequency ?? d.value)).filter(f => !isNaN(f) && f > 0);
    const minFreq = freqValues.length ? Math.min(...freqValues) : 100;
    const maxFreq = freqValues.length ? Math.max(...freqValues) : 1000;
    const freqPad = Math.max(15, (maxFreq - minFreq) * 0.1);

    transforms.push(
      {
        calculate: 'datum.hz != null ? datum.hz : (datum.frequency != null ? datum.frequency : datum.value)',
        as: 'hz',
      },
      {
        calculate: "datum.voiced === false || datum.voicing === 0 ? false : true",
        as: 'voiced',
      }
    );

    if (isInterval) {
      transforms.push({
        calculate: 'datum.time + (datum.duration != null ? datum.duration : 0)',
        as: '_calc_end',
      });

      // Horizontal frequency tone intervals at y = hz
      layers.push(
        {
          mark: {
            type: 'rule',
            strokeWidth: 4.5,
            strokeCap: 'round',
            color: isDark ? '#38bdf8' : '#0284c7',
          },
          ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
          encoding: {
            x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
            x2: { field: '_calc_end' },
            y: {
              field: 'hz',
              type: 'quantitative',
              title: 'Frequency (Hz)',
              scale: { domain: [Math.max(20, minFreq - freqPad), maxFreq + freqPad], zero: false },
            },
            tooltip: [
              { field: 'hz', type: 'quantitative', format: '.2f', title: 'Frequency (Hz)' },
              { field: 'time', type: 'quantitative', format: '.2f', title: 'Start (s)' },
              { field: 'duration', type: 'quantitative', format: '.2f', title: 'Duration (s)' },
              { field: 'voiced', type: 'nominal', title: 'Voiced' },
              ...(hasConfidence ? [{ field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' }] : []),
            ],
          },
        },
        // Frequency start indicator
        {
          mark: { type: 'circle', size: 65, color: isDark ? '#38bdf8' : '#0284c7' },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            y: { field: 'hz', type: 'quantitative' },
          },
        },
        // Frequency in Hz text badge
        {
          transform: [
            { calculate: "datum.hz + ' Hz'", as: '_hz_label' },
          ],
          mark: {
            type: 'text',
            align: 'left',
            dx: 8,
            dy: -8,
            fontSize: 10.5,
            fontWeight: 'bold',
            fill: textFill,
            font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          encoding: {
            x: { field: 'time', type: 'quantitative' },
            y: { field: 'hz', type: 'quantitative' },
            text: { field: '_hz_label', type: 'nominal' },
          },
        }
      );
    } else {
      // Continuous / dynamic grid frequency sweep or point track
      // If likelihood confidence is present, add shaded activation likelihood baseline ribbon
      if (hasConfidence && confidenceType === 'likelihood' && confidenceChannel !== 'none') {
        layers.push({
          transform: [
            { filter: 'datum.confidence != null' },
            { calculate: `${minFreq - freqPad}`, as: '_base_freq' },
            { calculate: `${minFreq - freqPad} + (${maxFreq - minFreq + 2 * freqPad}) * 0.18 * datum.confidence`, as: '_conf_freq_top' },
          ],
          mark: {
            type: 'area',
            opacity: isDark ? 0.32 : 0.22,
            color: isDark ? '#38bdf8' : '#0284c7',
          },
          encoding: {
            x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
            y: { field: '_base_freq', type: 'quantitative', scale: { domain: [Math.max(20, minFreq - freqPad), maxFreq + freqPad], zero: false } },
            y2: { field: '_conf_freq_top', type: 'quantitative' },
          },
        });
      }

      // If variance confidence is present, add shaded 95% Confidence Interval error ribbon (±1.96σ)
      if (hasConfidence && confidenceType === 'variance' && confidenceChannel !== 'none') {
        layers.push({
          transform: [
            { filter: 'datum.value_ci_lower != null && datum.value_ci_upper != null' },
          ],
          mark: {
            type: 'area',
            opacity: isDark ? 0.25 : 0.18,
            color: isDark ? '#38bdf8' : '#0284c7',
          },
          encoding: {
            x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
            y: { field: 'value_ci_lower', type: 'quantitative', title: 'Frequency (Hz)', scale: { zero: false } },
            y2: { field: 'value_ci_upper' },
          },
        });

        layers.push(...buildVarianceErrorBarLayers({
          xField: 'time',
          yField: 'hz',
          lowerField: 'value_ci_lower',
          upperField: 'value_ci_upper',
          isDark,
          capWidth: 8,
          whiskerColor: isDark ? '#7dd3fc' : '#0284c7',
        }));
      }

      // Trajectory smooth guide line in Hz
      layers.push({
        mark: {
          type: 'line',
          strokeWidth: 2.2,
          stroke: isDark ? '#38bdf8' : '#0284c7',
          interpolate: 'monotone',
        },
        encoding: {
          x: { field: 'time', type: 'quantitative', scale: { domain: [minX, maxX] } },
          y: { field: 'hz', type: 'quantitative', title: 'Frequency (Hz)', scale: { domain: [Math.max(20, minFreq - freqPad), maxFreq + freqPad], zero: false } },
        },
      });

      // Sample points colored by voiced state and modulated by likelihood confidence
      layers.push({
        mark: { type: 'point', filled: true },
        ...(makeZoomParam().length ? { params: makeZoomParam() } : {}),
        encoding: {
          x: { field: 'time', type: 'quantitative', title: 'Time (seconds)', scale: { domain: [minX, maxX] } },
          y: {
            field: 'hz',
            type: 'quantitative',
            title: 'Frequency (Hz)',
            scale: { domain: [Math.max(20, minFreq - freqPad), maxFreq + freqPad], zero: false },
          },
          color: {
            field: 'voiced',
            type: 'nominal',
            scale: { domain: [true, false], range: [isDark ? '#38bdf8' : '#0284c7', isDark ? '#64748b' : '#94a3b8'] },
            legend: {
              title: 'Voicing',
              labelExpr: "datum.value === true || datum.value === 'true' ? 'Voiced' : 'Unvoiced'",
            },
          },
          opacity: {
            condition: { test: "datum.voiced === false || datum.voiced === 'false'", value: 0.35 },
            ...(hasConfidence && confidenceType === 'likelihood'
              ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [0.35, 1.0] }, title: 'Likelihood' }
              : { value: 1.0 }),
          },
          size: hasConfidence && confidenceType === 'likelihood'
            ? { field: 'confidence', type: 'quantitative', scale: { domain: [0, 1], range: [35, 90] }, legend: null }
            : { value: 65 },
          tooltip: [
            { field: 'time', type: 'quantitative', format: '.3f', title: 'Time (s)' },
            { field: 'hz', type: 'quantitative', format: '.2f', title: 'Frequency (Hz)' },
            { field: 'voiced', type: 'nominal', title: 'Voiced' },
            ...(hasConfidence && confidenceType === 'likelihood' ? [
              { field: 'confidence', type: 'quantitative', format: '.1%', title: 'Model Likelihood' },
            ] : []),
            ...(hasConfidence && confidenceType === 'variance' ? [
              { field: 'confidence_variance', type: 'quantitative', format: '.2f', title: 'Variance (σ²)' },
              { field: 'confidence_std', type: 'quantitative', format: '.2f', title: 'Std Dev (σ Hz)' },
            ] : []),
          ],
        },
      });
    }

    const cursor = makeCursorLayer('time');
    if (cursor) layers.push(cursor);

    const contourTitle = {
      text: isInterval
        ? `BOPP Frequency Tone Segments (Hz): ${annotation.media_id}`
        : `BOPP Frequency Trajectory (Hz): ${annotation.media_id}`,
      color: textColor,
    };

    const overviewLayers = [
      {
        mark: {
          type: isInterval ? 'rect' : 'line',
          strokeWidth: 2,
          stroke: isDark ? '#38bdf8' : '#0284c7',
          fill: isInterval ? (isDark ? '#38bdf8' : '#0284c7') : null,
          opacity: isInterval ? 0.7 : 1,
        },
        encoding: {
          x: { field: 'time', type: 'quantitative' },
          ...(isInterval ? { x2: { field: '_calc_end' } } : {}),
          y: {
            field: 'hz',
            type: 'quantitative',
            scale: { domain: [Math.max(20, minFreq - freqPad), maxFreq + freqPad], zero: false },
            axis: null,
          },
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
      const quadrantAxes = buildCircumplexQuadrantLayers(gridColor, axisColor);

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
          $schema: VEGA_LITE_SCHEMA,
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
        $schema: VEGA_LITE_SCHEMA,
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
        ],
      };
    }

    // Case B: Dynamic mood with time progression
    const xTimeField = 'time';
    return {
      $schema: VEGA_LITE_SCHEMA,
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
            ...buildCircumplexQuadrantLayers(gridColor, axisColor),
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
  if (
    extentType === 'score_interval' ||
    extentType === 'score_quarter' ||
    extentType === 'score_interval_float' ||
    extentType === 'score_quarter_float'
  ) {
    const isInterval = extentType === 'score_interval' || extentType === 'score_interval_float';
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
      transforms.push(
        {
          calculate: `datum.${xTime} + (datum.duration != null ? datum.duration : 0)`,
          as: '_calc_end',
        },
        {
          calculate: `datum.${xTime} + (datum.duration != null ? datum.duration / 2 : 0)`,
          as: '_mid_time',
        }
      );

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
            ...(hasConfidence ? [
              { field: 'confidence', type: 'quantitative', format: '.1%', title: 'Confidence' },
              { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
            ] : []),
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
            align: 'left',
            dx: 6,
            dy: -10,
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

      // Variance error ribbons and whiskers or top-edge confidence meter for each rubato interval
      if (hasConfidence && confidenceChannel !== 'none') {
        if (confidenceType === 'variance') {
          layers.push({
            transform: [{ filter: 'datum.value_ci_lower != null && datum.value_ci_upper != null' }],
            mark: { type: 'rect', opacity: 0.22, color: '#f59e0b' },
            encoding: {
              x: { field: xTime, type: 'quantitative', scale: { domain: [minX, maxX] } },
              x2: { field: '_calc_end' },
              y: { field: 'value_ci_lower', type: 'quantitative', scale: { zero: false } },
              y2: { field: 'value_ci_upper' },
            },
          });
          layers.push(...buildVarianceErrorBarLayers({
            xField: '_mid_time',
            yField: 'value',
            lowerField: 'value_ci_lower',
            upperField: 'value_ci_upper',
            isDark,
            whiskerColor: isDark ? '#fbbf24' : '#b45309',
          }));
        } else {
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
  const { isMidi, isScore, isTime, isInterval, xField } = resolveExtentAxis(extentType, data);
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
          mark: useSingleRow ? { type: 'rect', opacity: 0.75, cornerRadius: 2 } : { type: 'bar', opacity: 0.75, cornerRadius: 2 },
          encoding: {
            x: { field: xField, type: 'quantitative' },
            x2: { field: '_calc_end' },
            ...(useSingleRow
              ? { y: { value: 2 }, y2: { value: 50 } }
              : { y: { field: 'value', type: 'nominal', axis: null } }),
            color: { field: 'value', type: 'nominal', scale: colorScale, legend: null },
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
    $schema: VEGA_LITE_SCHEMA,
    width: chartWidth,
    height: chartHeight,
    title: fallbackTitle,
    data: { values: data },
    transform: transforms,
    config: baseConfig,
    layer: layers,
  };
}
