/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Preloaded BOPP Benchmark and Showcase Datasets
 */

import type { BoppAnnotation } from '../types/bopp';

export interface SampleFileInfo {
  id: string;
  filename: string;
  title: string;
  category: 'benchmark' | 'music' | 'bioacoustic' | 'emotion' | 'score' | 'omr';
  format: 'json' | 'msgpack';
  description: string;
  extentType: string;
  payloadType: string;
  confidenceType?: string;
  data: BoppAnnotation;
  rawMsgpackBase64?: string;
}

// Drive benchmark dataset from bmcfee/bopp
const DRIVE_DATA: BoppAnnotation = {
  media_id: "mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "Isophonics / MIREX",
    tool: "Sonic Visualiser / mir_eval"
  },
  sandbox: {
    curator: "Brian McFee / LabROSA",
    dataset: "Isophonics Reference Corpus",
    description: "Harmonic chord annotations for R.E.M. - Drive from the Isophonics reference corpus",
    annotation_type: "chord",
    version: "1.0",
    license: "CC-BY-4.0",
    created: "2024-01-15T12:00:00Z"
  },
  extent: {
    extent_type: "time_interval",
    time: [
      0.0, 2.136, 3.065, 6.966, 16.997, 20.526, 22.663, 24.613,
      26.564, 28.514, 31.300, 32.415, 33.344, 34.366, 36.316, 38.266,
      40.310, 42.260, 44.304, 46.161, 48.205, 50.805, 52.013, 53.963,
      55.914, 57.957, 59.815, 62.601, 63.716, 64.737, 65.759, 67.617,
      69.660, 71.610, 73.654, 75.604, 77.555, 79.505, 83.406, 85.357,
      87.307, 89.258, 91.208, 93.344, 94.087, 95.202, 96.131, 97.152,
      99.010, 101.053, 103.097, 104.954, 106.812, 108.948, 110.899
    ],
    duration: [
      2.136, 0.929, 3.901, 10.031, 3.529, 2.136, 1.950, 1.951,
      1.950, 2.786, 1.115, 0.929, 1.022, 1.950, 1.950, 2.043,
      1.950, 2.043, 1.858, 2.043, 2.601, 1.207, 1.950, 1.951,
      2.043, 1.858, 2.786, 1.115, 1.022, 1.022, 1.858, 2.043,
      1.950, 2.044, 1.950, 1.951, 1.950, 3.901, 1.951, 1.950,
      1.951, 1.950, 2.136, 0.743, 1.115, 0.929, 1.022, 1.858,
      2.043, 2.044, 1.857, 1.858, 2.136, 1.950, 3.808
    ]
  },
  payload: {
    payload_type: "chord",
    value: [
      "N", "A:min", "D:maj", "G:maj", "F:maj/3", "A:min", "D:maj", "G:maj",
      "F:maj/3", "G:maj", "C:maj", "F:maj", "G:maj", "A:min", "D:maj", "G:maj",
      "F:maj/3", "A:min", "D:maj", "G:maj", "F:maj/3", "G:maj", "C:maj", "F:maj",
      "G:maj", "C:maj", "G:maj", "C:maj", "F:maj", "G:maj", "A:min", "D:maj",
      "G:maj", "F:maj/3", "A:min", "D:maj", "G:maj", "F:maj/3", "G:maj", "C:maj",
      "F:maj", "G:maj", "C:maj", "G:maj", "C:maj", "F:maj", "G:maj", "A:min",
      "D:maj", "G:maj", "F:maj/3", "A:min", "D:maj", "G:maj", "F:maj/3"
    ]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [
      0.682, 0.306, 0.406, 0.755, 0.535, 0.511, 0.825, 0.812,
      0.729, 0.895, 0.912, 0.745, 0.884, 0.792, 0.841, 0.803,
      0.718, 0.765, 0.832, 0.854, 0.692, 0.881, 0.924, 0.783,
      0.859, 0.912, 0.874, 0.893, 0.762, 0.834, 0.771, 0.849,
      0.823, 0.715, 0.758, 0.836, 0.819, 0.702, 0.885, 0.908,
      0.794, 0.867, 0.921, 0.865, 0.891, 0.758, 0.829, 0.785,
      0.841, 0.818, 0.722, 0.749, 0.825, 0.809, 0.715
    ]
  }
};

// Longbeats benchmark dataset from bmcfee/bopp
const LONGBEATS_DATA: BoppAnnotation = {
  media_id: "audio:longbeats_reference_track",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "madmom_beat_tracker",
    version: "0.16.1",
    parameters: { fps: 100 }
  },
  sandbox: {
    description: "Reference rhythmic beat markers with instantaneous beat time points",
    source: "MIREX Beat Tracking Evaluation Dataset"
  },
  extent: {
    extent_type: "time",
    time: Array.from({ length: 80 }, (_, i) => +(i * 0.52).toFixed(3))
  },
  payload: {
    payload_type: "beat",
    value: Array.from({ length: 80 }, (_, i) => (i % 4) + 1)
  }
};

// Mozart Piano Sonata K.545 Piano Roll
const mozartNotes = [
  { t: 0.0, d: 0.9, midi: 60, conf: 0.95 },
  { t: 1.0, d: 0.9, midi: 64, conf: 0.95 },
  { t: 2.0, d: 0.45, midi: 67, conf: 0.92 },
  { t: 2.5, d: 0.45, midi: 71, conf: 0.88 },
  { t: 3.0, d: 0.9, midi: 72, conf: 0.96 },
  { t: 4.0, d: 0.9, midi: 67, conf: 0.93 },
  { t: 5.0, d: 0.3, midi: 69, conf: 0.90 },
  { t: 5.33, d: 0.3, midi: 67, conf: 0.91 },
  { t: 5.66, d: 0.3, midi: 65, conf: 0.89 },
  { t: 6.0, d: 0.3, midi: 67, conf: 0.92 },
  { t: 6.33, d: 0.3, midi: 65, conf: 0.90 },
  { t: 6.66, d: 0.3, midi: 64, conf: 0.91 },
  { t: 7.0, d: 0.9, midi: 65, conf: 0.94 },
  { t: 8.0, d: 0.9, midi: 64, conf: 0.95 },
  { t: 9.0, d: 0.9, midi: 62, conf: 0.93 },
  { t: 10.0, d: 1.8, midi: 60, conf: 0.98 },
  // Alberti bass line accompaniment
  { t: 0.0, d: 0.45, midi: 48, conf: 0.85 },
  { t: 0.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 1.0, d: 0.45, midi: 52, conf: 0.85 },
  { t: 1.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 2.0, d: 0.45, midi: 48, conf: 0.85 },
  { t: 2.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 3.0, d: 0.45, midi: 52, conf: 0.85 },
  { t: 3.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 4.0, d: 0.45, midi: 53, conf: 0.85 },
  { t: 4.5, d: 0.45, midi: 57, conf: 0.85 },
  { t: 5.0, d: 0.45, midi: 53, conf: 0.85 },
  { t: 5.5, d: 0.45, midi: 57, conf: 0.85 },
  { t: 6.0, d: 0.45, midi: 48, conf: 0.85 },
  { t: 6.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 7.0, d: 0.45, midi: 53, conf: 0.85 },
  { t: 7.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 8.0, d: 0.45, midi: 48, conf: 0.85 },
  { t: 8.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 9.0, d: 0.45, midi: 50, conf: 0.85 },
  { t: 9.5, d: 0.45, midi: 55, conf: 0.85 },
  { t: 10.0, d: 1.8, midi: 48, conf: 0.90 }
].sort((a, b) => a.t - b.t);

// Helper to convert decimal score quarter times and durations into rational fractions [num, denom]
function floatToFraction(val: number): [number, number] {
  const rounded = Math.round(val * 100);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(rounded, 100);
  return [rounded / g, 100 / g];
}

const MOZART_DATA: BoppAnnotation = {
  media_id: "audio:mozart_sonata_c_k545",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_01",
    tool: "midi_score_transcriber"
  },
  sandbox: {
    piece: "Mozart Piano Sonata No. 16 in C major, K. 545",
    description: "Mozart Piano Sonata No. 16 in C major, K. 545 (Allegro opening theme) with Time Interval extent in seconds"
  },
  extent: {
    extent_type: "time_interval",
    time: mozartNotes.map(n => n.t),
    duration: mozartNotes.map(n => n.d)
  },
  payload: {
    payload_type: "note_midi",
    value: mozartNotes.map(n => n.midi)
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: mozartNotes.map(n => n.conf)
  }
};

// Mozart K.545: MIDI Interval Extent (Standard PPQ=480, BPM=120 ticks)
const MOZART_MIDI_DATA: BoppAnnotation = {
  media_id: "audio:mozart_sonata_c_k545_midi",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_01",
    tool: "standard_midi_file_converter"
  },
  sandbox: {
    piece: "Mozart Piano Sonata No. 16 in C major, K. 545",
    description: "Mozart Piano Sonata No. 16 in C major, K. 545 with MIDI Interval extent (PPQ=480, BPM=120 standard ticks)"
  },
  extent: {
    extent_type: "midi_interval",
    tick: mozartNotes.map(n => Math.round(n.t * 960)),
    duration: mozartNotes.map(n => Math.round(n.d * 960)),
  },
  payload: {
    payload_type: "note_midi",
    value: mozartNotes.map(n => n.midi),
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: mozartNotes.map(n => n.conf),
  },
};

// Mozart K.545: Score Interval Extent (Fractional Quarter Notes [numerator, denominator])
const MOZART_SCORE_DATA: BoppAnnotation = {
  media_id: "audio:mozart_sonata_c_k545_score",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_01",
    tool: "musicxml_score_transcriber"
  },
  sandbox: {
    piece: "Mozart Piano Sonata No. 16 in C major, K. 545",
    description: "Mozart Piano Sonata No. 16 in C major, K. 545 with Score Interval extent (quarter note rational fractions [num, denom])"
  },
  extent: {
    extent_type: "score_interval",
    quarter: mozartNotes.map(n => floatToFraction(n.t * 2)),
    duration: mozartNotes.map(n => floatToFraction(n.d * 2)),
  },
  payload: {
    payload_type: "note_midi",
    value: mozartNotes.map(n => n.midi),
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: mozartNotes.map(n => n.conf),
  },
};

// Piano Roll with Categorical Note Names (C3, D3, E3, G3, A3, C4) on Numerical MIDI Axis
const NOTE_NAMES_PIANOROLL_DATA: BoppAnnotation = {
  media_id: "audio:scale_note_names_pianoroll",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_01",
    tool: "piano_roll_transcriber"
  },
  sandbox: {
    piece: "Diatonic Motif (Note Names: C3, D3, E3, G3, A3, C4)",
    description: "time_interval extent with note_midi string names demonstrating non-equidistant numerical pitch axis"
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 0.6, 1.2, 1.8, 2.4, 3.0],
    duration: [0.5, 0.5, 0.5, 0.5, 0.5, 0.8]
  },
  payload: {
    payload_type: "note_midi",
    value: ["C3", "D3", "E3", "G3", "A3", "C4"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.95, 0.92, 0.96, 0.94, 0.99]
  }
};

// Piano Roll with Note Frequencies in Hz (C3=130.81, D3=146.83, E3=164.81, G3=196.00, C4=261.63 Hz)
const FREQUENCY_HZ_PIANOROLL_DATA: BoppAnnotation = {
  media_id: "audio:frequency_hz_pianoroll",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "pyin_f0_segmenter",
    version: "1.0.2",
    parameters: {
      fmin: 65.4,
      fmax: 1046.5,
    },
  },
  sandbox: {
    piece: "Acoustic Note Segments in Hz (Log Frequency Pitch Axis)",
    description: "time_interval extent with frequency_hz payload: note pitches in Hz with voiced flags mapped to numerical log-frequency piano roll"
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 0.6, 1.2, 1.8, 2.4, 3.0],
    duration: [0.5, 0.5, 0.5, 0.5, 0.5, 0.8]
  },
  payload: {
    payload_type: "frequency_hz",
    value: [130.81, 146.83, 164.81, 196.00, 220.00, 261.63],
    voiced: [true, true, true, true, true, true]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.94, 0.91, 0.95, 0.93, 0.97, 0.96]
  }
};

// Bioacoustic Spectrogram Time-Frequency Bounding Boxes
const tfBoxes = [
  { t: 0.4, d: 0.8, fmin: 1800, fmax: 4200, tag: "Robin Chirp", conf: 0.94 },
  { t: 1.5, d: 1.2, fmin: 2200, fmax: 5800, tag: "Cardinal Song", conf: 0.89 },
  { t: 3.1, d: 0.6, fmin: 3500, fmax: 7200, tag: "Warbler Trill", conf: 0.96 },
  { t: 4.2, d: 1.5, fmin: 1200, fmax: 3100, tag: "Sparrow Call", conf: 0.82 },
  { t: 6.0, d: 0.9, fmin: 2100, fmax: 4900, tag: "Cardinal Song", conf: 0.91 },
  { t: 7.5, d: 1.1, fmin: 3400, fmax: 6800, tag: "Warbler Trill", conf: 0.93 },
  { t: 9.0, d: 0.7, fmin: 1900, fmax: 4100, tag: "Robin Chirp", conf: 0.88 },
  { t: 10.2, d: 1.8, fmin: 800, fmax: 2400, tag: "Owl Hoot", conf: 0.97 }
];

const TF_DATA: BoppAnnotation = {
  media_id: "sensor:xeno_canto_record_4821",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "sensor",
    device: "AudioMoth v1.2",
    settings: { sample_rate: 48000, gain: "medium" }
  },
  sandbox: {
    tool: "BirdNET_Spectrogram_Detector",
    description: "Automated bioacoustic event detection in temperate forest habitat"
  },
  extent: {
    extent_type: "time_frequency_box",
    time: tfBoxes.map(b => b.t),
    duration: tfBoxes.map(b => b.d),
    freq_min: tfBoxes.map(b => b.fmin),
    freq_max: tfBoxes.map(b => b.fmax)
  },
  payload: {
    payload_type: "tag",
    value: tfBoxes.map(b => b.tag)
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: tfBoxes.map(b => b.conf)
  }
};

// 25-Annotator Crowd Consensus on Song Structure
const CROWD_AGREEMENT_DATA: BoppAnnotation = {
  media_id: "audio:pop_anthem_master",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "mturk_crowd_pool_25",
    tool: "crowd_audio_annotator",
    description: "Crowdsourced consensus annotation of musical form across 25 independent listeners",
    parameters: {
      pool_size: 25,
      agreement_metric: "fleiss_kappa",
      consensus_rule: "majority_vote"
    }
  },
  sandbox: {
    study: "Crowdsourced Music Form Consensus Benchmark",
    platform: "Amazon Mechanical Turk",
    qualification: "Ear-training & form identification qualification passed",
    workers_total: 25
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 12.5, 36.0, 48.0, 72.0, 88.0, 112.0],
    duration: [12.5, 23.5, 12.0, 24.0, 16.0, 24.0, 16.0]
  },
  payload: {
    payload_type: "tag",
    value: ["Intro", "Verse 1", "Pre-Chorus", "Chorus 1", "Bridge", "Chorus 2", "Outro"]
  },
  confidence: {
    confidence_type: "agreement",
    num_annotators_common: 25,
    num_annotators: [25, 25, 24, 25, 23, 25, 25],
    confidence: [0.96, 0.88, 0.68, 0.92, 0.72, 0.96, 0.84]
  }
};

// Mood Thayer Circumplex Trajectory
const moodPoints = Array.from({ length: 20 }, (_, i) => {
  const angle = (i / 20) * 2 * Math.PI;
  return {
    t: i * 2.0,
    valence: +(0.6 * Math.cos(angle) + 0.1 * Math.sin(angle * 2)).toFixed(3),
    arousal: +(0.7 * Math.sin(angle) + 0.1 * Math.cos(angle)).toFixed(3),
    variance: 0.04
  };
});

const MOOD_DATA: BoppAnnotation = {
  media_id: "track:cinematic_film_score_act1",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "affect_evaluator_group",
    tool: "AffectiveSlider_v2"
  },
  sandbox: {
    description: "Continuous dynamic affective appraisal on Russell-Thayer Circumplex space"
  },
  extent: {
    extent_type: "time",
    time: moodPoints.map(m => m.t)
  },
  payload: {
    payload_type: "mood_thayer",
    valence: moodPoints.map(m => m.valence),
    arousal: moodPoints.map(m => m.arousal)
  },
  confidence: {
    confidence_type: "variance",
    confidence: moodPoints.map(m => m.variance)
  }
};

// Musical score quarter fraction intervals
const SCORE_DATA: BoppAnnotation = {
  media_id: "score:chopin_prelude_cm",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "music_theorist_02",
    tool: "MuseScore_Analysis_Plugin"
  },
  sandbox: {
    piece: "Chopin Prelude in C minor Op. 28 No. 20",
    description: "Harmonic analysis over score intervals (quarter notes)"
  },
  extent: {
    extent_type: "score_interval",
    quarter: [[0, 1], [1, 2], [1, 1], [2, 1], [9, 4], [3, 1]],
    duration: [[1, 2], [1, 2], [1, 1], [1, 4], [3, 4], [1, 1]]
  },
  payload: {
    payload_type: "chord",
    value: ["C:maj", "G:maj", "A:min", "F:maj", "G:7", "C:maj"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.95, 0.92, 0.97, 0.94, 0.90, 0.99]
  }
};

// Optical Music Recognition Pixel Bounding Boxes
const PIXEL_DATA: BoppAnnotation = {
  media_id: "image:sheet_music_measure_01.png",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "Calvo_OMR_Neural_Segmenter",
    version: "1.4.0",
    parameters: { threshold: 0.85, iou: 0.5 }
  },
  sandbox: {
    tool: "Calvo_OMR_Neural_Segmenter",
    description: "Optical Music Recognition (OMR) bounding boxes on scanned score page"
  },
  extent: {
    extent_type: "pixel_box",
    x: [45, 240, 330, 390, 450, 520, 590],
    y: [120, 115, 95, 85, 75, 65, 90],
    width: [180, 75, 45, 45, 45, 50, 80],
    height: [65, 70, 110, 120, 130, 140, 20]
  },
  payload: {
    payload_type: "tag",
    value: [
      "Treble Clef",
      "Time Signature 4/4",
      "Quarter Note C4",
      "Quarter Note E4",
      "Quarter Note G4",
      "Quarter Note C5",
      "Measure Barline"
    ]
  }
};

// ---------------------------------------------------------------------------
// Multi-Extent Demonstrations: Same Payload with Different Notions of Extent
// ---------------------------------------------------------------------------

// 1. KEY_MODE: Global (No Extent at all)
const KEY_GLOBAL_DATA: BoppAnnotation = {
  media_id: "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_key_annotator",
    tool: "key_profile_evaluator"
  },
  sandbox: {
    curator: "Brian McFee",
    dataset: "Harmonic Reference Benchmarks",
    description: "Global musical key and mode distribution across the entire media object with multiple candidate annotations (75% C Major, 25% A Minor)",
  },
  payload: {
    payload_type: "key_mode",
    value: ["C:maj", "A:min"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.75, 0.25]
  }
};

// 2. KEY_MODE: Time Interval Extent (Seconds)
const KEY_MODULATION_DATA: BoppAnnotation = {
  media_id: "audio:beethoven_symphony_5_mvt1",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_key_annotator",
    tool: "tonal_pitch_space_mapper"
  },
  sandbox: {
    curator: "Brian McFee",
    description: "Key mode modulations with time_interval extent in seconds",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 32.5, 78.0, 124.5, 180.0],
    duration: [32.5, 45.5, 46.5, 55.5, 40.0]
  },
  payload: {
    payload_type: "key_mode",
    value: ["C:min", "E♭:maj", "G:min", "C:min", "C:maj"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.96, 0.92, 0.89, 0.95, 0.98]
  }
};

// 3. KEY_MODE: Score Interval Extent (Fractional Quarter Notes)
const KEY_SCORE_DATA: BoppAnnotation = {
  media_id: "score:bach_fugue_bwv846",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_key_annotator",
    tool: "score_analyzer"
  },
  sandbox: {
    description: "Key modulations defined over musical score quarter intervals [numerator, denominator]",
  },
  extent: {
    extent_type: "score_interval",
    quarter: [[0, 1], [32, 1], [64, 1], [96, 1]],
    duration: [[32, 1], [32, 1], [32, 1], [48, 1]]
  },
  payload: {
    payload_type: "key_mode",
    value: ["C:maj", "G:maj", "A:min", "C:maj"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.99, 0.95, 0.92, 0.97]
  }
};

// 3B. KEY_MODE: Static Modal Tonality Distribution (No Extent)
// Illustrates modal split coloring in static case: C Ionian (relative C:maj), D Dorian (relative C:maj),
// E Phrygian (relative C:maj), G Mixolydian (relative C:maj), A Aeolian (relative C:maj)
const MODAL_KEY_GLOBAL_DATA: BoppAnnotation = {
  media_id: "audio:miles_davis_so_what_modal_session",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "modal_jazz_analyst",
    tool: "church_mode_detector"
  },
  sandbox: {
    curator: "Brian McFee",
    dataset: "Modal Jazz & Ecclesiastical Modes",
    description: "Static candidate distribution across church modes illustrating split-color patches: top half colored to tonic, bottom half colored to relative major tonic.",
  },
  payload: {
    payload_type: "key_mode",
    value: ["D:dorian", "E:phrygian", "C:ionian", "G:mixolydian", "A:aeolian"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.45, 0.25, 0.15, 0.10, 0.05]
  }
};

// 3C. KEY_MODE: Time-Varying Modal Progression (Time Interval Extent)
// Illustrates modal split coloring in time-varying progression with disjoint intervals rendered on 1 row!
const MODAL_KEY_TIME_DATA: BoppAnnotation = {
  media_id: "audio:coltrane_impressions_modal_journey",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "modal_harmony_curator",
    tool: "diatonic_mode_space_tracker"
  },
  sandbox: {
    curator: "Brian McFee",
    dataset: "Modal Harmony Benchmark",
    description: "Time-varying modal harmony progression demonstrating disjoint single-row interval layout and split coloring (tonic on top/outer, relative major on bottom/inner).",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 16.0, 32.0, 48.0, 64.0, 80.0, 96.0],
    duration: [16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 24.0]
  },
  payload: {
    payload_type: "key_mode",
    value: ["D:dorian", "E♭:dorian", "D:dorian", "F:lydian", "G:mixolydian", "A:aeolian", "C:ionian"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.95, 0.97, 0.92, 0.94, 0.96, 0.99]
  }
};

// 4. TEMPO: Global (No Extent at all)
const TEMPO_GLOBAL_DATA: BoppAnnotation = {
  media_id: "audio:funk_drum_loop_master",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "bpm_detector_01",
    version: "2.1.0",
    parameters: { method: "autocorrelation" }
  },
  sandbox: {
    description: "Global tempo of the entire audio recording (118.0 BPM without extent bounds)",
  },
  payload: {
    payload_type: "tempo",
    value: [118.0]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.97]
  }
};

// 5. TEMPO: Time Interval Extent (Rubato in Seconds)
const TEMPO_RUBATO_DATA: BoppAnnotation = {
  media_id: "audio:chopin_nocturne_op9_no2",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "performance_analyst",
    tool: "tempo_tracker_gui"
  },
  sandbox: {
    description: "Dynamic rubato tempo variation over time_interval bounds",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 15.0, 32.0, 48.0, 68.0, 85.0],
    duration: [15.0, 17.0, 16.0, 20.0, 17.0, 25.0]
  },
  payload: {
    payload_type: "tempo",
    value: [104.0, 112.5, 120.0, 108.0, 126.0, 98.0]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.90, 0.93, 0.91, 0.88, 0.94, 0.89]
  }
};

// 6. TEMPO: Time Point Extent (Instantaneous Beat BPM)
const TEMPO_METRIC_DATA: BoppAnnotation = {
  media_id: "audio:live_jazz_performance",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "instantaneous_tempo_extractor",
    version: "1.0.0",
    parameters: { window_beats: 2 }
  },
  sandbox: {
    description: "Instantaneous tempo estimates at discrete beat time points",
  },
  extent: {
    extent_type: "time",
    time: [0.0, 0.52, 1.05, 1.57, 2.08, 2.61, 3.12, 3.65, 4.16, 4.69]
  },
  payload: {
    payload_type: "tempo",
    value: [115.4, 117.6, 115.4, 117.6, 115.4, 117.6, 113.2, 117.6, 113.2, 115.4]
  }
};

// 7. TAG_OPEN: Global (No Extent at all)
const TAGS_GLOBAL_DATA: BoppAnnotation = {
  media_id: "spotify:track:17d5wZz4Z2n1rKq7XWzR2F",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "crowd",
    platform: "MusicBrainz / AcousticBrainz",
    num_annotators: 12,
    consensus: "tag_threshold_0.8"
  },
  sandbox: {
    curator: "MusicBrainz / AcousticBrainz",
    description: "Global genre, instrumentation, and mood tags describing the entire media object",
  },
  payload: {
    payload_type: "tag",
    value: ["Post-Rock", "Ambient", "Electric Guitar", "Instrumental", "Crescendo", "Cinematic"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.96, 0.92, 0.95, 0.99, 0.88, 0.91]
  }
};

// 8. TAG_OPEN: Time Interval Extent (Active Instrumentation)
const TAGS_TIME_INTERVAL_DATA: BoppAnnotation = {
  media_id: "audio:orchestra_arrangement",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "orchestral_curator",
    tool: "sonic_annotator"
  },
  sandbox: {
    description: "Active instrument section presence over time_interval bounds",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 12.0, 28.0, 44.0, 60.0],
    duration: [12.0, 16.0, 16.0, 16.0, 20.0]
  },
  payload: {
    payload_type: "tag",
    value: ["Solo Cello", "String Section", "Brass & Woodwinds", "Full Tutti", "Decrescendo Strings"]
  }
};

// 8B. TAG_OPEN: Time Interval Extent (Overlapping Concurrent Instrumentation)
const TAGS_OVERLAPPING_DATA: BoppAnnotation = {
  media_id: "audio:polyphonic_band_arrangement",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "audio_engineer",
    tool: "multitrack_annotator"
  },
  sandbox: {
    description: "Concurrent overlapping instrument presences across time: automatically rendered across multiple distinct rows to prevent collisions",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 8.0, 20.0, 32.0, 48.0],
    duration: [30.0, 40.0, 35.0, 30.0, 32.0]
  },
  payload: {
    payload_type: "tag",
    value: ["Rhythm Section (Drums & Bass)", "Acoustic Guitar", "Lead Vocals", "Hammond Organ Pad", "Electric Guitar Solo"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.94, 0.96, 0.89, 0.95]
  }
};

// 9. CHORD: MIDI Interval Extent (Ticks)
const CHORDS_MIDI_TICKS_DATA: BoppAnnotation = {
  media_id: "midi:standard_type_0_progression",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "midi_theorist",
    tool: "midi_progression_labeler"
  },
  sandbox: {
    description: "Harmonic chords mapped across MIDI tick intervals (480 PPQ)",
  },
  extent: {
    extent_type: "midi_interval",
    tick: [0, 960, 1920, 2880, 3840],
    duration: [960, 960, 960, 960, 1920]
  },
  payload: {
    payload_type: "chord",
    value: ["C:maj", "A:min", "F:maj", "G:7", "C:maj"]
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.99, 0.96, 0.95, 0.98, 0.99]
  }
};

// 10. NOTE_MIDI: MIDI Interval Extent (Bach in MIDI Ticks)
const bachTicks = [
  { tick: 0, dur: 240, midi: 60 },
  { tick: 240, dur: 240, midi: 62 },
  { tick: 480, dur: 240, midi: 64 },
  { tick: 720, dur: 240, midi: 65 },
  { tick: 960, dur: 480, midi: 62 },
  { tick: 1440, dur: 480, midi: 67 },
  { tick: 1920, dur: 240, midi: 60 },
  { tick: 2160, dur: 240, midi: 62 },
  { tick: 2400, dur: 240, midi: 64 },
  { tick: 2640, dur: 240, midi: 65 },
  { tick: 2880, dur: 960, midi: 67 },
];
const BACH_MIDI_TICKS_DATA: BoppAnnotation = {
  media_id: "midi:bach_invention_no1",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "derived",
    transform: "midi_track_extraction",
    parameters: { track: 1, channel: 0 }
  },
  sandbox: {
    description: "Bach Two-Part Invention No. 1 motif with MIDI Interval tick bounds (480 PPQ)",
  },
  extent: {
    extent_type: "midi_interval",
    tick: bachTicks.map(n => n.tick),
    duration: bachTicks.map(n => n.dur)
  },
  payload: {
    payload_type: "note_midi",
    value: bachTicks.map(n => n.midi)
  }
};

// 11. MOOD_THAYER: Static Mood Without Time Dynamics (Ungrounded Media Appraisal)
const MOOD_STATIC_DATA: BoppAnnotation = {
  media_id: "audio:ambient_meditation_piece",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "affect_lab_expert",
    tool: "AffectiveSlider_Static"
  },
  sandbox: {
    curator: "Audio Affect Laboratory",
    description: "Global affective appraisal of the entire musical piece without time dynamics (Russell-Thayer 2D circumplex with Gaussian variance confidence)",
  },
  payload: {
    payload_type: "mood_thayer",
    valence: [0.65],
    arousal: [-0.45],
  },
  confidence: {
    confidence_type: "variance",
    confidence: [0.035],
  },
};

// 11B. MOOD_THAYER: Static Mood Multi-Rater Scatter Plot (Discrete Ratings / Likelihood Confidence)
const MOOD_STATIC_RATINGS_DATA: BoppAnnotation = {
  media_id: "audio:ambient_meditation_piece",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "crowd",
    platform: "Audio Affect Subject Study",
    num_annotators: 8,
    consensus: "raw_ratings"
  },
  sandbox: {
    curator: "Audio Affect Laboratory",
    description: "Discrete listener affect ratings for the same meditation piece without time dynamics (rendered as 2D circumplex scatter plot)",
  },
  payload: {
    payload_type: "mood_thayer",
    valence: [0.65, 0.72, 0.58, 0.80, 0.61, 0.50, 0.75, 0.68],
    arousal: [-0.45, -0.40, -0.55, -0.35, -0.60, -0.30, -0.50, -0.42],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.95, 0.88, 0.90, 0.75, 0.82, 0.70, 0.92, 0.85],
  },
};

// 12. COMPARATIVE PAIRS ON SAME UNDERLYING AUDIO (Drive: mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d)
// Variant A: Discrete Time Points with Chord (chord onsets instead of time_interval)
const DRIVE_TIME_POINTS_DATA: BoppAnnotation = {
  media_id: "mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d",
  bopp_version: "1.0",
  metadata: DRIVE_DATA.metadata,
  sandbox: {
    ...DRIVE_DATA.sandbox,
    description: "Same Drive audio: Discrete onset time points (extent: time) comparing with duration intervals",
  },
  extent: {
    extent_type: "time",
    time: (DRIVE_DATA.extent as { time: number[] }).time,
  },
  payload: DRIVE_DATA.payload,
  confidence: DRIVE_DATA.confidence,
};

// Variant B: Agreement Confidence comparison on the same chord intervals
const DRIVE_AGREEMENT_CONF_DATA: BoppAnnotation = {
  media_id: "mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d",
  bopp_version: "1.0",
  metadata: DRIVE_DATA.metadata,
  sandbox: {
    ...DRIVE_DATA.sandbox,
    description: "Same Drive audio: Multi-annotator agreement votes (extent: time_interval, conf: agreement)",
  },
  extent: DRIVE_DATA.extent,
  payload: DRIVE_DATA.payload,
  confidence: {
    confidence_type: "agreement",
    confidence: [
      0.9, 0.6, 0.7, 1.0, 0.8, 0.7, 1.0, 1.0,
      0.9, 1.0, 1.0, 0.9, 1.0, 0.9, 1.0, 1.0,
      0.8, 0.9, 1.0, 1.0, 0.8, 1.0, 1.0, 0.9,
      1.0, 1.0, 1.0, 1.0, 0.9, 1.0, 0.9, 1.0,
      1.0, 0.8, 0.9, 1.0, 1.0, 0.8, 1.0, 1.0,
      0.9, 1.0, 1.0, 1.0, 1.0, 0.9, 1.0, 0.9,
      1.0, 1.0, 0.8, 0.9, 1.0, 1.0, 0.8
    ],
  },
};

// Variant C: Same Drive audio translated to musical Score Quarters
const DRIVE_SCORE_QUARTERS_DATA: BoppAnnotation = {
  media_id: "mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d",
  bopp_version: "1.0",
  metadata: DRIVE_DATA.metadata,
  sandbox: {
    ...DRIVE_DATA.sandbox,
    description: "Same Drive audio: Transcribed into Score Interval quarter beats [num, denom] for score comparison",
  },
  extent: {
    extent_type: "score_interval",
    quarter: (DRIVE_DATA.extent as { time: number[] }).time.map((t, idx) => [idx * 4, 1]),
    duration: (DRIVE_DATA.extent as { duration: number[] }).duration.map(() => [4, 1]),
  },
  payload: DRIVE_DATA.payload,
  confidence: DRIVE_DATA.confidence,
};

// ---------------------------------------------------------------------------
// Systematic Derived & Variant Datasets Covering All Combinations
// ---------------------------------------------------------------------------

const PERCUSSIVE_ONSETS = [0.12, 0.48, 0.96, 1.44, 1.92, 2.40, 2.88, 3.36, 3.84, 4.32, 4.80];
const PERCUSSIVE_MARKER_LIKELIHOOD: BoppAnnotation = {
  media_id: "audio:funk_drum_solo_transients",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "superflux_onset_detector",
    version: "1.0.0",
    parameters: { filter_size: 5, threshold: 0.18 }
  },
  sandbox: {
    description: "Percussive transient markers with likelihood confidence values",
  },
  extent: {
    extent_type: "time",
    time: PERCUSSIVE_ONSETS,
  },
  payload: {
    payload_type: "marker",
    description: "onset",
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.91, 0.95, 0.88, 0.97, 0.93, 0.89, 0.96, 0.94, 0.92, 0.99],
  },
};

const PERCUSSIVE_MARKER_NOCONF: BoppAnnotation = {
  ...PERCUSSIVE_MARKER_LIKELIHOOD,
  confidence: undefined,
};

const BEAT_METRIC_LIKELIHOOD: BoppAnnotation = {
  ...LONGBEATS_DATA,
  confidence: {
    confidence_type: "likelihood",
    confidence: (LONGBEATS_DATA.extent as { time: number[] }).time.map((_, i) => +(0.85 + 0.14 * Math.sin(i * 0.7) ** 2).toFixed(3)),
  },
};

const TEMPO_RUBATO_VARIANCE_DATA: BoppAnnotation = {
  ...TEMPO_RUBATO_DATA,
  confidence: {
    confidence_type: "variance",
    confidence: [4.5, 6.2, 5.8, 8.1, 5.0, 7.4],
  },
};

const CHORD_DISJOINT_NOCONF: BoppAnnotation = {
  ...DRIVE_DATA,
  confidence: undefined,
};

const CHORD_OVERLAPPING_DATA: BoppAnnotation = {
  media_id: "audio:polyphonic_jazz_quartet",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "jazz_theorist",
    tool: "jazz_lead_sheet_transcriber",
  },
  sandbox: {
    description: "Concurrent overlapping rhythm section chords rendered across multiple rows",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 2.0, 6.0, 8.0, 12.0, 14.0],
    duration: [8.0, 8.0, 8.0, 8.0, 8.0, 8.0],
  },
  payload: {
    payload_type: "chord",
    value: ["C:maj7", "E:min7", "A:min7", "D:min7", "G:7", "C:maj7"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.95, 0.92, 0.94, 0.91, 0.96, 0.98],
  },
};

const KEY_MODAL_NOCONF: BoppAnnotation = {
  ...MODAL_KEY_GLOBAL_DATA,
  confidence: undefined,
};

const KEY_MODULATION_NOCONF: BoppAnnotation = {
  ...MODAL_KEY_TIME_DATA,
  confidence: undefined,
};

const MOZART_DATA_NOCONF: BoppAnnotation = {
  ...MOZART_DATA,
  confidence: undefined,
};

const TEMPO_GLOBAL_NOCONF: BoppAnnotation = {
  ...TEMPO_GLOBAL_DATA,
  confidence: undefined,
};

const TAGS_GLOBAL_NOCONF: BoppAnnotation = {
  ...TAGS_GLOBAL_DATA,
  confidence: undefined,
};

const TF_DATA_NOCONF: BoppAnnotation = {
  ...TF_DATA,
  confidence: undefined,
};

const PIXEL_DATA_LIKELIHOOD: BoppAnnotation = {
  ...PIXEL_DATA,
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.96, 0.92, 0.88, 0.94, 0.91, 0.89, 0.97],
  },
};

const SCORE_QUARTER_POINTS_NOCONF: BoppAnnotation = {
  media_id: "score:chopin_prelude_downbeats",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "theorist",
    tool: "musescore_score_annotator",
  },
  sandbox: {
    description: "Instantaneous score quarter beat locations without duration (extent: score_quarter, no confidence)",
  },
  extent: {
    extent_type: "score_quarter",
    quarter: [[0, 1], [4, 1], [8, 1], [12, 1], [16, 1]],
  },
  payload: {
    payload_type: "chord",
    value: ["C:maj", "G:maj", "A:min", "F:maj", "C:maj"],
  },
};

// 13. TIME_UNIFORM Extent with FREQUENCY_HZ Payload
const TIME_UNIFORM_DATA: BoppAnnotation = {
  media_id: "audio:synthesized_f0_sweep",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "sine_generator",
    version: "1.0.0",
    parameters: { sample_rate: 100 },
  },
  sandbox: {
    description: "Regular time grid synthesized dynamically: start_time: 0.0s, sampling_period: 0.05s (20 Hz frames)",
  },
  extent: {
    extent_type: "time_uniform",
    start_time: 0.0,
    sampling_period: 0.05,
  },
  payload: {
    payload_type: "frequency_hz",
    value: [220.0, 225.2, 230.5, 236.1, 242.0, 248.1, 254.5, 261.63, 269.2, 277.18, 285.3, 293.66, 302.2, 311.13, 320.3, 329.63],
    voiced: [true, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.95, 0.94, 0.96, 0.95, 0.97, 0.98, 0.96, 0.99, 0.97, 0.96, 0.95, 0.93, 0.45, 0.42, 0.38, 0.35],
  },
};

// 14. PIXEL Extent (Singular 2D Point Coordinates) with OBJECT Payload
const PIXEL_2D_DATA: BoppAnnotation = {
  media_id: "image:scanned_sheet_music_noteheads.png",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "YOLO_Music_Object_Detector",
    version: "2.1.0",
    parameters: { conf_threshold: 0.8 },
  },
  sandbox: {
    description: "2D notehead center coordinates (x, y) on score image with inverted Y handling toggle",
  },
  extent: {
    extent_type: "pixel",
    x: [120, 185, 250, 315, 380, 445, 510, 575],
    y: [340, 320, 295, 280, 260, 240, 220, 200],
  },
  payload: {
    payload_type: "object",
    description: "notehead_centers",
    value: [
      { pitch: "C4" },
      { pitch: "D4" },
      { pitch: "E4" },
      { pitch: "F4" },
      { pitch: "G4" },
      { pitch: "A4" },
      { pitch: "B4" },
      { pitch: "C5" },
    ],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.95, 0.97, 0.94, 0.96, 0.93, 0.95, 0.99],
  },
};

// 15. TEXT_INTERVAL Extent with LYRICS Payload (BCP 47 Validated)
const TEXT_INTERVAL_LYRICS_DATA: BoppAnnotation = {
  media_id: "text:folk_song_transcript_en",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "linguist_aligner",
    tool: "MFA_Montreal_Forced_Aligner",
  },
  sandbox: {
    description: "Lyrics word spans with character offsets and lengths validated with IETF BCP 47 language tag",
    text_transcript: "Row row row your boat gently down the stream",
  },
  extent: {
    extent_type: "text_interval",
    offset: [0, 4, 8, 13, 18, 23, 30, 35],
    length: [3, 3, 3, 4, 4, 6, 4, 10],
  },
  payload: {
    payload_type: "lyrics",
    value: ["Row", "row", "row", "your", "boat", "gently", "down", "the stream"],
    language: "en-US",
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.99, 0.97, 0.96, 0.95, 0.94, 0.96, 0.98],
  },
};

// 16. TEXT Extent with TAG Payload (Token Boundaries)
const TEXT_TOKENS_DATA: BoppAnnotation = {
  media_id: "text:dialogue_turn_tokens",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "spacy_tokenizer",
    version: "3.7.0",
    parameters: {},
  },
  sandbox: {
    description: "Token character start offsets highlighting text segment start positions",
  },
  extent: {
    extent_type: "text",
    offset: [0, 4, 8, 13, 18, 23, 30, 35],
  },
  payload: {
    payload_type: "tag",
    value: ["token_0", "token_1", "token_2", "token_3", "token_4", "token_5", "token_6", "token_7"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.99, 0.98, 0.99, 0.97, 0.98, 0.95, 0.96, 0.99],
  },
};

// 17. SPHERICAL_TIME Extent with TAG Payload (3D Polar Audio Source Trajectory)
const SPHERICAL_TIME_DATA: BoppAnnotation = {
  media_id: "audio:ambisonics_soundfield_3d",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "DoA_Spatial_Tracker",
    version: "2.0.0",
    parameters: {},
  },
  sandbox: {
    description: "3D polar coordinates (azimuth, elevation, radius) over time for moving spatial audio source",
  },
  extent: {
    extent_type: "spherical_time",
    azimuth: [-120.0, -90.0, -60.0, -30.0, 0.0, 30.0, 60.0, 90.0, 120.0],
    elevation: [0.0, 5.0, 12.0, 20.0, 25.0, 20.0, 12.0, 5.0, 0.0],
    radius: [2.5, 2.3, 2.0, 1.8, 1.5, 1.8, 2.0, 2.3, 2.5],
    time: [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
  },
  payload: {
    payload_type: "tag",
    value: ["Left Surround", "Left", "Center-Left", "Center-Left High", "Center Front", "Center-Right High", "Center-Right", "Right", "Right Surround"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.92, 0.94, 0.95, 0.96, 0.98, 0.96, 0.95, 0.94, 0.91],
  },
};

// 18. CARTESIAN_TIME Extent with TAG Payload (3D Cartesian Sound Source Trajectory)
const CARTESIAN_TIME_DATA: BoppAnnotation = {
  media_id: "sensor:spatial_microphone_array",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "MUSIC_3D_Cartesian_Localizer",
    version: "1.5.0",
    parameters: {},
  },
  sandbox: {
    description: "3D Cartesian coordinates (x, y, z in meters) over time with overview timeline brush",
  },
  extent: {
    extent_type: "cartesian_time",
    x: [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0],
    y: [1.0, 1.2, 1.5, 1.8, 2.0, 1.8, 1.5, 1.2, 1.0],
    z: [0.0, 0.2, 0.5, 0.8, 1.0, 0.8, 0.5, 0.2, 0.0],
    time: [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
  },
  payload: {
    payload_type: "tag",
    value: ["WayPoint 1", "WayPoint 2", "WayPoint 3", "WayPoint 4", "Apex", "WayPoint 6", "WayPoint 7", "WayPoint 8", "WayPoint 9"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.91, 0.93, 0.95, 0.97, 0.99, 0.96, 0.94, 0.92, 0.90],
  },
};

// 19. NOTE Payload with Scientific Pitch Notation (SPN)
const NOTE_SPN_DATA: BoppAnnotation = {
  media_id: "audio:scale_scientific_pitch_notation",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "pitch_analyst",
    tool: "spn_transcriber",
  },
  sandbox: {
    description: "Scientific Pitch Notation (SPN) with Unicode accidentals (e.g. E♭4, A♭4, B♭4) mapped to piano roll",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
    duration: [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.9],
  },
  payload: {
    payload_type: "note",
    value: ["C4", "D4", "E♭4", "F4", "G4", "A♭4", "B♭4", "C5"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.98, 0.95, 0.94, 0.96, 0.97, 0.93, 0.95, 0.99],
  },
};

// 20. SCORE_QUARTER_FLOAT Extent with NOTE Payload
const SCORE_QUARTER_FLOAT_DATA: BoppAnnotation = {
  media_id: "score:continuous_quarter_measure",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    algorithm_id: "midi_to_quarter_converter",
    version: "1.1.0",
    parameters: {},
  },
  sandbox: {
    description: "Floating-point score quarter positions (extent: score_quarter_float)",
  },
  extent: {
    extent_type: "score_quarter_float",
    quarter: [0.0, 1.0, 2.0, 2.5, 3.0, 4.0],
  },
  payload: {
    payload_type: "note",
    value: ["C4", "E4", "G4", "B♭4", "C5", "G4"],
  },
};

// 21. SCORE_INTERVAL_FLOAT Extent with CHORD Payload
const SCORE_INTERVAL_FLOAT_DATA: BoppAnnotation = {
  media_id: "score:chopin_prelude_float_quarters",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "music_theorist",
    tool: "musescore_score_annotator",
  },
  sandbox: {
    description: "Floating-point score interval quarter note bounds [quarter, duration] (extent: score_interval_float)",
  },
  extent: {
    extent_type: "score_interval_float",
    quarter: [0.0, 0.5, 1.0, 2.0, 2.25, 3.0],
    duration: [0.5, 0.5, 1.0, 0.25, 0.75, 1.0],
  },
  payload: {
    payload_type: "chord",
    value: ["C:maj", "G:maj", "A:min", "F:maj", "G:7", "C:maj"],
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: [0.96, 0.94, 0.98, 0.92, 0.95, 0.99],
  },
};

export const SAMPLE_DATASETS: SampleFileInfo[] = [
  // =========================================================================
  // 1. BENCHMARKS (Official BOPP Reference Benchmarks)
  // =========================================================================
  {
    id: "bench_drive_bopp",
    filename: "benchmarks/01_drive.bopp",
    title: "Drive Chords (Benchmark JSON)",
    category: "benchmark",
    format: "json",
    description: "Official BOPP benchmark test file: TimeInterval extent, Harte chord payload, Likelihood confidence ratings.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_DATA,
  },
  {
    id: "bench_drive_msgpack",
    filename: "benchmarks/02_drive.bopp.msgpack",
    title: "Drive Chords (Benchmark MessagePack)",
    category: "benchmark",
    format: "msgpack",
    description: "Binary MessagePack serialized version of drive.bopp, decoded client-side via @msgpack/msgpack without Python kernel.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_DATA,
  },
  {
    id: "bench_longbeats_bopp",
    filename: "benchmarks/03_longbeats.bopp",
    title: "Longbeats Metric Beats (Benchmark JSON)",
    category: "benchmark",
    format: "json",
    description: "Official BOPP benchmark dataset: Time extent with Beat position integers (downbeat 1 and metric beats 2, 3, 4).",
    extentType: "time",
    payloadType: "beat",
    data: LONGBEATS_DATA,
  },
  {
    id: "bench_longbeats_msgpack",
    filename: "benchmarks/04_longbeats.bopp.msgpack",
    title: "Longbeats Metric Beats (Benchmark MessagePack)",
    category: "benchmark",
    format: "msgpack",
    description: "Binary MessagePack serialization of longbeats.bopp containing rhythmic beat events.",
    extentType: "time",
    payloadType: "beat",
    data: LONGBEATS_DATA,
  },

  // =========================================================================
  // 2. GLOBAL (No Extent: Annotations Across Entire Media Object)
  // =========================================================================
  {
    id: "global_key_likelihood",
    filename: "global/01_key_mode_multicandidate_likelihood.bopp",
    title: "Global Key: Multi-Candidate (Likelihood)",
    category: "music",
    format: "json",
    description: "key_mode payload with NO extent: multiple candidate keys (C:maj 75%, A:min 25%) with likelihood confidence on Concentric Circle of Fifths donut wheel.",
    extentType: "none",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_GLOBAL_DATA,
  },
  {
    id: "global_key_noconf",
    filename: "global/02_key_mode_modal_noconf.bopp",
    title: "Global Key: Church Modes (No Confidence)",
    category: "music",
    format: "json",
    description: "key_mode payload with NO extent and NO confidence: church modes demonstrating split-color patches (tonic and relative major).",
    extentType: "none",
    payloadType: "key_mode",
    data: KEY_MODAL_NOCONF,
  },
  {
    id: "global_mood_variance",
    filename: "global/03_mood_thayer_variance.bopp",
    title: "Global Mood: Gaussian Density (Variance)",
    category: "emotion",
    format: "json",
    description: "mood_thayer payload with NO extent: 2D bivariate Gaussian affect distribution on Russell-Thayer Circumplex space with variance confidence.",
    extentType: "none",
    payloadType: "mood_thayer",
    confidenceType: "variance",
    data: MOOD_STATIC_DATA,
  },
  {
    id: "global_mood_likelihood",
    filename: "global/04_mood_thayer_likelihood.bopp",
    title: "Global Mood: Multi-Rater Scatter (Likelihood)",
    category: "emotion",
    format: "json",
    description: "mood_thayer payload with NO extent: multi-rater discrete affect scatter plot on 2D Circumplex model with likelihood ratings.",
    extentType: "none",
    payloadType: "mood_thayer",
    confidenceType: "likelihood",
    data: MOOD_STATIC_RATINGS_DATA,
  },
  {
    id: "global_tempo_likelihood",
    filename: "global/05_tempo_constant_likelihood.bopp",
    title: "Global Tempo: 118 BPM (Likelihood)",
    category: "music",
    format: "json",
    description: "tempo payload with NO extent: track-wide constant tempo (118.0 BPM) with confidence likelihood gauge.",
    extentType: "none",
    payloadType: "tempo",
    confidenceType: "likelihood",
    data: TEMPO_GLOBAL_DATA,
  },
  {
    id: "global_tempo_noconf",
    filename: "global/06_tempo_constant_noconf.bopp",
    title: "Global Tempo: 118 BPM (No Confidence)",
    category: "music",
    format: "json",
    description: "tempo payload with NO extent and NO confidence: track-wide constant tempo display.",
    extentType: "none",
    payloadType: "tempo",
    data: TEMPO_GLOBAL_NOCONF,
  },
  {
    id: "global_tags_likelihood",
    filename: "global/07_tags_genres_likelihood.bopp",
    title: "Global Tags: Genres & Moods (Likelihood)",
    category: "music",
    format: "json",
    description: "tag payload with NO extent: global descriptive genres, instruments, and style tags with likelihood confidence bars.",
    extentType: "none",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: TAGS_GLOBAL_DATA,
  },
  {
    id: "global_tags_noconf",
    filename: "global/08_tags_genres_noconf.bopp",
    title: "Global Tags: Genres & Moods (No Confidence)",
    category: "music",
    format: "json",
    description: "tag payload with NO extent and NO confidence: global descriptive media tags rendered as an alphabetized collection of badges.",
    extentType: "none",
    payloadType: "tag",
    data: TAGS_GLOBAL_NOCONF,
  },

  // =========================================================================
  // 3. TIME_POINTS (Extent: time - Discrete Timestamps in Seconds)
  // =========================================================================
  {
    id: "time_beats_noconf",
    filename: "time_points/01_beat_metric_noconf.bopp",
    title: "Metric Beats (No Confidence)",
    category: "music",
    format: "json",
    description: "time extent with beat payload: rhythmic beat markers (downbeats and metric subdivisions) without confidence ratings.",
    extentType: "time",
    payloadType: "beat",
    data: LONGBEATS_DATA,
  },
  {
    id: "time_beats_likelihood",
    filename: "time_points/02_beat_metric_likelihood.bopp",
    title: "Metric Beats (Likelihood)",
    category: "music",
    format: "json",
    description: "time extent with beat payload: rhythmic beat markers accompanied by beat-tracking confidence probabilities.",
    extentType: "time",
    payloadType: "beat",
    confidenceType: "likelihood",
    data: BEAT_METRIC_LIKELIHOOD,
  },
  {
    id: "time_marker_likelihood",
    filename: "time_points/03_marker_percussive_likelihood.bopp",
    title: "Percussive Markers (Likelihood)",
    category: "music",
    format: "json",
    description: "time extent with marker payload: percussive audio transients detected by SuperFlux with likelihood confidence pins.",
    extentType: "time",
    payloadType: "marker",
    confidenceType: "likelihood",
    data: PERCUSSIVE_MARKER_LIKELIHOOD,
  },
  {
    id: "time_marker_noconf",
    filename: "time_points/04_marker_percussive_noconf.bopp",
    title: "Percussive Markers (No Confidence)",
    category: "music",
    format: "json",
    description: "time extent with marker payload: percussive transient timestamps without confidence ratings.",
    extentType: "time",
    payloadType: "marker",
    data: PERCUSSIVE_MARKER_NOCONF,
  },
  {
    id: "time_tempo_points_likelihood",
    filename: "time_points/08_tempo_instantaneous_points_likelihood.bopp",
    title: "Instantaneous Tempo Points (Likelihood)",
    category: "music",
    format: "json",
    description: "time extent with tempo payload: discrete beat-by-beat instantaneous tempo estimates with likelihood confidence pins.",
    extentType: "time",
    payloadType: "tempo",
    data: TEMPO_METRIC_DATA,
  },
  {
    id: "time_chord_onsets_likelihood",
    filename: "time_points/09_chord_onsets_likelihood.bopp",
    title: "Chord Onset Points (Likelihood)",
    category: "music",
    format: "json",
    description: "time extent with chord payload: discrete chord change timestamps rendered as vertical harmonic markers.",
    extentType: "time",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_TIME_POINTS_DATA,
  },
  {
    id: "time_mood_trajectory_variance",
    filename: "time_points/10_mood_thayer_trajectory_variance.bopp",
    title: "Affective Mood Trajectory (Variance)",
    category: "emotion",
    format: "json",
    description: "time extent with mood_thayer payload: continuous Valence & Arousal trajectory over time with 95% CI error ribbons and 2D circumplex spatial path.",
    extentType: "time",
    payloadType: "mood_thayer",
    confidenceType: "variance",
    data: MOOD_DATA,
  },

  // =========================================================================
  // 4. TIME_INTERVALS (Extent: time_interval - Start Time + Duration in Seconds)
  // =========================================================================
  {
    id: "interval_chord_disjoint_likelihood",
    filename: "time_intervals/01_chord_disjoint_likelihood.bopp",
    title: "Chords: Disjoint Layout (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with chord payload: non-overlapping harmonic progressions rendered on a consolidated single-row layout with top confidence meters.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_DATA,
  },
  {
    id: "interval_chord_overlapping_likelihood",
    filename: "time_intervals/02_chord_overlapping_likelihood.bopp",
    title: "Chords: Overlapping Polyphony (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with chord payload: concurrent overlapping harmonic chords automatically rendered across multiple rows.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: CHORD_OVERLAPPING_DATA,
  },
  {
    id: "interval_chord_noconf",
    filename: "time_intervals/03_chord_noconf.bopp",
    title: "Chords: Disjoint Layout (No Confidence)",
    category: "music",
    format: "json",
    description: "time_interval extent with chord payload: clean harmonic chord intervals without confidence meters.",
    extentType: "time_interval",
    payloadType: "chord",
    data: CHORD_DISJOINT_NOCONF,
  },
  {
    id: "interval_key_likelihood",
    filename: "time_intervals/04_key_mode_progression_likelihood.bopp",
    title: "Key Modulations: Progression (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with key_mode payload: Beethoven Symphony No. 5 harmonic key changes with split coloring and likelihood confidence.",
    extentType: "time_interval",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_MODULATION_DATA,
  },
  {
    id: "interval_key_noconf",
    filename: "time_intervals/05_key_mode_progression_noconf.bopp",
    title: "Modal Progression: Single Row (No Confidence)",
    category: "music",
    format: "json",
    description: "time_interval extent with key_mode payload: modal harmony progression with split coloring on a single vertical row track.",
    extentType: "time_interval",
    payloadType: "key_mode",
    data: KEY_MODULATION_NOCONF,
  },
  {
    id: "interval_tags_crowd_agreement",
    filename: "time_intervals/06_tag_crowd_agreement_25_annotators.bopp",
    title: "Song Form Tags: Crowd Agreement 25 Annotators",
    category: "music",
    format: "json",
    description: "time_interval extent with tag payload: 25-annotator crowd consensus agreement on song section boundaries.",
    extentType: "time_interval",
    payloadType: "tag",
    confidenceType: "agreement",
    data: CROWD_AGREEMENT_DATA,
  },
  {
    id: "interval_tempo_rubato_variance",
    filename: "time_intervals/11_tempo_rubato_shelves_variance.bopp",
    title: "Rubato Tempo Shelves (Variance)",
    category: "music",
    format: "json",
    description: "time_interval extent with tempo payload: Chopin Nocturne rubato tempo variations with ±1.96σ statistical variance error bands.",
    extentType: "time_interval",
    payloadType: "tempo",
    confidenceType: "variance",
    data: TEMPO_RUBATO_VARIANCE_DATA,
  },
  {
    id: "interval_tempo_rubato_likelihood",
    filename: "time_intervals/12_tempo_rubato_shelves_likelihood.bopp",
    title: "Rubato Tempo Shelves (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with tempo payload: step transitions and rubato tempo variations with likelihood confidence meters.",
    extentType: "time_interval",
    payloadType: "tempo",
    confidenceType: "likelihood",
    data: TEMPO_RUBATO_DATA,
  },
  {
    id: "interval_tags_disjoint_noconf",
    filename: "time_intervals/13_tag_open_disjoint_noconf.bopp",
    title: "Instrument Presence: Disjoint (No Confidence)",
    category: "music",
    format: "json",
    description: "time_interval extent with tag payload: non-overlapping orchestral instrument presences rendered on a single row.",
    extentType: "time_interval",
    payloadType: "tag",
    data: TAGS_TIME_INTERVAL_DATA,
  },
  {
    id: "interval_tags_overlapping_likelihood",
    filename: "time_intervals/14_tag_open_overlapping_likelihood.bopp",
    title: "Concurrent Band Tracks: Overlapping (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with tag payload: concurrent multitrack instruments rendered across multiple distinct rows to avoid collisions.",
    extentType: "time_interval",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: TAGS_OVERLAPPING_DATA,
  },
  {
    id: "interval_midi_pianoroll_likelihood",
    filename: "time_intervals/15_note_midi_pianoroll_likelihood.bopp",
    title: "Mozart K.545 Piano Roll: Seconds (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with note_midi payload: unit-height centered note blocks with pitch class colors and top confidence meters.",
    extentType: "time_interval",
    payloadType: "note_midi",
    confidenceType: "likelihood",
    data: MOZART_DATA,
  },
  {
    id: "interval_midi_pianoroll_noconf",
    filename: "time_intervals/16_note_midi_pianoroll_noconf.bopp",
    title: "Mozart K.545 Piano Roll: Seconds (No Confidence)",
    category: "music",
    format: "json",
    description: "time_interval extent with note_midi payload: interactive piano roll keyboard grid without confidence meters.",
    extentType: "time_interval",
    payloadType: "note_midi",
    data: MOZART_DATA_NOCONF,
  },
  {
    id: "interval_note_names_pianoroll",
    filename: "time_intervals/17_note_names_pianoroll.bopp",
    title: "Note Names Scale: C3, D3, E3 (Numerical Pitch)",
    category: "music",
    format: "json",
    description: "time_interval extent with note_midi string names (C3, D3, E3...): numerical pitch axis reflects true semitone spacing.",
    extentType: "time_interval",
    payloadType: "note_midi",
    confidenceType: "likelihood",
    data: NOTE_NAMES_PIANOROLL_DATA,
  },
  {
    id: "interval_frequency_hz_pianoroll",
    filename: "time_intervals/18_frequency_hz_pianoroll.bopp",
    title: "Note Frequencies (Hz): Piano Roll (Log Pitch)",
    category: "music",
    format: "json",
    description: "time_interval extent with frequency_hz payload: note frequencies in Hz mapped to numerical log-frequency semitone axis.",
    extentType: "time_interval",
    payloadType: "frequency_hz",
    confidenceType: "likelihood",
    data: FREQUENCY_HZ_PIANOROLL_DATA,
  },

  // =========================================================================
  // 5. SYMBOLIC_MIDI_SCORE (Extent: midi_interval, score_interval, score_quarter)
  // =========================================================================
  {
    id: "symbolic_note_midi_ticks_likelihood",
    filename: "symbolic_midi_score/01_note_midi_ticks_mozart_likelihood.bopp",
    title: "Mozart K.545: MIDI Ticks (Likelihood)",
    category: "music",
    format: "json",
    description: "midi_interval extent with note_midi payload: MIDI tick clock durations (480 PPQ) with likelihood confidence.",
    extentType: "midi_interval",
    payloadType: "note_midi",
    confidenceType: "likelihood",
    data: MOZART_MIDI_DATA,
  },
  {
    id: "symbolic_note_midi_ticks_noconf",
    filename: "symbolic_midi_score/02_note_midi_ticks_bach_noconf.bopp",
    title: "Bach Invention: MIDI Ticks (No Confidence)",
    category: "music",
    format: "json",
    description: "midi_interval extent with note_midi payload: Bach Two-Part Invention No. 1 motif in MIDI ticks without confidence.",
    extentType: "midi_interval",
    payloadType: "note_midi",
    data: BACH_MIDI_TICKS_DATA,
  },
  {
    id: "symbolic_chords_midi_ticks_likelihood",
    filename: "symbolic_midi_score/03_chord_midi_ticks_likelihood.bopp",
    title: "Chords: MIDI Ticks (Likelihood)",
    category: "music",
    format: "json",
    description: "midi_interval extent with chord payload: harmonic progressions timed in PPQ clock ticks with likelihood confidence.",
    extentType: "midi_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: CHORDS_MIDI_TICKS_DATA,
  },
  {
    id: "symbolic_note_score_quarters_likelihood",
    filename: "symbolic_midi_score/04_note_midi_score_quarters_likelihood.bopp",
    title: "Mozart K.545: Score Quarters (Likelihood)",
    category: "score",
    format: "json",
    description: "score_interval extent with note_midi payload: musical notation quarter fractions [num, denom] with likelihood confidence.",
    extentType: "score_interval",
    payloadType: "note_midi",
    confidenceType: "likelihood",
    data: MOZART_SCORE_DATA,
  },
  {
    id: "symbolic_chords_score_quarters_likelihood",
    filename: "symbolic_midi_score/05_chord_score_quarters_rational_likelihood.bopp",
    title: "Chopin Prelude: Score Quarters (Likelihood)",
    category: "score",
    format: "json",
    description: "score_interval extent with chord payload: rational fraction quarter intervals [[0,1],[1,2]...] with likelihood confidence.",
    extentType: "score_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: SCORE_DATA,
  },
  {
    id: "symbolic_key_score_quarters_likelihood",
    filename: "symbolic_midi_score/06_key_mode_score_quarters_likelihood.bopp",
    title: "Bach Fugue: Score Quarters (Likelihood)",
    category: "score",
    format: "json",
    description: "score_interval extent with key_mode payload: key changes timed in score quarter fractions with likelihood confidence.",
    extentType: "score_interval",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_SCORE_DATA,
  },
  {
    id: "symbolic_chords_score_quarter_points_noconf",
    filename: "symbolic_midi_score/07_chord_score_quarter_points_noconf.bopp",
    title: "Score Beat Points: Chord (No Confidence)",
    category: "score",
    format: "json",
    description: "score_quarter extent with chord payload: instantaneous score quarter beat locations without duration bounds.",
    extentType: "score_quarter",
    payloadType: "chord",
    data: SCORE_QUARTER_POINTS_NOCONF,
  },

  // =========================================================================
  // 6. SPATIAL_BOXES (Extent: time_frequency_box, pixel_box)
  // =========================================================================
  {
    id: "spatial_bioacoustic_tf_likelihood",
    filename: "spatial_boxes/01_bioacoustic_tf_boxes_likelihood.bopp",
    title: "Bioacoustic Spectrogram Boxes (Likelihood)",
    category: "bioacoustic",
    format: "json",
    description: "time_frequency_box extent with tag payload: avian song spectrogram bounding boxes in Hz with BirdNET likelihood ratings.",
    extentType: "time_frequency_box",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: TF_DATA,
  },
  {
    id: "spatial_bioacoustic_tf_noconf",
    filename: "spatial_boxes/02_bioacoustic_tf_boxes_noconf.bopp",
    title: "Bioacoustic Spectrogram Boxes (No Confidence)",
    category: "bioacoustic",
    format: "json",
    description: "time_frequency_box extent with tag payload: spectrogram frequency-time bounding boxes without confidence values.",
    extentType: "time_frequency_box",
    payloadType: "tag",
    data: TF_DATA_NOCONF,
  },
  {
    id: "spatial_omr_pixels_noconf",
    filename: "spatial_boxes/03_omr_sheet_music_pixel_boxes_noconf.bopp",
    title: "OMR Sheet Music Pixels (No Confidence)",
    category: "omr",
    format: "json",
    description: "pixel_box extent with tag payload: scanned sheet music glyph bounding boxes in image pixel coordinates.",
    extentType: "pixel_box",
    payloadType: "tag",
    data: PIXEL_DATA,
  },
  {
    id: "spatial_omr_pixels_likelihood",
    filename: "spatial_boxes/04_omr_sheet_music_pixel_boxes_likelihood.bopp",
    title: "OMR Sheet Music Pixels (Likelihood)",
    category: "omr",
    format: "json",
    description: "pixel_box extent with tag payload: OMR glyph detections with optical model classification likelihood confidences.",
    extentType: "pixel_box",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: PIXEL_DATA_LIKELIHOOD,
  },

  // =========================================================================
  // 7. NEW EXTENTS & PAYLOADS (BOPP v1 Revisions)
  // =========================================================================
  {
    id: "time_uniform_frequency_hz_likelihood",
    filename: "time_uniform/01_frequency_hz_sweep_likelihood.bopp",
    title: "Synthesized F0 Sweep: Time Uniform (Likelihood)",
    category: "music",
    format: "json",
    description: "time_uniform extent with frequency_hz payload: regular dynamic time grid t[i] = start_time + i * sampling_period with voiced flag dimming.",
    extentType: "time_uniform",
    payloadType: "frequency_hz",
    confidenceType: "likelihood",
    data: TIME_UNIFORM_DATA,
  },
  {
    id: "spatial_pixel_notehead_centers",
    filename: "spatial_boxes/05_pixel_2d_noteheads.bopp",
    title: "OMR Notehead Centers: 2D Pixel Scatter (Likelihood)",
    category: "omr",
    format: "json",
    description: "pixel extent with object payload: 2D notehead coordinates with inverted Y handling toggle.",
    extentType: "pixel",
    payloadType: "object",
    confidenceType: "likelihood",
    data: PIXEL_2D_DATA,
  },
  {
    id: "text_interval_lyrics_word_spans",
    filename: "text/01_text_interval_lyrics_word_spans.bopp",
    title: "Lyrics Word Spans: Text Interval (Likelihood)",
    category: "music",
    format: "json",
    description: "text_interval extent with lyrics payload: character offset ranges with IETF BCP 47 language validation and transcript highlighting.",
    extentType: "text_interval",
    payloadType: "lyrics",
    confidenceType: "likelihood",
    data: TEXT_INTERVAL_LYRICS_DATA,
  },
  {
    id: "text_tokens_tag_boundaries",
    filename: "text/02_text_tokens_tag_boundaries.bopp",
    title: "Token Boundaries: Text (Likelihood)",
    category: "music",
    format: "json",
    description: "text extent with tag payload: discrete character offset boundaries marking token start positions.",
    extentType: "text",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: TEXT_TOKENS_DATA,
  },
  {
    id: "spatial_spherical_time_trajectory",
    filename: "spatial_boxes/06_spherical_time_trajectory.bopp",
    title: "Spatial Soundfield: Spherical Time (Likelihood)",
    category: "music",
    format: "json",
    description: "spherical_time extent with tag payload: 3D polar azimuth vs elevation trajectory with radius scaling and overview timeline brush.",
    extentType: "spherical_time",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: SPHERICAL_TIME_DATA,
  },
  {
    id: "spatial_cartesian_time_trajectory",
    filename: "spatial_boxes/07_cartesian_time_trajectory.bopp",
    title: "Microphone Array: Cartesian Time (Likelihood)",
    category: "music",
    format: "json",
    description: "cartesian_time extent with tag payload: 3D Cartesian coordinates [x, y, z] over time with overview timeline brush.",
    extentType: "cartesian_time",
    payloadType: "tag",
    confidenceType: "likelihood",
    data: CARTESIAN_TIME_DATA,
  },
  {
    id: "interval_note_spn_pianoroll",
    filename: "time_intervals/19_note_spn_pianoroll.bopp",
    title: "Scientific Pitch Notation: SPN Piano Roll (Likelihood)",
    category: "music",
    format: "json",
    description: "time_interval extent with note payload: Scientific Pitch Notation strings with Unicode accidentals mapped to piano roll.",
    extentType: "time_interval",
    payloadType: "note",
    confidenceType: "likelihood",
    data: NOTE_SPN_DATA,
  },
  {
    id: "symbolic_score_quarter_float_notes",
    filename: "symbolic_midi_score/08_score_quarter_float_notes.bopp",
    title: "Score Beat Points: Float Quarters (No Confidence)",
    category: "score",
    format: "json",
    description: "score_quarter_float extent with note payload: continuous floating-point score beat positions.",
    extentType: "score_quarter_float",
    payloadType: "note",
    data: SCORE_QUARTER_FLOAT_DATA,
  },
  {
    id: "symbolic_score_interval_float_chords",
    filename: "symbolic_midi_score/09_score_interval_float_chords.bopp",
    title: "Chords: Float Score Quarters (Likelihood)",
    category: "score",
    format: "json",
    description: "score_interval_float extent with chord payload: floating-point quarter intervals with likelihood confidence.",
    extentType: "score_interval_float",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: SCORE_INTERVAL_FLOAT_DATA,
  },
];

