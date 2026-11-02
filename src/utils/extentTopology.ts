/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilities for BOPP v1 extent & grouping topology (disjoint, exhaustive, min/max bounds)
 * and coherent grouping resolution across plots.
 */

import { BoppAnnotation, BoppExtent, Fraction, Grouping } from '../types/bopp';

export interface ExtentDomainBounds {
  disjoint: boolean;
  exhaustive: boolean;
  /** Primary 1D temporal / sequential axis bounds (time, tick, quarter, offset) */
  minPrimary?: number;
  maxPrimary?: number;
  /** Explicit bounds by dimension name */
  min_time?: number;
  max_time?: number;
  min_freq?: number;
  max_freq?: number;
  min_tick?: number;
  max_tick?: number;
  min_quarter?: number;
  max_quarter?: number;
  min_offset?: number;
  max_offset?: number;
  min_x?: number;
  max_x?: number;
  min_y?: number;
  max_y?: number;
  min_z?: number;
  max_z?: number;
  min_azimuth?: number;
  max_azimuth?: number;
  min_elevation?: number;
  max_elevation?: number;
  min_radius?: number;
  max_radius?: number;
}

export interface ResolvedGrouping {
  /** Index in annotation.groupings */
  index: number;
  /** Raw Grouping object */
  grouping: Grouping;
  /** Parallel array of integer group IDs */
  ids: number[];
  /** Grouping name */
  name: string;
  /** Whether observations within each non-negative group ID are mutually disjoint */
  disjoint: boolean;
  /** Whether observations within each non-negative group ID exhaustively cover the extent range */
  exhaustive: boolean;
  /** Inverted map from integer group ID to human-readable label */
  idToLabel: Map<number, string>;
  /** Sorted unique non-negative group IDs present in grouping.ids (or defined in labels) */
  nonNegativeGroupIds: number[];
  /** Alias for nonNegativeGroupIds */
  orderedGroupIds: number[];
  /** Ordered display labels corresponding to nonNegativeGroupIds */
  nonNegativeGroupLabels: string[];
  /** Ordered display labels including trailing 'Ungrouped' if any gid < 0 is present */
  orderedGroupLabels: string[];
  /** Whether any observation has gid < 0 */
  hasUngrouped: boolean;
  /** Format a group ID into its display label */
  getLabelForId: (gid: number) => string;
  /** Get 0-based sort order index for a group ID (ungrouped placed at the end) */
  getOrderForId: (gid: number) => number;
}

export const UNGROUPED_LABEL = 'Ungrouped';

/**
 * Checks if a given extent type represents an interval extent.
 */
export function isIntervalExtentType(extentType?: string | null): boolean {
  if (!extentType) return false;
  const lower = extentType.toLowerCase();
  return (
    lower === 'time_interval' ||
    lower === 'score_interval' ||
    lower === 'score_interval_float' ||
    lower === 'midi_interval' ||
    lower === 'text_interval' ||
    lower === 'cartesian_time_interval' ||
    lower === 'spherical_time_interval' ||
    lower.endsWith('_interval')
  );
}

/**
 * Convert a BOPP Fraction [numerator, denominator] or number to a floating-point number.
 */
export function fractionOrNumberToFloat(val: Fraction | number | undefined | null): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  if (Array.isArray(val) && val.length === 2) {
    const [num, den] = val;
    if (typeof num === 'number' && typeof den === 'number' && den !== 0) {
      return num / den;
    }
  }
  return undefined;
}

/**
 * Extract topological flags (disjoint, exhaustive) and optional scalar bounds (min_*, max_*)
 * from an annotation's extent.
 */
export function getExtentTopology(extent?: BoppExtent | null): ExtentDomainBounds {
  if (!extent) {
    return {
      disjoint: false,
      exhaustive: false,
    };
  }

  const ext = extent as Record<string, any>;
  const disjoint = ext.extent_type === 'time_uniform' ? true : Boolean(ext.disjoint);
  const exhaustive = Boolean(ext.exhaustive);

  const min_time = typeof ext.min_time === 'number' ? ext.min_time : undefined;
  const max_time = typeof ext.max_time === 'number' ? ext.max_time : undefined;
  const min_freq = typeof ext.min_freq === 'number' ? ext.min_freq : undefined;
  const max_freq = typeof ext.max_freq === 'number' ? ext.max_freq : undefined;
  const min_tick = typeof ext.min_tick === 'number' ? ext.min_tick : undefined;
  const max_tick = typeof ext.max_tick === 'number' ? ext.max_tick : undefined;
  const min_quarter = fractionOrNumberToFloat(ext.min_quarter);
  const max_quarter = fractionOrNumberToFloat(ext.max_quarter);
  const min_offset = typeof ext.min_offset === 'number' ? ext.min_offset : undefined;
  const max_offset = typeof ext.max_offset === 'number' ? ext.max_offset : undefined;
  const min_x = typeof ext.min_x === 'number' ? ext.min_x : undefined;
  const max_x = typeof ext.max_x === 'number' ? ext.max_x : undefined;
  const min_y = typeof ext.min_y === 'number' ? ext.min_y : undefined;
  const max_y = typeof ext.max_y === 'number' ? ext.max_y : undefined;
  const min_z = typeof ext.min_z === 'number' ? ext.min_z : undefined;
  const max_z = typeof ext.max_z === 'number' ? ext.max_z : undefined;
  const min_azimuth = typeof ext.min_azimuth === 'number' ? ext.min_azimuth : undefined;
  const max_azimuth = typeof ext.max_azimuth === 'number' ? ext.max_azimuth : undefined;
  const min_elevation = typeof ext.min_elevation === 'number' ? ext.min_elevation : undefined;
  const max_elevation = typeof ext.max_elevation === 'number' ? ext.max_elevation : undefined;
  const min_radius = typeof ext.min_radius === 'number' ? ext.min_radius : undefined;
  const max_radius = typeof ext.max_radius === 'number' ? ext.max_radius : undefined;

  let minPrimary: number | undefined;
  let maxPrimary: number | undefined;

  switch (extent.extent_type) {
    case 'time':
    case 'time_interval':
    case 'time_uniform':
    case 'time_frequency_box':
    case 'cartesian_time':
    case 'cartesian_time_interval':
    case 'spherical_time':
    case 'spherical_time_interval':
      minPrimary = min_time;
      maxPrimary = max_time;
      break;
    case 'midi_tick':
    case 'midi_interval':
      minPrimary = min_tick;
      maxPrimary = max_tick;
      break;
    case 'score_quarter':
    case 'score_interval':
    case 'score_quarter_float':
    case 'score_interval_float':
      minPrimary = min_quarter;
      maxPrimary = max_quarter;
      break;
    case 'text':
    case 'text_interval':
      minPrimary = min_offset;
      maxPrimary = max_offset;
      break;
    case 'pixel':
    case 'pixel_box':
    case 'cartesian':
      minPrimary = min_x;
      maxPrimary = max_x;
      break;
    case 'spherical':
      minPrimary = min_azimuth;
      maxPrimary = max_azimuth;
      break;
  }

  return {
    disjoint,
    exhaustive,
    minPrimary,
    maxPrimary,
    min_time,
    max_time,
    min_freq,
    max_freq,
    min_tick,
    max_tick,
    min_quarter,
    max_quarter,
    min_offset,
    max_offset,
    min_x,
    max_x,
    min_y,
    max_y,
    min_z,
    max_z,
    min_azimuth,
    max_azimuth,
    min_elevation,
    max_elevation,
    min_radius,
    max_radius,
  };
}

/**
 * Resolve a coordinate domain range [min, max] combining observed data range with optional
 * explicit schema bounds (min_*, max_*).
 */
export function resolveDomainRange(
  observedMin: number,
  observedMax: number,
  explicitMin?: number,
  explicitMax?: number,
  fallbackMin: number = 0,
  fallbackMax: number = 10
): [number, number] {
  const safeObsMin = Number.isFinite(observedMin) ? observedMin : fallbackMin;
  const safeObsMax = Number.isFinite(observedMax) ? observedMax : fallbackMax;
  const lo = explicitMin !== undefined && Number.isFinite(explicitMin)
    ? Math.min(explicitMin, safeObsMin)
    : safeObsMin;
  const hi = explicitMax !== undefined && Number.isFinite(explicitMax)
    ? Math.max(explicitMax, safeObsMax)
    : safeObsMax;
  return [lo, hi];
}

/**
 * Format a concise human-readable summary of any explicit min/max bounds on an extent.
 */
export function formatExtentBoundsSummary(extent?: BoppExtent | null): string[] {
  if (!extent) return [];
  const b = getExtentTopology(extent);
  const parts: string[] = [];
  if (b.min_time !== undefined || b.max_time !== undefined) {
    parts.push(`time: [${b.min_time ?? '…'}, ${b.max_time ?? '…'}]s`);
  }
  if (b.min_freq !== undefined || b.max_freq !== undefined) {
    parts.push(`freq: [${b.min_freq ?? '…'}, ${b.max_freq ?? '…'}] Hz`);
  }
  if (b.min_tick !== undefined || b.max_tick !== undefined) {
    parts.push(`tick: [${b.min_tick ?? '…'}, ${b.max_tick ?? '…'}]`);
  }
  if (b.min_quarter !== undefined || b.max_quarter !== undefined) {
    parts.push(`quarter: [${b.min_quarter ?? '…'}, ${b.max_quarter ?? '…'}]`);
  }
  if (b.min_offset !== undefined || b.max_offset !== undefined) {
    parts.push(`offset: [${b.min_offset ?? '…'}, ${b.max_offset ?? '…'}]`);
  }
  if (b.min_x !== undefined || b.max_x !== undefined) {
    parts.push(`x: [${b.min_x ?? '…'}, ${b.max_x ?? '…'}]`);
  }
  if (b.min_y !== undefined || b.max_y !== undefined) {
    parts.push(`y: [${b.min_y ?? '…'}, ${b.max_y ?? '…'}]`);
  }
  if (b.min_z !== undefined || b.max_z !== undefined) {
    parts.push(`z: [${b.min_z ?? '…'}, ${b.max_z ?? '…'}]`);
  }
  if (b.min_azimuth !== undefined || b.max_azimuth !== undefined) {
    parts.push(`az: [${b.min_azimuth ?? '…'}°, ${b.max_azimuth ?? '…'}°]`);
  }
  if (b.min_elevation !== undefined || b.max_elevation !== undefined) {
    parts.push(`el: [${b.min_elevation ?? '…'}°, ${b.max_elevation ?? '…'}°]`);
  }
  if (b.min_radius !== undefined || b.max_radius !== undefined) {
    parts.push(`r: [${b.min_radius ?? '…'}, ${b.max_radius ?? '…'}]`);
  }
  return parts;
}

/**
 * Resolve the active Grouping for an annotation.
 *
 * @param annotation The BOPP annotation
 * @param activeGroupingIndex Optional index into annotation.groupings:
 *   - undefined: default to 0 if annotation.groupings is non-empty, else null
 *   - null or < 0: explicitly ungrouped (returns null)
 *   - >= 0: selects annotation.groupings[activeGroupingIndex] if in range
 */
export function resolveActiveGrouping(
  annotation: BoppAnnotation,
  activeGroupingIndex?: number | null
): ResolvedGrouping | null {
  const groupings = annotation.groupings;
  if (!Array.isArray(groupings) || groupings.length === 0) {
    return null;
  }

  const resolvedIdx = activeGroupingIndex === undefined ? 0 : activeGroupingIndex;
  if (resolvedIdx === null || resolvedIdx < 0 || resolvedIdx >= groupings.length) {
    return null;
  }

  const grouping = groupings[resolvedIdx];
  if (!grouping || !Array.isArray(grouping.ids)) {
    return null;
  }

  // Invert grouping.labels (string -> int) into idToLabel (int -> string)
  const idToLabel = new Map<number, string>();
  if (grouping.labels && typeof grouping.labels === 'object') {
    for (const [labelName, idVal] of Object.entries(grouping.labels)) {
      if (typeof idVal === 'number' && Number.isInteger(idVal)) {
        idToLabel.set(idVal, labelName);
      }
    }
  }

  // Collect all unique non-negative group IDs present in grouping.ids
  const nonNegativeSet = new Set<number>();
  let hasUngrouped = false;
  for (const rawId of grouping.ids) {
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      if (rawId >= 0) {
        nonNegativeSet.add(rawId);
      } else {
        hasUngrouped = true;
      }
    } else {
      hasUngrouped = true;
    }
  }

  const nonNegativeGroupIds = Array.from(nonNegativeSet).sort((a, b) => a - b);

  const getLabelForId = (gid: number): string => {
    if (gid < 0 || !Number.isFinite(gid)) {
      return UNGROUPED_LABEL;
    }
    const mapped = idToLabel.get(gid);
    return mapped ? mapped : `${grouping.name} ${gid}`;
  };

  const nonNegativeGroupLabels = nonNegativeGroupIds.map(gid => getLabelForId(gid));
  const orderedGroupLabels = hasUngrouped
    ? [...nonNegativeGroupLabels, UNGROUPED_LABEL]
    : [...nonNegativeGroupLabels];

  const idOrderMap = new Map<number, number>();
  nonNegativeGroupIds.forEach((gid, idx) => {
    idOrderMap.set(gid, idx);
  });

  const getOrderForId = (gid: number): number => {
    if (gid < 0 || !Number.isFinite(gid)) {
      return nonNegativeGroupIds.length;
    }
    return idOrderMap.get(gid) ?? nonNegativeGroupIds.length;
  };

  return {
    index: resolvedIdx,
    grouping,
    ids: grouping.ids,
    name: grouping.name,
    disjoint: Boolean(grouping.disjoint),
    exhaustive: Boolean(grouping.exhaustive),
    idToLabel,
    nonNegativeGroupIds,
    orderedGroupIds: nonNegativeGroupIds,
    nonNegativeGroupLabels,
    orderedGroupLabels,
    hasUngrouped,
    getLabelForId,
    getOrderForId,
  };
}
