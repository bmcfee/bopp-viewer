/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Media Linker Engine for BOPP Annotations
 * Handles Drag & Drop linking of audio files (.wav, .mp3, .ogg) and image files (.png, .jpg)
 * Intelligently validates compatibility between media type and annotation extent/payload.
 */

import type { BoppAnnotation } from '../types/bopp';
import {
  noteNameToMidi,
  annotationToTabular,
  getRecordStartSeconds,
  getRecordDurationSeconds,
} from './boppParser';

export type LinkedMediaType = 'audio' | 'image' | null;

export interface LinkedMedia {
  type: 'audio' | 'image';
  file: File | null;
  url: string;
  name: string;
  size: number;
  duration?: number; // For audio in seconds
  width?: number; // For images in pixels
  height?: number; // For images in pixels
  audioBuffer?: AudioBuffer;
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  mediaType: 'audio' | 'image';
  title: string;
  description: string;
  featureSummary: string;
}

/**
 * Validates whether the given media object (audio or image) makes sense
 * to link with the active BOPP annotation.
 */
export function checkMediaCompatibility(
  fileType: string,
  fileName: string,
  annotation: BoppAnnotation
): CompatibilityCheckResult {
  const isAudio =
    fileType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|flac|m4a|aac|weba)$/i.test(fileName);

  const isImage =
    fileType.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(fileName);

  const extentType = annotation.extent?.extent_type;
  const payloadType = annotation.payload.payload_type;

  if (isImage) {
    if (extentType === 'pixel_box') {
      return {
        compatible: true,
        mediaType: 'image',
        title: 'Optical / Image Alignment Active',
        description: `This image will be loaded as the visual background for optical bounding boxes (${payloadType}).`,
        featureSummary: 'Overlay interactive BOPP bounding boxes directly on top of the image',
      };
    } else {
      return {
        compatible: false,
        mediaType: 'image',
        title: 'Image Media Incompatible',
        description: `Current annotation is a temporal observation (${extentType} / ${payloadType}). Image objects can only be linked with spatial 'pixel_box' annotations (e.g. Sheet Music OMR).`,
        featureSummary: 'Please provide an audio file (.mp3, .wav) for temporal annotations.',
      };
    }
  }

  if (isAudio) {
    if (extentType === 'pixel_box') {
      return {
        compatible: false,
        mediaType: 'audio',
        title: 'Audio Media Incompatible',
        description: `Current annotation is a spatial optical document (${extentType}). Audio files cannot be aligned with pixel coordinate bounding boxes.`,
        featureSummary: 'Please provide an image file (.png, .jpg) for pixel bounding box annotations.',
      };
    }

    const hasSpectrogram =
      extentType === 'time_frequency_box' ||
      payloadType === 'pitch_contour' ||
      payloadType === 'note_hz';

    return {
      compatible: true,
      mediaType: 'audio',
      title: hasSpectrogram ? 'Audio & Spectrogram Alignment' : 'Audio Playhead Synchronization',
      description: hasSpectrogram
        ? `Linked audio playback synchronized with time axis, plus real-time FFT spectrogram rendering aligned underneath ${payloadType} annotations.`
        : `Linked master audio playback with synchronized cursor, scrub, and time seeking across the ${extentType} timeline.`,
      featureSummary: hasSpectrogram
        ? 'Synchronized audio playback + FFT Spectrogram background'
        : 'Synchronized master audio playback & timeline playhead',
    };
  }

  return {
    compatible: false,
    mediaType: 'audio',
    title: 'Unsupported Media Type',
    description: `File '${fileName}' is not recognized as an audio or image file.`,
    featureSummary: 'Please drag an audio file (.mp3, .wav) or an image file (.png, .jpg).',
  };
}

/**
 * Generates an authentic demonstration sheet music SVG image for pixel_box OMR testing
 */
export function generateDemoSheetMusicUrl(): string {
  const width = 800;
  const height = 400;
  // Calibrated to align with BOPP spatial_omr_pixels ground truth bounding boxes:
  // Treble Clef: [45, 120, 180, 65]
  // Time Signature: [240, 115, 75, 70]
  // C4: [330, 95, 45, 110]
  // E4: [390, 85, 45, 120]
  // G4: [450, 75, 45, 130]
  // C5: [520, 65, 50, 140]
  // Barline: [590, 90, 80, 20]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#fffcf2; font-family: serif;">
    <!-- Stave lines -->
    <defs>
      <pattern id="stave" width="100" height="40" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#475569" stroke-width="1.5"/>
        <line x1="0" y1="10" x2="100" y2="10" stroke="#475569" stroke-width="1.5"/>
        <line x1="0" y1="20" x2="100" y2="20" stroke="#475569" stroke-width="1.5"/>
        <line x1="0" y1="30" x2="100" y2="30" stroke="#475569" stroke-width="1.5"/>
        <line x1="0" y1="40" x2="100" y2="40" stroke="#475569" stroke-width="1.5"/>
      </pattern>
    </defs>

    <!-- Header Title -->
    <text x="400" y="38" font-size="20" font-weight="bold" text-anchor="middle" fill="#0f172a">Prelude in C Major - Optical Sheet Music (OMR)</text>
    <text x="400" y="58" font-size="12" font-style="italic" text-anchor="middle" fill="#64748b">BOPP Bounded Observation Payload Protocol Ground Truth Sample</text>

    <!-- Main System Staves -->
    <rect x="30" y="130" width="740" height="40" fill="url(#stave)" />
    <rect x="30" y="250" width="740" height="40" fill="url(#stave)" />

    <!-- System Start Bar lines -->
    <line x1="30" y1="130" x2="30" y2="170" stroke="#1e293b" stroke-width="2.5"/>
    <line x1="770" y1="130" x2="770" y2="170" stroke="#1e293b" stroke-width="2.5"/>

    <!-- 1. Treble Clef Graphic (aligned inside box [45, 120, 180, 65]) -->
    <text x="135" y="168" font-size="58" fill="#1e293b" font-family="serif" text-anchor="middle">𝄞</text>

    <!-- 2. Time Signature 4/4 (aligned inside box [240, 115, 75, 70]) -->
    <text x="277.5" y="146" font-size="24" font-weight="bold" text-anchor="middle" fill="#1e293b">4</text>
    <text x="277.5" y="172" font-size="24" font-weight="bold" text-anchor="middle" fill="#1e293b">4</text>

    <!-- 3. Notes on Stave -->
    <!-- C4 (aligned inside box [330, 95, 45, 110]) -->
    <ellipse cx="352.5" cy="180" rx="7.5" ry="5.5" transform="rotate(-20 352.5 180)" fill="#1e293b" />
    <line x1="338" y1="180" x2="367" y2="180" stroke="#1e293b" stroke-width="1.5"/>
    <line x1="359" y1="180" x2="359" y2="98" stroke="#1e293b" stroke-width="1.8"/>

    <!-- E4 (aligned inside box [390, 85, 45, 120]) -->
    <ellipse cx="412.5" cy="170" rx="7.5" ry="5.5" transform="rotate(-20 412.5 170)" fill="#1e293b" />
    <line x1="419" y1="170" x2="419" y2="88" stroke="#1e293b" stroke-width="1.8"/>

    <!-- G4 (aligned inside box [450, 75, 45, 130]) -->
    <ellipse cx="472.5" cy="160" rx="7.5" ry="5.5" transform="rotate(-20 472.5 160)" fill="#1e293b" />
    <line x1="479" y1="160" x2="479" y2="78" stroke="#1e293b" stroke-width="1.8"/>

    <!-- C5 (aligned inside box [520, 65, 50, 140]) -->
    <ellipse cx="545" cy="140" rx="7.5" ry="5.5" transform="rotate(-20 545 140)" fill="#1e293b" />
    <line x1="551.5" y1="140" x2="551.5" y2="68" stroke="#1e293b" stroke-width="1.8"/>

    <!-- 4. Measure Barline Header Bracket & Line (aligned inside box [590, 90, 80, 20]) -->
    <rect x="592" y="92" width="76" height="16" rx="3" fill="#334155" opacity="0.9" />
    <text x="630" y="104" font-size="8.5" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">BAR 1</text>
    <line x1="630" y1="108" x2="630" y2="170" stroke="#1e293b" stroke-width="2.5"/>
  </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}

/**
 * Encodes a mono 16-bit PCM WAV Blob URL from a sample generator function.
 */
function synthesizeMonoWavBlobUrl(
  durationSec: number,
  sampleRate: number,
  sampleFn: (t: number, sampleIndex: number) => number,
  gainScale = 24000
): string {
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let writeOffset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = sampleFn(t, i);
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * gainScale)));
    view.setInt16(writeOffset, int16, true);
    writeOffset += 2;
  }

  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
}

/**
 * Creates a synthesized WAV file demo blob tailored to the current annotation
 * For time-frequency bounding boxes, it synthesizes bird calls at the exact box frequencies!
 * For pitch contour, it synthesizes a vocal glide following the F0 curve!
 */
export function generateDemoAudioForAnnotation(annotation: BoppAnnotation): { url: string; name: string; duration: number } {
  const sampleRate = 22050;
  const extentType = annotation.extent?.extent_type;
  const payloadType = annotation.payload.payload_type;
  const records = annotationToTabular(annotation);

  const getRecordStartSec = (r: any): number => getRecordStartSeconds(r) ?? 0;
  const getRecordExplicitDurSec = (r: any): number => getRecordDurationSeconds(r, 0);

  let timelineMaxSec = 0;
  for (const r of records) {
    const endSec = getRecordStartSec(r) + getRecordExplicitDurSec(r);
    if (endSec > timelineMaxSec) {
      timelineMaxSec = endSec;
    }
  }

  // 1. Time-Frequency Boxes (e.g. Bioacoustics / Birds)
  if (extentType === 'time_frequency_box') {
    const totalDuration = timelineMaxSec > 0 ? timelineMaxSec : 12.0;
    const url = synthesizeMonoWavBlobUrl(totalDuration, sampleRate, (t) => {
      let sampleVal = 0;
      for (let k = 0; k < records.length; k++) {
        const r = records[k];
        const boxStart = getRecordStartSec(r);
        const boxDur = getRecordExplicitDurSec(r) || 1;
        const boxFmin = typeof r.freq_min === 'number' ? r.freq_min : 1000;
        const boxFmax = typeof r.freq_max === 'number' ? r.freq_max : 4000;
        const tag = String(r.value ?? '').toLowerCase();

        if (t >= boxStart && t < boxStart + boxDur) {
          const relT = (t - boxStart) / boxDur;
          const noteT = t - boxStart;

          if (tag.includes('trill')) {
            const centerFreq = (boxFmin + boxFmax) / 2;
            const span = (boxFmax - boxFmin) * 0.4;
            const instFreq = centerFreq + span * Math.sin(2 * Math.PI * 28 * noteT);
            const env = Math.sin(Math.PI * relT) * 0.6;
            sampleVal += Math.sin(2 * Math.PI * instFreq * noteT) * env;
          } else if (tag.includes('hoot')) {
            const freq = (boxFmin + boxFmax) / 2;
            const env = Math.sin(Math.PI * relT) * 0.8;
            sampleVal += Math.sin(2 * Math.PI * freq * noteT) * env;
          } else if (tag.includes('drum')) {
            const clicksPerSec = 16;
            const clickPhase = (noteT * clicksPerSec) % 1;
            const burstEnv = clickPhase < 0.25 ? Math.exp(-clickPhase * 30) : 0;
            const freq = (boxFmin + boxFmax) / 2;
            sampleVal += Math.sin(2 * Math.PI * freq * noteT) * burstEnv * 0.7;
          } else {
            const instFreq = boxFmin + (boxFmax - boxFmin) * Math.pow(relT, 0.8);
            const env = Math.sin(Math.PI * relT) * 0.7;
            sampleVal += Math.sin(2 * Math.PI * instFreq * noteT) * env;
          }
        }
      }
      return sampleVal + (Math.random() * 2 - 1) * 0.015;
    }, 24000);

    return {
      url,
      name: 'Forest_Bioacoustics_Recording.wav',
      duration: totalDuration,
    };
  }

  // 2. Pitch Contour (Continuous Vocal F0) - Strictly Sonifies Voiced Segments
  if (payloadType === 'pitch_contour') {
    const maxT = timelineMaxSec > 0 ? timelineMaxSec : 3.5;
    let phase = 0;
    let timePtr = 0;

    const url = synthesizeMonoWavBlobUrl(maxT, sampleRate, (t) => {
      while (timePtr < records.length - 1 && getRecordStartSec(records[timePtr + 1]) <= t) {
        timePtr++;
      }
      const pt = records[timePtr];
      const freq = typeof pt?.frequency === 'number'
        ? pt.frequency
        : typeof pt?.value === 'number'
        ? pt.value
        : 440;
      const rawVoicing = pt?.voicing ?? (pt as any)?.voiced;
      const isVoiced =
        rawVoicing === 1 ||
        rawVoicing === true ||
        (typeof rawVoicing === 'number' && rawVoicing >= 0.5) ||
        (typeof rawVoicing === 'string' && ['voiced', 'true', '1', 'v'].includes(rawVoicing.toLowerCase().trim()));

      if (isVoiced && freq >= 40 && freq <= 3200) {
        phase += (2 * Math.PI * freq) / sampleRate;
        return Math.sin(phase) * 0.6 + Math.sin(phase * 2) * 0.25 + Math.sin(phase * 3) * 0.1;
      }
      return 0;
    }, 22000);

    return {
      url,
      name: 'Vocal_Melody_Stem.wav',
      duration: maxT,
    };
  }

  // 3. MIDI Notes (e.g. Bach Invention in ticks or Mozart in score quarters / seconds)
  if (payloadType === 'note_midi') {
    const isMidiTicks = extentType?.includes('midi') || extentType?.includes('tick');
    const notes: { t: number; d: number; freq: number }[] = [];

    for (let k = 0; k < records.length; k++) {
      const r = records[k];
      const rawNote = r.value;
      const midi: number = typeof rawNote === 'number'
        ? rawNote
        : typeof rawNote === 'string'
        ? (noteNameToMidi(rawNote) ?? 60)
        : 60;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const startSec = getRecordStartSec(r);
      const explicitDur = getRecordExplicitDurSec(r);
      const durSec = explicitDur > 0 ? explicitDur : 0.25;
      notes.push({ t: startSec, d: durSec, freq });
    }
    const maxNoteEnd = timelineMaxSec > 0 ? timelineMaxSec : 4.0;

    const url = synthesizeMonoWavBlobUrl(maxNoteEnd, sampleRate, (t) => {
      let sampleVal = 0;
      for (const n of notes) {
        if (t >= n.t && t < n.t + n.d) {
          const relT = t - n.t;
          const env = Math.exp(-relT * 3.0) * Math.sin(Math.min(1, relT * 50) * Math.PI * 0.5);
          sampleVal += Math.sin(2 * Math.PI * n.freq * relT) * env * 0.5;
        }
      }
      return sampleVal;
    }, 24000);

    return {
      url,
      name: isMidiTicks ? 'Bach_Invention_MidiStem.wav' : 'Piano_MidiStem.wav',
      duration: maxNoteEnd,
    };
  }

  // 4. Chords (Harmonic Progressions matching exact annotation timestamps)
  if (payloadType === 'chord' && records.length > 0) {
    const rootPitchMap: Record<string, number> = {
      C: 48, 'C#': 49, Db: 49, D: 50, 'D#': 51, Eb: 51, E: 52, F: 53,
      'F#': 54, Gb: 54, G: 55, 'G#': 56, Ab: 56, A: 57, 'A#': 58, Bb: 58, B: 59,
    };

    interface ChordEvent {
      t: number;
      d: number;
      freqs: number[];
    }
    const chordEvents: ChordEvent[] = [];

    for (let k = 0; k < records.length; k++) {
      const r = records[k];
      const chordStr = String(r.value || '');
      if (chordStr === 'N' || chordStr === 'X' || !chordStr) continue;

      const startSec = getRecordStartSec(r);
      const explicitDur = getRecordExplicitDurSec(r);
      const nextStartSec = k < records.length - 1 ? getRecordStartSec(records[k + 1]) : undefined;
      const durSec = explicitDur > 0
        ? explicitDur
        : typeof nextStartSec === 'number' && nextStartSec > startSec
        ? nextStartSec - startSec
        : 0.5;

      const match = chordStr.match(/^([A-G][b#]?)(?::(.*))?$/);
      if (!match) continue;
      const rootName = match[1];
      const quality = match[2] || 'maj';
      const rootMidi = rootPitchMap[rootName] ?? 48;
      const isMinor = quality.includes('min') || quality.includes('dim');
      const isSeventh = quality.includes('7');
      const intervals = [0, isMinor ? 3 : 4, 7];
      if (isSeventh) intervals.push(isMinor ? 10 : 11);

      const freqs = intervals.map(semis => 440 * Math.pow(2, (rootMidi + semis - 69) / 12));
      chordEvents.push({ t: startSec, d: durSec, freqs });
    }
    const maxChordEnd = timelineMaxSec > 0 ? timelineMaxSec : 4.0;

    const url = synthesizeMonoWavBlobUrl(maxChordEnd, sampleRate, (t) => {
      let sampleVal = 0;
      for (const c of chordEvents) {
        if (t >= c.t && t < c.t + c.d) {
          const relT = t - c.t;
          const env = Math.exp(-relT * 1.8) * Math.sin(Math.min(1, relT * 40) * Math.PI * 0.5);
          for (const f of c.freqs) {
            sampleVal += (Math.sin(2 * Math.PI * f * relT) * 0.7 + Math.sin(4 * Math.PI * f * relT) * 0.3) * env * 0.22;
          }
        }
      }
      return sampleVal;
    }, 24000);

    return {
      url,
      name: 'Harmonic_Chords_Audio.wav',
      duration: maxChordEnd,
    };
  }

  // 5. Beats (Rhythmic Metronome / Pulse matching exact annotation timestamps)
  if (payloadType === 'beat') {
    const maxBeatEnd = timelineMaxSec > 0 ? timelineMaxSec : 4.0;
    const url = synthesizeMonoWavBlobUrl(maxBeatEnd, sampleRate, (t) => {
      let sampleVal = 0;
      for (let k = 0; k < records.length; k++) {
        const bTime = getRecordStartSec(records[k]);
        const isDownbeat = records[k].value === 1;
        const freq = isDownbeat ? 880 : 440;
        if (t >= bTime && t < bTime + 0.08) {
          const noteT = t - bTime;
          const env = Math.exp(-noteT * 50);
          sampleVal += Math.sin(2 * Math.PI * freq * noteT) * env * (isDownbeat ? 0.7 : 0.4);
        }
      }
      return sampleVal;
    }, 24000);

    return {
      url,
      name: 'Rhythmic_Beats_Track.wav',
      duration: maxBeatEnd,
    };
  }

  // 6. Onsets (Acoustic Transient Detection Events matching exact timestamps)
  if (payloadType === 'onset') {
    const maxOnsetEnd = timelineMaxSec > 0 ? timelineMaxSec : 4.0;
    const url = synthesizeMonoWavBlobUrl(maxOnsetEnd, sampleRate, (t) => {
      let sampleVal = 0;
      for (let k = 0; k < records.length; k++) {
        const oTime = getRecordStartSec(records[k]);
        if (t >= oTime && t < oTime + 0.06) {
          const noteT = t - oTime;
          const env = Math.exp(-noteT * 70);
          sampleVal += Math.sin(2 * Math.PI * 1200 * noteT) * env * 0.6;
        }
      }
      return sampleVal;
    }, 24000);

    return {
      url,
      name: 'Onsets_Click_Track.wav',
      duration: maxOnsetEnd,
    };
  }

  // 7. Tone Frequencies in Hz
  if (payloadType === 'note_hz' || (payloadType as string) === 'hz') {
    const maxToneEnd = timelineMaxSec > 0 ? timelineMaxSec : 4.0;
    const url = synthesizeMonoWavBlobUrl(maxToneEnd, sampleRate, (t) => {
      let sampleVal = 0;
      for (let k = 0; k < records.length; k++) {
        const start = getRecordStartSec(records[k]);
        const dur = getRecordExplicitDurSec(records[k]) || 0.5;
        const f = Number(records[k].value) || 440;
        if (t >= start && t < start + dur) {
          const relT = t - start;
          const env = Math.exp(-relT * 2.0) * Math.sin(Math.min(1, relT * 40) * Math.PI * 0.5);
          sampleVal += Math.sin(2 * Math.PI * f * relT) * env * 0.5;
        }
      }
      return sampleVal;
    }, 24000);

    return {
      url,
      name: 'Tones_Audio_Track.wav',
      duration: maxToneEnd,
    };
  }

  // 8. Fallback / Default: Mozart Piano Sonata Motif
  const durationSec = timelineMaxSec > 0 ? timelineMaxSec : 11.8;
  const notes = [
    { t: 0.0, d: 0.9, freq: 523.25 }, // C5
    { t: 1.0, d: 0.45, freq: 329.63 }, // E4
    { t: 1.5, d: 0.45, freq: 392.0 }, // G4
    { t: 2.0, d: 0.8, freq: 493.88 }, // B4
    { t: 3.0, d: 0.8, freq: 523.25 }, // C5
    { t: 4.0, d: 0.8, freq: 392.0 }, // G4
    { t: 5.0, d: 0.3, freq: 440.0 }, // A4
    { t: 5.33, d: 0.3, freq: 392.0 }, // G4
    { t: 5.66, d: 0.3, freq: 349.23 }, // F4
    { t: 6.0, d: 0.3, freq: 392.0 }, // G4
    { t: 6.33, d: 0.3, freq: 349.23 }, // F4
    { t: 6.66, d: 0.3, freq: 329.63 }, // E4
    { t: 7.0, d: 0.9, freq: 349.23 }, // F4
    { t: 8.0, d: 0.9, freq: 329.63 }, // E4
    { t: 9.0, d: 0.9, freq: 293.66 }, // D4
    { t: 10.0, d: 1.8, freq: 261.63 }, // C4
  ];

  const url = synthesizeMonoWavBlobUrl(durationSec, sampleRate, (timeSec) => {
    const activeNote = notes.find(n => timeSec >= n.t && timeSec < n.t + n.d);
    if (!activeNote) return 0;
    const noteTime = timeSec - activeNote.t;
    const env = Math.exp(-noteTime * 2.5);
    const wave =
      Math.sin(2 * Math.PI * activeNote.freq * noteTime) * 0.75 +
      Math.sin(4 * Math.PI * activeNote.freq * noteTime) * 0.25;
    return wave * env * 0.6;
  }, 32767);

  return {
    url,
    name: 'Mozart_K545_Sonata_Motif.wav',
    duration: durationSec,
  };
}

export function generateDemoAudioWav(durationSec = 11.8): string {
  const res = generateDemoAudioForAnnotation({
    media_id: 'default',
    bopp_version: '1.0',
    payload: { payload_type: 'chord', value: [] }
  });
  return res.url;
}

