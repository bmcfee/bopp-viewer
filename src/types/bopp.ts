/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TypeScript definitions for BOPP (Bounded Observation Payload Protocol) v1.0
 * Based on https://github.com/bmcfee/bopp schemas/v1
 */

// Re-export auto-generated JSON Schema types (compiled at build time via json-schema-to-typescript)
export * from './generated/boppSchemaTypes';

export interface Grouping {
  name: string;
  ids: number[];
  labels?: Record<string, number>;
}

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
  groupings?: Grouping[];
}

// ==========================================
// Extents (20 Canonical Extents in BOPP v1)
// ==========================================
export type ExtentType =
  | 'time'
  | 'time_interval'
  | 'time_frequency_box'
  | 'time_uniform'
  | 'pixel'
  | 'pixel_box'
  | 'text'
  | 'text_interval'
  | 'spherical'
  | 'spherical_time'
  | 'spherical_time_interval'
  | 'cartesian'
  | 'cartesian_time'
  | 'cartesian_time_interval'
  | 'score_quarter'
  | 'score_interval'
  | 'score_quarter_float'
  | 'score_interval_float'
  | 'midi_tick'
  | 'midi_interval';

export interface TimeExtent {
  extent_type: 'time';
  time: number[];
}
export type TimesExtent = TimeExtent;

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

export interface UniformTimeExtent {
  extent_type: 'time_uniform';
  start_time: number;
  sampling_period: number;
}
export type TimeUniformExtent = UniformTimeExtent;

export interface PixelExtent {
  extent_type: 'pixel';
  x: number[];
  y: number[];
}

export interface PixelBoxExtent {
  extent_type: 'pixel_box';
  x: number[];
  width: number[];
  y: number[];
  height: number[];
}

export interface TextExtent {
  extent_type: 'text';
  offset: number[];
}

export interface TextIntervalExtent {
  extent_type: 'text_interval';
  offset: number[];
  length: number[];
}

export interface SphericalExtent {
  extent_type: 'spherical';
  azimuth: number[];
  elevation: number[];
  radius: number[];
}

export interface SphericalTimeExtent {
  extent_type: 'spherical_time';
  time: number[];
  azimuth: number[];
  elevation: number[];
  radius: number[];
}

export interface SphericalTimeIntervalExtent {
  extent_type: 'spherical_time_interval';
  time: number[];
  duration: number[];
  azimuth: number[];
  elevation: number[];
  radius: number[];
}

export interface CartesianExtent {
  extent_type: 'cartesian';
  x: number[];
  y: number[];
  z: number[];
}

export interface CartesianTimeExtent {
  extent_type: 'cartesian_time';
  time: number[];
  x: number[];
  y: number[];
  z: number[];
}

export interface CartesianTimeIntervalExtent {
  extent_type: 'cartesian_time_interval';
  time: number[];
  duration: number[];
  x: number[];
  y: number[];
  z: number[];
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

export interface ScoreQuarterFloatExtent {
  extent_type: 'score_quarter_float';
  quarter: number[];
}

export interface ScoreIntervalFloatExtent {
  extent_type: 'score_interval_float';
  quarter: number[];
  duration: number[];
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
  | TimeExtent
  | TimeIntervalExtent
  | TimeFrequencyBoxExtent
  | UniformTimeExtent
  | PixelExtent
  | PixelBoxExtent
  | TextExtent
  | TextIntervalExtent
  | SphericalExtent
  | SphericalTimeExtent
  | SphericalTimeIntervalExtent
  | CartesianExtent
  | CartesianTimeExtent
  | CartesianTimeIntervalExtent
  | ScoreQuarterExtent
  | ScoreIntervalExtent
  | ScoreQuarterFloatExtent
  | ScoreIntervalFloatExtent
  | MidiTickExtent
  | MidiIntervalExtent;

// ==========================================
// Payloads
// ==========================================
export type PayloadType =
  | 'beat'
  | 'chord'
  | 'ext'
  | 'frequency_hz'
  | 'key_mode'
  | 'lyrics'
  | 'marker'
  | 'mood_thayer'
  | 'note'
  | 'note_midi'
  | 'object'
  | 'relation'
  | 'tag'
  | 'tempo'
  // Deprecated schemas kept for transitional compatibility
  | 'note_hz'
  | 'onset'
  | 'pitch_contour'
  | 'multi_segment'
  | 'segment_open'
  | 'tag_open';

export interface BeatPayload {
  payload_type: 'beat';
  value: number[];
}

export interface ChordPayload {
  payload_type: 'chord';
  value: string[];
}

export interface ExtensionPayload {
  payload_type: 'ext';
  ext_schema: string;
  value: unknown[];
}

export interface FrequencyHzPayload {
  payload_type: 'frequency_hz';
  value: number[];
  voiced?: boolean[];
}

export interface KeyModePayload {
  payload_type: 'key_mode';
  value: string[];
}

export interface LyricsPayload {
  payload_type: 'lyrics';
  value: string[];
  language: string;
}

export interface MarkerPayload {
  payload_type: 'marker';
  description: string;
}

export interface MoodThayerPayload {
  payload_type: 'mood_thayer';
  valence: number[];
  arousal: number[];
}

export interface NotePayload {
  payload_type: 'note';
  value: string[];
}

export interface NoteMidiPayload {
  payload_type: 'note_midi';
  value: (number | string)[];
}

export interface ObjectPayload {
  payload_type: 'object';
  value: Record<string, unknown>[];
  description?: string;
}

export interface RelationPayload {
  payload_type: 'relation';
  performance_id: string;
  value: string[];
  relation?: ('cover' | 'quote' | 'medley_part' | 'sample' | 'interpolation' | 'remix' | 'live_performance')[];
}

export interface TagPayload {
  payload_type: 'tag';
  value: string[];
}

export interface TempoPayload {
  payload_type: 'tempo';
  value: number[];
}

// Deprecated payload interfaces
export interface NoteHzPayload {
  payload_type: 'note_hz';
  value: (number | string)[];
  voiced?: boolean[];
}

export interface OnsetPayload {
  payload_type: 'onset';
  value?: unknown[];
  description?: string;
}

export interface PitchContourPayload {
  payload_type: 'pitch_contour';
  value: {
    index?: number;
    frequency: number;
    voicing?: number | boolean;
  }[];
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

export type BoppPayload =
  | BeatPayload
  | ChordPayload
  | ExtensionPayload
  | FrequencyHzPayload
  | KeyModePayload
  | LyricsPayload
  | MarkerPayload
  | MoodThayerPayload
  | NotePayload
  | NoteMidiPayload
  | ObjectPayload
  | RelationPayload
  | TagPayload
  | TempoPayload
  | NoteHzPayload
  | OnsetPayload
  | PitchContourPayload
  | MultiSegmentPayload
  | SegmentOpenPayload
  | TagOpenPayload;

// ==========================================
// Confidences
// ==========================================
export type ConfidenceType = 'agreement' | 'likelihood' | 'variance';

export interface AgreementConfidence {
  confidence_type: 'agreement';
  confidence: number[];
  num_annotators?: number[];
  num_annotators_common?: number;
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
  z?: number;
  width?: number;
  height?: number;
  offset?: number;
  length?: number;
  azimuth?: number;
  elevation?: number;
  radius?: number;
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
  hz?: number | null;
  midi?: number | null;
  note_name?: string | null;
  frequency?: number;
  voicing?: number;
  voiced?: boolean;
  relation?: string;
  description?: string;
  language?: string;
  confidence?: number;
  confidence_variance?: number;
  confidence_type?: string;
  confidence_pct?: number;
  confidence_label?: string;
  confidence_meter?: string;
  confidence_grade?: 'high' | 'medium' | 'low';
  confidence_color?: string;
  confidence_duration?: number;
  num_annotators?: number;
  num_annotators_common?: number;
  n_annotators?: number;
  n_annotators_common?: number;
  n_agree?: number;
  agreement_ratio_str?: string;
  agreement_text?: string;
  agreement_icons?: string;
  confidence_std?: number;
  confidence_ci_margin?: number;
  value_ci_lower?: number;
  value_ci_upper?: number;
  frequency_ci_lower?: number;
  frequency_ci_upper?: number;
  valence_ci_lower?: number;
  valence_ci_upper?: number;
  arousal_ci_lower?: number;
  arousal_ci_upper?: number;
  [key: string]: unknown;
}
