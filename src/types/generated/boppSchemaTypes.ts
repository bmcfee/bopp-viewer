/* eslint-disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * THIS FILE WAS AUTOMATICALLY GENERATED AT COMPILE TIME FROM schemas/v1/*.json
 * DO NOT MODIFY THIS FILE BY HAND.
 * 
 * Generator: json-schema-to-typescript (TypeScript counterpart of datamodel-code-generator)
 * Source: https://github.com/bmcfee/bopp schemas/v1/annotation.json
 */

/**
 * The metadata describing the annotation
 */
export type AnnotationMetadata = (HumanAnnotationMetadata | AlgorithmAnnotationMetadata | CrowdSourcedAnnotationMetadata | SensorAnnotationMetadata | DerivedAnnotationMetadata | AnnotationMetadataOther)
/**
 * The parallel array of time/space boundaries (e.g., time_interval, point)
 */
export type AnyExtent = (Times | TimeIntervalExtent | TimeFrequencyBoxExtent | PixelBoxExtent | ScoreQuarterNotes | ScoreInterval | MIDITicks | MIDIInterval)
/**
 * The parallel array of values (e.g., beat, chord)
 */
export type AnyPayload = (BeatPositionPayload | ChordPayload | Key_ModePayload | LyricsPayload | Mood_ThayerPayload | Note_HzPayload | Note_MidiPayload | ObjectPayload | OnsetPayload | Pitch_ContourPayload | RelationPayload | Multi_SegmentPayload | Segment_OpenPayload | Tag_OpenPayload | TempoPayload)
/**
 * Optional parallel array of likelihoods or votes
 */
export type AnyConfidence = (ConfidenceByInterAnnotatorAgreement | LikelihoodConfidence | VarianceConfidence)

export interface Annotation {
/**
 * Unique identifier generated via UUIDv5 based on canonical annotation content
 */
id?: string
/**
 * List of parent annotation IDs from which this annotation was derived
 */
parents?: string[]
media_id: string
/**
 * The Semantic Version of the BOPP schema (e.g., 1.0)
 */
bopp_version: string
metadata?: AnnotationMetadata
extent?: AnyExtent
payload: AnyPayload
confidence?: AnyConfidence
/**
 * Unstructured storage area for arbitrary user-defined data
 */
sandbox?: {
[k: string]: any
}
[k: string]: any
}
/**
 * Metadata for annotations created by human annotators.
 */
export interface HumanAnnotationMetadata {
metadata_type: "human"
/**
 * A unique identifier for the human annotator.
 */
annotator_id: string
/**
 * The tool or software used by the annotator.
 */
tool: string
[k: string]: any
}
/**
 * Metadata for annotations created by algorithms or models.
 */
export interface AlgorithmAnnotationMetadata {
metadata_type: "algorithm"
/**
 * A unique identifier for the algorithm.
 */
algorithm_id: string
/**
 * The version number of the algorithm.
 */
version: string
/**
 * A object containing the parameters used by the algorithm.
 */
parameters: {
[k: string]: any
}
[k: string]: any
}
/**
 * Metadata for annotations created by crowdsourcing.
 */
export interface CrowdSourcedAnnotationMetadata {
metadata_type: "crowd"
/**
 * The platform or service used for crowdsourcing the annotations.
 */
platform: string
/**
 * The number of annotators contributing to this annotation.
 */
num_annotators: number
/**
 * The method used to reach consensus among annotators (e.g., majority vote, expert review).
 */
consensus: string
[k: string]: any
}
/**
 * Metadata for annotations created by sensors or hardware.
 */
export interface SensorAnnotationMetadata {
metadata_type: "sensor"
/**
 * A unique identifier for the sensor.
 */
device: string
/**
 * A object containing the settings of the device.
 */
settings: {
[k: string]: any
}
[k: string]: any
}
/**
 * Metadata describing an annotation produced by transforming or aggregating parent annotation(s).
 */
export interface DerivedAnnotationMetadata {
metadata_type: "derived"
/**
 * The name or identifier of the operation/transform applied (e.g., 'trim', 'filter_by', 'to_times').
 */
transform: string
/**
 * Key-value mapping of parameters passed to the transform function.
 */
parameters?: {
[k: string]: any
}
/**
 * Software name and/or version performing the derivation (e.g., 'bopp==1.0.0').
 */
software?: string
/**
 * Optional human-readable description or rationale for the derivation.
 */
description?: string
[k: string]: any
}
/**
 * Metadata for annotations from unknown sources
 */
export interface AnnotationMetadataOther {
metadata_type: "other"
/**
 * Notes or comments about the annotation.
 */
notes: string
[k: string]: any
}
export interface Times {
extent_type: "time"
/**
 * An array of time values.
 */
time: number[]
[k: string]: any
}
export interface TimeIntervalExtent {
extent_type: "time_interval"
/**
 * Array of interval start times in seconds.
 */
time: number[]
/**
 * Array of interval durations in seconds.
 */
duration: number[]
[k: string]: any
}
export interface TimeFrequencyBoxExtent {
extent_type: "time_frequency_box"
/**
 * Array of start times in seconds.
 */
time: number[]
/**
 * Array of box durations in seconds.
 */
duration: number[]
/**
 * Array of minimum frequencies in Hz.
 */
freq_min: number[]
/**
 * Array of maximum frequencies in Hz.
 */
freq_max: number[]
[k: string]: any
}
export interface PixelBoxExtent {
extent_type: "pixel_box"
/**
 * Array of x-coordinates in pixels.
 */
x: number[]
/**
 * Array of box widths in pixels.
 */
width: number[]
/**
 * Array of y-coordinates in pixels.
 */
y: number[]
/**
 * Array of box heights in pixels.
 */
height: number[]
[k: string]: any
}
export interface ScoreQuarterNotes {
extent_type: "score_quarter"
/**
 * An array of fractional quarter values.
 */
quarter: []|[number]|[number, number][]
[k: string]: any
}
export interface ScoreInterval {
extent_type: "score_interval"
/**
 * Array of interval start times in fractional quarter notes.
 */
quarter: []|[number]|[number, number][]
/**
 * Array of interval durations in fractional quarter notes.
 */
duration: []|[number]|[number, number][]
[k: string]: any
}
export interface MIDITicks {
extent_type: "midi_tick"
/**
 * An array of MIDI tick values.
 */
tick: number[]
[k: string]: any
}
export interface MIDIInterval {
extent_type: "midi_interval"
/**
 * Array of interval start times in MIDI ticks.
 */
tick: number[]
/**
 * Array of interval durations in MIDI ticks.
 */
duration: number[]
[k: string]: any
}
export interface BeatPositionPayload {
payload_type: "beat"
/**
 * The metric position of the beat within the measure (e.g., 1 for downbeat, 2, 3, 4).
 */
value: number[]
[k: string]: any
}
export interface ChordPayload {
payload_type: "chord"
/**
 * A musical chord string in extended Harte notation.
 */
value: string[]
[k: string]: any
}
export interface Key_ModePayload {
payload_type: "key_mode"
/**
 * Key and optional mode (major/minor or Greek modes)
 */
value: string[]
[k: string]: any
}
export interface LyricsPayload {
payload_type: "lyrics"
/**
 * Open strings for lyrics annotations
 */
value: string[]
[k: string]: any
}
export interface Mood_ThayerPayload {
payload_type: "mood_thayer"
/**
 * Valence
 */
valence: number[]
/**
 * Arousal
 */
arousal: number[]
[k: string]: any
}
export interface Note_HzPayload {
payload_type: "note_hz"
/**
 * Note pitches in Hz
 */
value: number[]
[k: string]: any
}
export interface Note_MidiPayload {
payload_type: "note_midi"
/**
 * Note pitches in (fractional) MIDI note numbers
 */
value: number[]
[k: string]: any
}
export interface ObjectPayload {
payload_type: "object"
/**
 * Annotations consisting of structured object data
 */
value: {
[k: string]: any
}[]
[k: string]: any
}
export interface OnsetPayload {
payload_type: "onset"
/**
 * Onset event markers
 */
value: any[]
[k: string]: any
}
export interface Pitch_ContourPayload {
payload_type: "pitch_contour"
/**
 * Pitch contours: (index, frequency, voicing)
 */
value: {
[k: string]: any
}[]
[k: string]: any
}
/**
 * Columnar payload defining relationships between works (covers, quotes, etc).
 */
export interface RelationPayload {
payload_type: "relation"
performance_id: string
/**
 * Array of referenced work or clique identifiers.
 */
value: string[]
/**
 * Array of relation types parallel to work_id.
 */
relation?: ("cover" | "quote" | "medley_part" | "sample" | "interpolation" | "remix" | "live_performance")[]
}
export interface Multi_SegmentPayload {
payload_type: "multi_segment"
/**
 * Multi-level segmentation labels.
 */
label: string[]
/**
 * Multi-level segmentation levels.
 */
level: number[]
[k: string]: any
}
export interface Segment_OpenPayload {
payload_type: "segment_open"
/**
 * Open vocabulary segment labels
 */
value: string[]
[k: string]: any
}
export interface Tag_OpenPayload {
payload_type: "tag_open"
/**
 * Open tag vocabularies allow all strings
 */
value: string[]
[k: string]: any
}
export interface TempoPayload {
payload_type: "tempo"
/**
 * Tempo measurements, in beats per minute (BPM)
 */
value: number[]
[k: string]: any
}
export interface ConfidenceByInterAnnotatorAgreement {
confidence_type: "agreement"
/**
 * The number of annotators who produced all observations
 */
n_annotators_common?: number
/**
 * The fraction of annotators agreeing on this measurement
 */
confidence: number[]
/**
 * The number of annotators who produced each observation
 */
n_annotators?: number[]
[k: string]: any
}
export interface LikelihoodConfidence {
confidence_type: "likelihood"
/**
 * The likelihood (probability) of each observation
 */
confidence: number[]
[k: string]: any
}
export interface VarianceConfidence {
confidence_type: "variance"
/**
 * The variance of each observation
 */
confidence: number[]
[k: string]: any
}


// Convenience type aliases for BOPP integration
export type BoppAnnotation = Annotation;
export type BoppExtent = AnyExtent;
export type BoppPayload = AnyPayload;
export type BoppConfidence = AnyConfidence;
export type BoppMetadata = AnnotationMetadata;
