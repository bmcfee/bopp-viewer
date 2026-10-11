/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interval Disjoint vs Overlap Analysis Engine
 * 
 * Analyzes temporal, score, and MIDI interval annotations (time_interval, score_interval, midi_interval)
 * to determine whether observation intervals are strictly disjoint (contiguous/spaced without time collision)
 * or overlap in time (concurrent/polyphonic events).
 * 
 * When annotations are disjoint, visualizers can render all intervals within a single horizontal row track
 * on the vertical axis rather than allocating a separate row for each categorical value.
 */

import type { BoppAnnotation, TabularRecord } from '../types/bopp';

export interface IntervalSpan {
  index: number;
  start: number;
  end: number;
  duration: number;
  value?: unknown;
  label?: unknown;
  originalRecord?: TabularRecord;
}

export interface IntervalOverlapPair {
  index1: number;
  index2: number;
  span1: IntervalSpan;
  span2: IntervalSpan;
  overlapAmount: number;
  overlapStart: number;
  overlapEnd: number;
}

export interface IntervalDisjointAnalysis {
  /** Whether the annotation has an interval extent (time_interval, score_interval, midi_interval) */
  isIntervalExtent: boolean;
  /** Extent type string from annotation (e.g. 'time_interval', 'score_interval', 'midi_interval') */
  extentType: string;
  /** Primary coordinate domain detected */
  coordinateAxis: 'time' | 'score' | 'midi' | 'unknown';
  /** Total number of parsed intervals */
  totalIntervals: number;
  /** True if no two intervals overlap in time (strictly disjoint or abutting) */
  isDisjoint: boolean;
  /** True if at least one pair of intervals overlap in time */
  hasOverlap: boolean;
  /** Total number of pairwise interval overlaps */
  overlapCount: number;
  /** List of overlapping interval pairs with details */
  overlappingPairs: IntervalOverlapPair[];
  /** Maximum number of simultaneous overlapping intervals (concurrency level) */
  maxConcurrentOverlap: number;
  /** Number of unique categorical values/labels in the annotation */
  uniqueValuesCount: number;
  /** Recommendation: whether to render in a single row on the vertical axis */
  shouldUseSingleRow: boolean;
  /** Label for the single row vertical axis if disjoint */
  singleRowLabel: string;
}

/**
 * Checks if a given extent type represents an interval extent.
 */
export function isIntervalExtentType(extentType?: string | null): boolean {
  if (!extentType) return false;
  const lower = extentType.toLowerCase();
  return (
    lower === 'time_interval' ||
    lower === 'score_interval' ||
    lower === 'midi_interval' ||
    lower.endsWith('_interval') ||
    lower.includes('interval')
  );
}

/**
 * Helper to extract numeric values from numbers, strings, or rational fraction tuples [num, den]
 */
export function toNumericCoordinate(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'number' && typeof val[1] === 'number' && val[1] !== 0) {
    return val[0] / val[1];
  }
  if (typeof val === 'string') {
    if (val.includes('/')) {
      const parts = val.split('/');
      const n = parseFloat(parts[0]);
      const d = parseFloat(parts[1]);
      if (!isNaN(n) && !isNaN(d) && d !== 0) return n / d;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Extracts interval spans [start, end] from tabular records based on extent type and record fields.
 */
export function extractIntervalSpans(
  records: TabularRecord[],
  extentType?: string | null
): { spans: IntervalSpan[]; coordinateAxis: 'time' | 'score' | 'midi' | 'unknown' } {
  if (!records || records.length === 0) {
    return { spans: [], coordinateAxis: 'unknown' };
  }

  // Detect coordinate axis
  let coordinateAxis: 'time' | 'score' | 'midi' | 'unknown' = 'unknown';
  const lowerExtent = extentType?.toLowerCase() || '';

  if (lowerExtent.includes('midi') || lowerExtent.includes('tick')) {
    coordinateAxis = 'midi';
  } else if (lowerExtent.includes('score') || lowerExtent.includes('quarter') || lowerExtent.includes('beat')) {
    coordinateAxis = 'score';
  } else if (lowerExtent.includes('time') || lowerExtent.includes('sec')) {
    coordinateAxis = 'time';
  } else {
    // Detect by fields in records
    const first = records[0];
    if (toNumericCoordinate(first.tick) !== null) coordinateAxis = 'midi';
    else if (toNumericCoordinate(first.quarter) !== null || toNumericCoordinate(first.score) !== null || toNumericCoordinate(first.beat) !== null) coordinateAxis = 'score';
    else if (toNumericCoordinate(first.time) !== null) coordinateAxis = 'time';
  }

  const spans: IntervalSpan[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let start: number | null = null;
    let duration: number | null = null;
    let end: number | null = null;

    // Coordinate resolution
    if (coordinateAxis === 'midi') {
      start = toNumericCoordinate(r.tick) ?? toNumericCoordinate(r.time) ?? toNumericCoordinate(r.start);
    } else if (coordinateAxis === 'score') {
      start = toNumericCoordinate(r.quarter) ?? toNumericCoordinate(r.score) ?? toNumericCoordinate(r.beat) ?? toNumericCoordinate(r.time) ?? toNumericCoordinate(r.start);
    } else {
      // Default time or auto
      start = toNumericCoordinate(r.time) ?? toNumericCoordinate(r.start);
      if (start === null) {
        const tickVal = toNumericCoordinate(r.tick);
        if (tickVal !== null) { start = tickVal; coordinateAxis = 'midi'; }
        const qVal = toNumericCoordinate(r.quarter);
        if (qVal !== null) { start = qVal; coordinateAxis = 'score'; }
      }
    }

    if (start === null) {
      continue;
    }

    // Duration resolution
    duration = toNumericCoordinate(r.duration) ?? toNumericCoordinate(r.dur);
    if (duration !== null) {
      end = start + duration;
    } else {
      const explicitEnd = toNumericCoordinate(r.end);
      if (explicitEnd !== null) {
        end = explicitEnd;
        duration = Math.max(0, end - start);
      } else {
        // Missing duration: treat as instantaneous or zero duration
        duration = 0;
        end = start;
      }
    }

    spans.push({
      index: i,
      start,
      end,
      duration,
      value: r.value,
      label: r.label,
      originalRecord: r,
    });
  }

  return { spans, coordinateAxis };
}

/**
 * Checks whether an array of intervals are pairwise disjoint.
 * Returns true if no intervals overlap in time (allowing abutting intervals with tolerance epsilon).
 */
export function checkIntervalsDisjoint(
  intervals: Array<{ start: number; end: number }>,
  epsilon: number = 1e-5
): boolean {
  if (intervals.length <= 1) return true;

  // Sort by start position
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);

  let maxEndSoFar = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    // Overlap occurs if current start is strictly before the end of a previous interval
    if (current.start < maxEndSoFar - epsilon) {
      return false;
    }
    maxEndSoFar = Math.max(maxEndSoFar, current.end);
  }

  return true;
}

/**
 * Comprehensively analyzes an annotation document and its tabular records
 * to determine whether interval observations are disjoint or overlapping.
 */
export function analyzeIntervalAnnotation(
  annotation: BoppAnnotation,
  records?: TabularRecord[],
  options: {
    epsilon?: number;
    defaultSingleRowLabel?: string;
  } = {}
): IntervalDisjointAnalysis {
  const { epsilon = 1e-5, defaultSingleRowLabel } = options;
  const extentType = annotation.extent?.extent_type || '';
  const payloadType = annotation.payload?.payload_type || 'annotation';
  const isInterval = isIntervalExtentType(extentType);

  // If records are not provided, synthesize from annotation extent if available
  let effectiveRecords = records;
  if (!effectiveRecords || effectiveRecords.length === 0) {
    effectiveRecords = [];
    const ext = annotation.extent as Record<string, any> | undefined;
    const payload = annotation.payload as Record<string, any> | undefined;
    const count = Array.isArray(ext?.time) ? ext?.time.length
      : Array.isArray(ext?.tick) ? ext?.tick.length
      : Array.isArray(ext?.quarter) ? ext?.quarter.length
      : Array.isArray(payload?.value) ? payload?.value.length
      : 0;

    for (let i = 0; i < count; i++) {
      const rec: TabularRecord = {
        __index: i,
        time: ext?.time?.[i],
        duration: ext?.duration?.[i],
        tick: ext?.tick?.[i],
        quarter: ext?.quarter?.[i],
        value: payload?.value?.[i],
        label: payload?.label?.[i],
      };
      effectiveRecords.push(rec);
    }
  }

  const { spans, coordinateAxis } = extractIntervalSpans(effectiveRecords, extentType);

  if (!isInterval || spans.length <= 1) {
    const uniqueValues = new Set<string>();
    spans.forEach(s => {
      const v = String(s.value ?? s.label ?? '');
      if (v) uniqueValues.add(v);
    });

    return {
      isIntervalExtent: isInterval,
      extentType,
      coordinateAxis,
      totalIntervals: spans.length,
      isDisjoint: true,
      hasOverlap: false,
      overlapCount: 0,
      overlappingPairs: [],
      maxConcurrentOverlap: spans.length > 0 ? 1 : 0,
      uniqueValuesCount: uniqueValues.size,
      shouldUseSingleRow: isInterval && spans.length > 0,
      singleRowLabel: defaultSingleRowLabel || (payloadType === 'tag_open' ? 'Tags' : payloadType === 'segment_open' ? 'Sections' : 'Timeline'),
    };
  }

  // Find all pairwise overlaps and maximum concurrency
  const overlappingPairs: IntervalOverlapPair[] = [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);

  // Sweep-line / event list to compute max concurrent overlap
  interface SweepEvent {
    pos: number;
    type: 'start' | 'end';
    span: IntervalSpan;
  }
  const events: SweepEvent[] = [];
  for (const s of sorted) {
    events.push({ pos: s.start, type: 'start', span: s });
    events.push({ pos: s.end, type: 'end', span: s });
  }
  // Sort events: starts before ends if at same position? No, for intervals [a, b) and [b, c),
  // end of first should happen before start of second to avoid false overlap!
  events.sort((a, b) => {
    if (Math.abs(a.pos - b.pos) > epsilon) {
      return a.pos - b.pos;
    }
    // If positions are within epsilon, end events should process before start events
    if (a.type !== b.type) {
      return a.type === 'end' ? -1 : 1;
    }
    return 0;
  });

  let activeCount = 0;
  let maxConcurrent = 0;
  for (const ev of events) {
    if (ev.type === 'start') {
      activeCount++;
      if (activeCount > maxConcurrent) {
        maxConcurrent = activeCount;
      }
    } else {
      activeCount = Math.max(0, activeCount - 1);
    }
  }

  // Pairwise overlap detection
  for (let i = 0; i < sorted.length; i++) {
    const s1 = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const s2 = sorted[j];
      // Since sorted by start, if s2.start >= s1.end - epsilon, no subsequent intervals will overlap with s1
      if (s2.start >= s1.end - epsilon) {
        break;
      }
      // Overlap detected
      const overlapStart = Math.max(s1.start, s2.start);
      const overlapEnd = Math.min(s1.end, s2.end);
      const overlapAmount = Math.max(0, overlapEnd - overlapStart);

      if (overlapAmount > epsilon) {
        overlappingPairs.push({
          index1: s1.index,
          index2: s2.index,
          span1: s1,
          span2: s2,
          overlapAmount,
          overlapStart,
          overlapEnd,
        });
      }
    }
  }

  const isDisjoint = overlappingPairs.length === 0;
  const hasOverlap = overlappingPairs.length > 0;

  const uniqueValues = new Set<string>();
  spans.forEach(s => {
    const v = String(s.value ?? s.label ?? '');
    if (v) uniqueValues.add(v);
  });

  // Recommended single row label
  let singleRowLabel = defaultSingleRowLabel;
  if (!singleRowLabel) {
    if (payloadType === 'tag_open' || (payloadType as string) === 'tag') {
      singleRowLabel = 'Active Tags';
    } else if (payloadType === 'segment_open') {
      singleRowLabel = 'Structural Sections';
    } else if (payloadType === 'multi_segment') {
      singleRowLabel = 'Structure';
    } else if (payloadType === 'chord') {
      singleRowLabel = 'Harmonic Progression';
    } else {
      singleRowLabel = `${payloadType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
    }
  }

  return {
    isIntervalExtent: isInterval,
    extentType,
    coordinateAxis,
    totalIntervals: spans.length,
    isDisjoint,
    hasOverlap,
    overlapCount: overlappingPairs.length,
    overlappingPairs,
    maxConcurrentOverlap: maxConcurrent,
    uniqueValuesCount: uniqueValues.size,
    shouldUseSingleRow: isInterval && isDisjoint,
    singleRowLabel,
  };
}
