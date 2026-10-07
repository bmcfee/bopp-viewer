/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TypeScript definitions for BOPP (Bounded Observation Payload Protocol) v1.0
 * Based on https://github.com/bmcfee/bopp schemas/v1
 */

// Re-export auto-generated JSON Schema types (compiled at build time via json-schema-to-typescript)
export * from './generated/boppSchemaTypes';

export interface BoppAnnotation {
  id?: string;
  parents?: string[];
  media_id: string;
  bopp_version: string;
  metadata?: BoppMetadata;
  extent?: BoppExtent;
  payload: BoppPayload;
  confidence?: BoppConfidence;
  sandbox?: Record<string, unknown>;
}

// ==========================================
// Extents
// ==========================================
export type ExtentType =
  | 'time'
  | 'time_interval'
  | 'time_frequency_box'
  | 'pixel_box'
  | 'score_quarter'
  | 'score_interval'
  | 'midi_tick'
  | 'midi_interval';

export interface TimesExtent {
  extent_type: 'time';
  time: number[];
}

export interface TimeIntervalExtent {
  extent_type: 'time_interval';
  time: number[];
  duration: number[];
}

export interface TimeFrequencyBoxExtent {
  extent_type: 'time_frequency_box';
  time: number[];
  duration: number[];
  freq_min: number[];
  freq_max: number[];
}

export interface PixelBoxExtent {
  extent_type: 'pixel_box';
  x: number[];
  width: number[];
  y: number[];
  height: number[];
}

export type Fraction = [number, number]; // [numerator, denominator]

export interface ScoreQuarterExtent {
  extent_type: 'score_quarter';
  quarter: Fraction[];
}

export interface ScoreIntervalExtent {
  extent_type: 'score_interval';
  quarter: Fraction[];
  duration: Fraction[];
}

export interface MidiTickExtent {
  extent_type: 'midi_tick';
  tick: number[];
}

export interface MidiIntervalExtent {
  extent_type: 'midi_interval';
  tick: number[];
  duration: number[];
}

export type BoppExtent =
  | TimesExtent
  | TimeIntervalExtent
  | TimeFrequencyBoxExtent
  | PixelBoxExtent
  | ScoreQuarterExtent
  | ScoreIntervalExtent
  | MidiTickExtent
  | MidiIntervalExtent;

// ==========================================
// Payloads
// ==========================================
export type PayloadType =
  | 'beat'
  | 'chord'
  | 'key_mode'
  | 'lyrics'
  | 'mood_thayer'
  | 'note_hz'
  | 'note_midi'
  | 'object'
  | 'onset'
  | 'pitch_contour'
  | 'relation'
  | 'multi_segment'
  | 'segment_open'
  | 'tag_open'
  | 'tempo';

export interface BeatPayload {
  payload_type: 'beat';
  value: number[];
}

export interface ChordPayload {
  payload_type: 'chord';
  value: string[];
}

export interface KeyModePayload {
  payload_type: 'key_mode';
  value: string[];
}

export interface LyricsPayload {
  payload_type: 'lyrics';
  value: string[];
}

export interface MoodThayerPayload {
  payload_type: 'mood_thayer';
  valence: number[];
  arousal: number[];
}

export interface NoteHzPayload {
  payload_type: 'note_hz';
  value: number[];
}

export interface NoteMidiPayload {
  payload_type: 'note_midi';
  value: number[];
}

export interface ObjectPayload {
  payload_type: 'object';
  value: Record<string, unknown>[];
}

export interface OnsetPayload {
  payload_type: 'onset';
  value: unknown[];
}

export interface PitchContourPayload {
  payload_type: 'pitch_contour';
  value: {
    index?: number;
    frequency: number;
    voicing?: number | boolean;
  }[];
}

export interface RelationPayload {
  payload_type: 'relation';
  performance_id: string;
  value: string[];
  relation?: string[];
}

export interface MultiSegmentPayload {
  payload_type: 'multi_segment';
  label: string[];
  level: number[];
}

export interface SegmentOpenPayload {
  payload_type: 'segment_open';
  value: string[];
}

export interface TagOpenPayload {
  payload_type: 'tag_open';
  value: string[];
}

export interface TempoPayload {
  payload_type: 'tempo';
  value: number[];
}

export type BoppPayload =
  | BeatPayload
  | ChordPayload
  | KeyModePayload
  | LyricsPayload
  | MoodThayerPayload
  | NoteHzPayload
  | NoteMidiPayload
  | ObjectPayload
  | OnsetPayload
  | PitchContourPayload
  | RelationPayload
  | MultiSegmentPayload
  | SegmentOpenPayload
  | TagOpenPayload
  | TempoPayload;

// ==========================================
// Confidences
// ==========================================
export type ConfidenceType = 'agreement' | 'likelihood' | 'variance';

export interface AgreementConfidence {
  confidence_type: 'agreement';
  confidence: number[];
  n_annotators?: number[];
  n_annotators_common?: number;
}

export interface LikelihoodConfidence {
  confidence_type: 'likelihood';
  confidence: number[];
}

export interface VarianceConfidence {
  confidence_type: 'variance';
  confidence: number[];
}

export type BoppConfidence =
  | AgreementConfidence
  | LikelihoodConfidence
  | VarianceConfidence;

// ==========================================
// Metadata
// ==========================================
export type MetadataType =
  | 'human'
  | 'algorithm'
  | 'crowd'
  | 'sensor'
  | 'derived'
  | 'other';

export interface BoppMetadata {
  metadata_type?: MetadataType;
  annotator_id?: string;
  tool?: string;
  description?: string;
  timestamp?: string;
  version?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

// ==========================================
// Flattened Tabular Record for Data Grid & Vega
// ==========================================
export interface TabularRecord {
  __index: number;
  time?: number;
  duration?: number;
  freq_min?: number;
  freq_max?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  quarter?: number;
  quarter_str?: string;
  quarter_duration?: number;
  quarter_duration_str?: string;
  tick?: number;
  value?: string | number | boolean | Record<string, unknown>;
  label?: string;
  level?: number;
  valence?: number;
  arousal?: number;
  relation?: string;
  confidence?: number;
  confidence_variance?: number;
  n_annotators?: number;
  [key: string]: unknown;
}
