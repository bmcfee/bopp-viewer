/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Circle-of-Fifths and Chromatic Pitch Colormaps from mir_eval
 * Source: https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/display.py
 */

import * as vega from 'vega';

// mir_eval exact colormaps
export const MIR_EVAL_COLORMAPS = {
  // Chromatic pitch maps (cycling C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
  pitch: [
    "#f2695a", // 0: C
    "#f2aa5a", // 1: C#
    "#f2eb5a", // 2: D
    "#5af27f", // 3: D#
    "#5af2c0", // 4: E
    "#5ae2f2", // 5: F
    "#5aa1f2", // 6: F#
    "#5a60f2", // 7: G
    "#945af2", // 8: G#
    "#d55af2", // 9: A
    "#f25acd", // 10: A#
    "#f25a8c", // 11: B
  ],
  pitch_light: [
    "#ffbab3",
    "#ffdbb3",
    "#fffbb3",
    "#b3ffc5",
    "#b3ffe6",
    "#b3f7ff",
    "#b3d7ff",
    "#b3b6ff",
    "#d0b3ff",
    "#f1b3ff",
    "#ffb3ec",
    "#ffb3cc",
  ],
  pitch_dark: [
    "#ad2d1f",
    "#ad6a1f",
    "#ada71f",
    "#1fad41",
    "#1fad7e",
    "#1f9fad",
    "#1f62ad",
    "#1f25ad",
    "#561fad",
    "#931fad",
    "#ad1f8b",
    "#ad1f4e",
  ],

  // Circle of fifths maps (cycling C, G, D, A, E, B, F#, C#/Db, G#/Ab, D#/Eb, A#/Bb, F)
  fifths: [
    "#f2695a", // 0: C
    "#5a60f2", // 1: G
    "#f2eb5a", // 2: D
    "#d55af2", // 3: A
    "#5af2c0", // 4: E
    "#f25a8c", // 5: B
    "#5aa1f2", // 6: F# / Gb
    "#f2aa5a", // 7: C# / Db
    "#945af2", // 8: G# / Ab
    "#5af27f", // 9: D# / Eb
    "#f25acd", // 10: A# / Bb
    "#5ae2f2", // 11: F
  ],
  fifths_light: [
    "#ffbab3", // C
    "#b3b6ff", // G
    "#fffbb3", // D
    "#f1b3ff", // A
    "#b3ffe6", // E
    "#ffb3cc", // B
    "#b3d7ff", // F# / Gb
    "#ffdbb3", // C# / Db
    "#d0b3ff", // G# / Ab
    "#b3ffc5", // D# / Eb
    "#ffb3ec", // A# / Bb
    "#b3f7ff", // F
  ],
  fifths_dark: [
    "#ad2d1f", // C
    "#1f25ad", // G
    "#ada71f", // D
    "#931fad", // A
    "#1fad7e", // E
    "#ad1f4e", // B
    "#1f62ad", // F# / Gb
    "#ad6a1f", // C# / Db
    "#561fad", // G# / Ab
    "#1fad41", // D# / Eb
    "#ad1f8b", // A# / Bb
    "#1f9fad", // F
  ],
  // Gray for out-of-gamut 'X' or no-chord 'N'
  neutral_gray: "#94a3b8",
};

// Circle of fifths root order: index in fifths colormap
// C=0, G=1, D=2, A=3, E=4, B=5, F#=6, C#=7, G#=8, D#=9, A#=10, F=11
const FIFTHS_ROOT_MAP: Record<string, number> = {
  C: 0,
  "B#": 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  Cb: 5,
  "F#": 6,
  Gb: 6,
  "C#": 7,
  Db: 7,
  "G#": 8,
  Ab: 8,
  "D#": 9,
  Eb: 9,
  "A#": 10,
  Bb: 10,
  F: 11,
  "E#": 11,
};

// Chromatic pitch root map: index in pitch colormap (0..11)
const CHROMATIC_ROOT_MAP: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

export type ChordQualityCategory = "maj" | "min" | "other" | "none";

/**
 * Returns exact hex color for a pitch class (0..11, C..B) from mir_eval palette
 */
export function getPitchClassColor(pitchClass: number, mode: 'fifths' | 'pitch' = 'pitch'): string {
  const pc = ((Math.round(pitchClass) % 12) + 12) % 12;
  if (mode === 'fifths') {
    return MIR_EVAL_COLORMAPS.fifths[pc];
  }
  return MIR_EVAL_COLORMAPS.pitch[pc];
}

export const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;


/**
 * Standard circle-of-fifths order for 12 tonics with C at top (12 o'clock)
 */
export const FIFTHS_ORDER_12_ROOTS = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
] as const;

/**
 * Standard 24 musical keys ordered from Top to Bottom for Vega-Lite ordinal y-scale.
 * In Vega-Lite, domain[0] appears at the top, and domain[last] appears at the bottom.
 * Therefore, listing from B down to C makes the pitch axis go UP from C at the bottom!
 * Each tonic groups Major and Minor together.
 */
export const ALL_24_KEYS_TOP_TO_BOTTOM = [
  'B:min', 'B:maj',
  'Bb:min', 'Bb:maj',
  'A:min', 'A:maj',
  'Ab:min', 'Ab:maj',
  'G:min', 'G:maj',
  'F#:min', 'F#:maj',
  'F:min', 'F:maj',
  'E:min', 'E:maj',
  'Eb:min', 'Eb:maj',
  'D:min', 'D:maj',
  'Db:min', 'Db:maj',
  'C:min', 'C:maj',
] as const;

/**
 * Normalizes musical key string to canonical representation (e.g. 'C:maj', 'Eb:maj')
 */
export function normalizeKeyName(keyStr: string): string {
  const parsed = parseKeyMode(keyStr);
  if (!parsed) return keyStr;
  const standardRoots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const root = standardRoots[parsed.semitone] ?? parsed.root;
  return `${root}:${parsed.isMinor ? 'min' : 'maj'}`;
}

/**
 * Parses musical key string into tonic root, mode, and semitone
 */
export function parseKeyMode(keyStr: string): { root: string; isMinor: boolean; semitone: number } | null {
  if (!keyStr || keyStr === 'N' || keyStr === 'X') return null;

  const match = keyStr.trim().match(/^([A-Ga-g][b#]?)(?::?(maj|major|min|minor|m)?)?/);
  if (!match) return null;

  const rawRoot = match[1];
  const modeStr = (match[2] || '').toLowerCase();
  const root = rawRoot.charAt(0).toUpperCase() + rawRoot.slice(1);

  const semitone = CHROMATIC_ROOT_MAP[root] ?? 0;
  // Lowercase letter (e.g. 'c') or 'min'/'minor' denotes minor key
  const isMinor =
    modeStr === 'min' ||
    modeStr === 'minor' ||
    modeStr === 'm' ||
    (!modeStr && rawRoot === rawRoot.toLowerCase());

  return { root, isMinor, semitone };
}

/**
 * Returns tonic pitch ordering rank (0..23) alternating Major then Minor for each tonic pitch class (C..B)
 * C:maj = 0, C:min = 1, C#:maj = 2, C#:min = 3, ... B:maj = 22, B:min = 23, N = 999
 */
export function getKeyTonicRank(keyStr: string): number {
  const parsed = parseKeyMode(keyStr);
  if (!parsed) return 999;
  return parsed.semitone * 2 + (parsed.isMinor ? 1 : 0);
}

/**
 * Maps a key_mode label to mir_eval circle-of-fifths palette
 * Major keys use fifths, Minor keys use fifths_dark
 */
export function keyToMirEvalColor(keyStr: string): string {
  const parsed = parseKeyMode(keyStr);
  if (!parsed) return MIR_EVAL_COLORMAPS.neutral_gray;

  // Use true circle-of-fifths index: C=0, G=1, D=2, A=3, E=4, B=5, F#=6, Db=7, Ab=8, Eb=9, Bb=10, F=11
  const fifthsIdx = FIFTHS_ROOT_MAP[parsed.root] ?? ((parsed.semitone * 7) % 12);
  if (parsed.isMinor) {
    return MIR_EVAL_COLORMAPS.fifths_dark[fifthsIdx];
  }
  return MIR_EVAL_COLORMAPS.fifths[fifthsIdx];
}

/**
 * Categorizes a Harte chord into maj, min, other, or none (matching mir_eval)
 */
export function classifyChordQuality(chordStr: string): ChordQualityCategory {
  if (!chordStr || chordStr === "N" || chordStr === "X") {
    return "none";
  }

  // Split root and shorthand/components
  const parts = chordStr.split("/");
  const base = parts[0];
  const colonIdx = base.indexOf(":");
  const quality = colonIdx !== -1 ? base.slice(colonIdx + 1) : "maj";

  // In mir_eval:
  // Major qualities (identified by natural 3) and suspended chords (sus2, sus4) get bright color
  // Minor qualities (identified by flat 3) get darker color
  // Other qualities get light color
  if (
    quality.includes("sus") ||
    quality === "maj" ||
    quality === "7" ||
    quality === "maj7" ||
    quality === "9" ||
    quality === "maj9" ||
    quality === "11" ||
    quality === "maj11" ||
    quality === "13" ||
    quality === "maj13" ||
    quality === "maj6" ||
    quality === ""
  ) {
    return "maj";
  }

  if (
    quality.includes("min") ||
    quality.includes("m") ||
    quality === "min7" ||
    quality === "minmaj7" ||
    quality === "min9" ||
    quality === "min11" ||
    quality === "min13" ||
    quality === "min6"
  ) {
    return "min";
  }

  // Diminished, augmented, 1, 5, etc.
  return "other";
}

/**
 * Extracts root note from Harte chord string
 */
export function extractChordRoot(chordStr: string): string | null {
  if (!chordStr || chordStr === "N" || chordStr === "X") {
    return null;
  }
  const match = chordStr.match(/^([A-G][b#]?)/);
  return match ? match[1] : null;
}

/**
 * Maps a chord label to an exact hex color using mir_eval circle-of-fifths or chromatic pitch colormap
 * In mir_eval display.py, both 'fifths' and 'pitch' colormaps are 12-element arrays indexed by absolute
 * root semitone number (0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B).
 */
export function chordToMirEvalColor(
  chord: string,
  mode: "fifths" | "pitch" = "fifths"
): string {
  if (!chord || chord === "N" || chord === "X") {
    return MIR_EVAL_COLORMAPS.neutral_gray;
  }

  const root = extractChordRoot(chord);
  if (!root) {
    return MIR_EVAL_COLORMAPS.neutral_gray;
  }

  const qualityCategory = classifyChordQuality(chord);
  const semitoneIdx = CHROMATIC_ROOT_MAP[root] ?? 0;

  if (mode === "fifths") {
    if (qualityCategory === "maj") {
      return MIR_EVAL_COLORMAPS.fifths[semitoneIdx];
    } else if (qualityCategory === "min") {
      return MIR_EVAL_COLORMAPS.fifths_dark[semitoneIdx];
    } else if (qualityCategory === "other") {
      return MIR_EVAL_COLORMAPS.fifths_light[semitoneIdx];
    } else {
      return MIR_EVAL_COLORMAPS.neutral_gray;
    }
  } else {
    if (qualityCategory === "maj") {
      return MIR_EVAL_COLORMAPS.pitch[semitoneIdx];
    } else if (qualityCategory === "min") {
      return MIR_EVAL_COLORMAPS.pitch_dark[semitoneIdx];
    } else if (qualityCategory === "other") {
      return MIR_EVAL_COLORMAPS.pitch_light[semitoneIdx];
    } else {
      return MIR_EVAL_COLORMAPS.neutral_gray;
    }
  }
}

// Automatically register mir_eval colormaps with Vega scheme registry
export function registerMirEvalSchemes(vegaInstance?: any) {
  const v = vegaInstance || vega;
  if (typeof v?.scheme === 'function') {
    try {
      v.scheme('mir_eval_fifths', MIR_EVAL_COLORMAPS.fifths);
      v.scheme('mir_eval_pitch', MIR_EVAL_COLORMAPS.pitch);
      v.scheme('mir_eval_fifths_light', MIR_EVAL_COLORMAPS.fifths_light);
      v.scheme('mir_eval_fifths_dark', MIR_EVAL_COLORMAPS.fifths_dark);
      v.scheme('mir_eval_pitch_light', MIR_EVAL_COLORMAPS.pitch_light);
      v.scheme('mir_eval_pitch_dark', MIR_EVAL_COLORMAPS.pitch_dark);
      v.scheme('fifths', MIR_EVAL_COLORMAPS.fifths);
      v.scheme('pitch', MIR_EVAL_COLORMAPS.pitch);
    } catch {
      // Ignore if already registered
    }
  }
}

// Register on load
registerMirEvalSchemes();
