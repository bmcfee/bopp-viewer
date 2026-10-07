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
    curator: "Brian McFee / LabROSA",
    annotator_id: "Isophonics / MIREX",
    annotation_type: "chord",
    version: "1.0",
    description: "Harmonic chord annotations for R.E.M. - Drive from the Isophonics reference corpus",
    dataset: "Isophonics Reference Corpus",
    annotation_tools: "Sonic Visualiser / mir_eval",
    license: "CC-BY-4.0",
    created: "2024-01-15T12:00:00Z",
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

const MOZART_DATA: BoppAnnotation = {
  media_id: "audio:mozart_sonata_c_k545",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "human",
    annotator_id: "musicologist_01",
    tool: "midi_score_transcriber",
    description: "Mozart Piano Sonata No. 16 in C major, K. 545 (Allegro opening theme)"
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

// Hierarchical Song Structure
const sections = [
  { t: 0.0, d: 12.5, label: "Intro", level: 0, conf: 0.95 },
  { t: 12.5, d: 34.0, label: "Verse 1", level: 0, conf: 0.92 },
  { t: 46.5, d: 28.0, label: "Chorus 1", level: 0, conf: 0.98 },
  { t: 74.5, d: 22.0, label: "Verse 2", level: 0, conf: 0.89 },
  { t: 96.5, d: 29.5, label: "Chorus 2", level: 0, conf: 0.97 },
  { t: 126.0, d: 20.0, label: "Guitar Solo", level: 0, conf: 0.91 },
  { t: 146.0, d: 32.0, label: "Chorus 3", level: 0, conf: 0.96 },
  { t: 178.0, d: 15.0, label: "Outro", level: 0, conf: 0.94 },
  // Level 1 sub-phrases
  { t: 12.5, d: 17.0, label: "Verse 1A", level: 1, conf: 0.88 },
  { t: 29.5, d: 17.0, label: "Verse 1B", level: 1, conf: 0.85 },
  { t: 46.5, d: 14.0, label: "Chorus Part 1", level: 1, conf: 0.93 },
  { t: 60.5, d: 14.0, label: "Chorus Hook", level: 1, conf: 0.95 },
  { t: 74.5, d: 11.0, label: "Verse 2A", level: 1, conf: 0.87 },
  { t: 85.5, d: 11.0, label: "Verse 2B", level: 1, conf: 0.86 },
  { t: 96.5, d: 14.0, label: "Chorus Part 1", level: 1, conf: 0.92 },
  { t: 110.5, d: 15.5, label: "Chorus Hook", level: 1, conf: 0.94 }
].sort((a, b) => a.level - b.level || a.t - b.t);

const STRUCTURE_DATA: BoppAnnotation = {
  media_id: "spotify:track:4cOdK2wGLETKBW3PvgPWqT",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "crowd",
    description: "Multi-level hierarchical musical form analysis with inter-annotator agreement",
    tool: "SalienceFormAnnotator"
  },
  extent: {
    extent_type: "time_interval",
    time: sections.map(s => s.t),
    duration: sections.map(s => s.d)
  },
  payload: {
    payload_type: "multi_segment",
    label: sections.map(s => s.label),
    level: sections.map(s => s.level)
  },
  confidence: {
    confidence_type: "agreement",
    n_annotators_common: 5,
    confidence: sections.map(s => s.conf)
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
    description: "Automated bioacoustic event detection in temperate forest habitat",
    tool: "BirdNET_Spectrogram_Detector"
  },
  extent: {
    extent_type: "time_frequency_box",
    time: tfBoxes.map(b => b.t),
    duration: tfBoxes.map(b => b.d),
    freq_min: tfBoxes.map(b => b.fmin),
    freq_max: tfBoxes.map(b => b.fmax)
  },
  payload: {
    payload_type: "tag_open",
    value: tfBoxes.map(b => b.tag)
  },
  confidence: {
    confidence_type: "likelihood",
    confidence: tfBoxes.map(b => b.conf)
  }
};

// Continuous Pitch Contour (F0)
const pitchContourPoints = Array.from({ length: 70 }, (_, i) => {
  const t = +(i * 0.05).toFixed(3);
  const base = 440 + 80 / (1 + Math.exp(-0.8 * (t - 1.5)));
  const vibrato = t > 0.5 ? 6 * Math.sin(2 * Math.PI * 5.5 * t) : 0;
  // Natural vocal phrasing: voiced phrases with an unvoiced breath pause (1.4s-1.7s) and unvoiced tail (>= 3.1s)
  const isVoiced = (t >= 0.15 && t < 1.4) || (t >= 1.7 && t < 3.1);
  return {
    t,
    frequency: +(base + vibrato).toFixed(2),
    voicing: isVoiced ? 1 : 0
  };
});

const PITCH_DATA: BoppAnnotation = {
  media_id: "audio:vocal_melody_stem",
  bopp_version: "1.0",
  metadata: {
    metadata_type: "algorithm",
    tool: "CREPE_Pitch_Tracker",
    description: "Fundamental frequency contour (F0 in Hz) with pitch vibrato and voicing"
  },
  extent: {
    extent_type: "time",
    time: pitchContourPoints.map(p => p.t)
  },
  payload: {
    payload_type: "pitch_contour",
    value: pitchContourPoints.map(p => ({ frequency: p.frequency, voicing: p.voicing }))
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
    description: "Continuous dynamic affective appraisal on Russell-Thayer Circumplex space",
    annotator_id: "affect_evaluator_group"
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
    payload_type: "tag_open",
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
    curator: "Brian McFee",
    description: "Global musical key and mode distribution across the entire media object with multiple candidate annotations (75% C Major, 25% A Minor)",
    dataset: "Harmonic Reference Benchmarks",
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
    value: ["C:min", "Eb:maj", "G:min", "C:min", "C:maj"]
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

// 4. TEMPO: Global (No Extent at all)
const TEMPO_GLOBAL_DATA: BoppAnnotation = {
  media_id: "audio:funk_drum_loop_master",
  bopp_version: "1.0",
  metadata: {
    annotator_id: "bpm_detector_01",
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
    curator: "MusicBrainz / AcousticBrainz",
    description: "Global genre, instrumentation, and mood tags describing the entire media object",
  },
  payload: {
    payload_type: "tag_open",
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
    description: "Active instrument section presence over time_interval bounds",
  },
  extent: {
    extent_type: "time_interval",
    time: [0.0, 12.0, 28.0, 44.0, 60.0],
    duration: [12.0, 16.0, 16.0, 16.0, 20.0]
  },
  payload: {
    payload_type: "tag_open",
    value: ["Solo Cello", "String Section", "Brass & Woodwinds", "Full Tutti", "Decrescendo Strings"]
  }
};

// 9. CHORD: MIDI Interval Extent (Ticks)
const CHORDS_MIDI_TICKS_DATA: BoppAnnotation = {
  media_id: "midi:standard_type_0_progression",
  bopp_version: "1.0",
  metadata: {
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

export const SAMPLE_DATASETS: SampleFileInfo[] = [
  {
    id: "drive_bopp",
    filename: "benchmarks/drive.bopp",
    title: "Drive Chords (Benchmark)",
    category: "benchmark",
    format: "json",
    description: "Official BOPP benchmark test file from bmcfee/bopp repository: TimeInterval extent, Harte chord payload, Likelihood confidence ratings.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_DATA,
  },
  {
    id: "drive_msgpack",
    filename: "benchmarks/drive.bopp.msgpack",
    title: "Drive Chords (MessagePack Binary)",
    category: "benchmark",
    format: "msgpack",
    description: "Binary MessagePack serialized version of drive.bopp, decoded client-side via @msgpack/msgpack without Python kernel.",
    extentType: "time_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: DRIVE_DATA,
  },
  {
    id: "longbeats_bopp",
    filename: "benchmarks/longbeats.bopp",
    title: "Longbeats Rhythmic Beats (Benchmark)",
    category: "benchmark",
    format: "json",
    description: "Official BOPP benchmark dataset: Time extent with Beat position integers (downbeat 1 and metric beats 2, 3, 4).",
    extentType: "time",
    payloadType: "beat",
    data: LONGBEATS_DATA,
  },
  {
    id: "longbeats_msgpack",
    filename: "benchmarks/longbeats.bopp.msgpack",
    title: "Longbeats Rhythmic Beats (MessagePack Binary)",
    category: "benchmark",
    format: "msgpack",
    description: "Binary MessagePack serialization of longbeats.bopp containing rhythmic beat events.",
    extentType: "time",
    payloadType: "beat",
    data: LONGBEATS_DATA,
  },
  {
    id: "mozart_piano_k545",
    filename: "annotations/mozart_piano_k545.bopp",
    title: "Mozart K.545 MIDI Piano Roll",
    category: "music",
    format: "json",
    description: "MIDI Interval extent with Note_Midi pitch payload and Likelihood confidence. Visualized as an interactive piano roll keyboard grid.",
    extentType: "time_interval",
    payloadType: "note_midi",
    confidenceType: "likelihood",
    data: MOZART_DATA,
  },
  {
    id: "song_structure",
    filename: "annotations/song_structure.bopp",
    title: "Hierarchical Song Structure",
    category: "music",
    format: "json",
    description: "TimeInterval extent with Multi_Segment payload (Level 0 sections, Level 1 sub-phrases) and inter-annotator Agreement confidence.",
    extentType: "time_interval",
    payloadType: "multi_segment",
    confidenceType: "agreement",
    data: STRUCTURE_DATA,
  },
  {
    id: "vocal_f0_contour",
    filename: "annotations/vocal_melody_f0.bopp",
    title: "Vocal Melody Pitch Contour (F0)",
    category: "music",
    format: "json",
    description: "Continuous vocal pitch contour in Hertz with voicing state over time.",
    extentType: "time",
    payloadType: "pitch_contour",
    data: PITCH_DATA,
  },
  {
    id: "bioacoustic_birds",
    filename: "annotations/bioacoustic_birds.bopp",
    title: "Bioacoustic TF Bounding Boxes",
    category: "bioacoustic",
    format: "json",
    description: "Time-Frequency box extent (start time, duration, minimum frequency, maximum frequency in Hz) with species tag labels.",
    extentType: "time_frequency_box",
    payloadType: "tag_open",
    confidenceType: "likelihood",
    data: TF_DATA,
  },
  {
    id: "mood_circumplex",
    filename: "annotations/mood_thayer_trajectory.bopp",
    title: "Affective Mood Circumplex (Thayer)",
    category: "emotion",
    format: "json",
    description: "Russell-Thayer 2D circumplex mood tracking (Valence & Arousal) with Variance confidence ratings and 2D spatial trajectory.",
    extentType: "time",
    payloadType: "mood_thayer",
    confidenceType: "variance",
    data: MOOD_DATA,
  },
  {
    id: "score_quarter",
    filename: "annotations/chopin_score_quarters.bopp",
    title: "Score Fraction Intervals (Chopin)",
    category: "score",
    format: "json",
    description: "Musical score notation time represented as rational fractions [numerator, denominator] for quarter notes and durations.",
    extentType: "score_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: SCORE_DATA,
  },
  {
    id: "pixel_sheet_music",
    filename: "annotations/omr_sheet_music_boxes.bopp",
    title: "OMR Sheet Music Bounding Boxes",
    category: "omr",
    format: "json",
    description: "Pixel box extent (x, y, width, height) representing musical glyph detections in Optical Music Recognition.",
    extentType: "pixel_box",
    payloadType: "tag_open",
    data: PIXEL_DATA,
  },
  // --- MULTI-EXTENT DEMONSTRATIONS ---
  {
    id: "key_global",
    filename: "annotations/key_global_media.bopp",
    title: "Global Key Mode (No Extent)",
    category: "music",
    format: "json",
    description: "Demonstrates key_mode payload with NO extent at all (global multiple candidate keys with likelihood confidences across media object).",
    extentType: "none",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_GLOBAL_DATA,
  },
  {
    id: "key_modulation_time",
    filename: "annotations/key_modulations_time.bopp",
    title: "Key Modulations (Time Interval)",
    category: "music",
    format: "json",
    description: "Demonstrates key_mode payload with time_interval extent (harmonic key changes in seconds).",
    extentType: "time_interval",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_MODULATION_DATA,
  },
  {
    id: "key_score_quarters",
    filename: "annotations/key_score_quarters.bopp",
    title: "Key Modulations (Score Interval)",
    category: "score",
    format: "json",
    description: "Demonstrates key_mode payload with score_interval extent (musical notation quarter fractions).",
    extentType: "score_interval",
    payloadType: "key_mode",
    confidenceType: "likelihood",
    data: KEY_SCORE_DATA,
  },
  {
    id: "tempo_global",
    filename: "annotations/tempo_global_bpm.bopp",
    title: "Global Tempo (No Extent)",
    category: "music",
    format: "json",
    description: "Demonstrates tempo payload with NO extent at all (constant track tempo across media object).",
    extentType: "none",
    payloadType: "tempo",
    confidenceType: "likelihood",
    data: TEMPO_GLOBAL_DATA,
  },
  {
    id: "tempo_rubato_time",
    filename: "annotations/tempo_rubato_timeline.bopp",
    title: "Rubato Tempo Curve (Time Interval)",
    category: "music",
    format: "json",
    description: "Demonstrates tempo payload with time_interval extent (expressive rubato changes in seconds).",
    extentType: "time_interval",
    payloadType: "tempo",
    confidenceType: "likelihood",
    data: TEMPO_RUBATO_DATA,
  },
  {
    id: "tempo_metric_beats",
    filename: "annotations/tempo_metric_points.bopp",
    title: "Metric Instantaneous Tempo (Time Points)",
    category: "music",
    format: "json",
    description: "Demonstrates tempo payload with discrete time point extent (tempo estimates at beat timestamps).",
    extentType: "time",
    payloadType: "tempo",
    data: TEMPO_METRIC_DATA,
  },
  {
    id: "tags_global_genres",
    filename: "annotations/tags_global_genres.bopp",
    title: "Global Genres & Moods (No Extent)",
    category: "music",
    format: "json",
    description: "Demonstrates tag_open payload with NO extent at all (global descriptive tags for media object).",
    extentType: "none",
    payloadType: "tag_open",
    confidenceType: "likelihood",
    data: TAGS_GLOBAL_DATA,
  },
  {
    id: "tags_time_intervals",
    filename: "annotations/tags_instrument_intervals.bopp",
    title: "Instrument Presence (Time Interval)",
    category: "music",
    format: "json",
    description: "Demonstrates tag_open payload with time_interval extent (instrument sections active over time).",
    extentType: "time_interval",
    payloadType: "tag_open",
    data: TAGS_TIME_INTERVAL_DATA,
  },
  {
    id: "chords_midi_ticks",
    filename: "annotations/chords_midi_ticks.bopp",
    title: "Chords in MIDI Ticks (MIDI Interval)",
    category: "music",
    format: "json",
    description: "Demonstrates chord payload with midi_interval extent (clock tick durations at 480 PPQ).",
    extentType: "midi_interval",
    payloadType: "chord",
    confidenceType: "likelihood",
    data: CHORDS_MIDI_TICKS_DATA,
  },
  {
    id: "bach_midi_ticks",
    filename: "annotations/bach_invention_midi_ticks.bopp",
    title: "Bach Motif (MIDI Interval Ticks)",
    category: "music",
    format: "json",
    description: "Demonstrates note_midi payload with midi_interval extent (polyphonic notes in MIDI ticks).",
    extentType: "midi_interval",
    payloadType: "note_midi",
    data: BACH_MIDI_TICKS_DATA,
  }
];
