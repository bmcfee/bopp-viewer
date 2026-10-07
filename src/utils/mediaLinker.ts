/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Media Linker Engine for BOPP Annotations
 * Handles Drag & Drop linking of audio files (.wav, .mp3, .ogg) and image files (.png, .jpg)
 * Intelligently validates compatibility between media type and annotation extent/payload.
 */

import type { BoppAnnotation } from '../types/bopp';

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#fffcf2; font-family: serif;">
    <!-- Stave lines -->
    <defs>
      <pattern id="stave" width="100" height="40" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" stroke-width="1.5"/>
        <line x1="0" y1="10" x2="100" y2="10" stroke="#334155" stroke-width="1.5"/>
        <line x1="0" y1="20" x2="100" y2="20" stroke="#334155" stroke-width="1.5"/>
        <line x1="0" y1="30" x2="100" y2="30" stroke="#334155" stroke-width="1.5"/>
        <line x1="0" y1="40" x2="100" y2="40" stroke="#334155" stroke-width="1.5"/>
      </pattern>
    </defs>

    <!-- Header Title -->
    <text x="400" y="45" font-size="22" font-weight="bold" text-anchor="middle" fill="#0f172a">Prelude in C Major - Optical Sheet Music (OMR)</text>
    <text x="400" y="70" font-size="13" font-style="italic" text-anchor="middle" fill="#64748b">BOPP Bounded Observation Payload Protocol Ground Truth Sample</text>

    <!-- Staves -->
    <rect x="30" y="100" width="740" height="40" fill="url(#stave)" />
    <rect x="30" y="240" width="740" height="40" fill="url(#stave)" />

    <!-- Bar lines -->
    <line x1="30" y1="100" x2="30" y2="140" stroke="#1e293b" stroke-width="2.5"/>
    <line x1="770" y1="100" x2="770" y2="140" stroke="#1e293b" stroke-width="2.5"/>
    <line x1="590" y1="100" x2="590" y2="140" stroke="#1e293b" stroke-width="2"/>

    <!-- Treble Clef Graphic approximation -->
    <text x="50" y="135" font-size="52" fill="#1e293b" font-family="serif">𝄞</text>
    <!-- Time Signature 4/4 -->
    <text x="110" y="118" font-size="20" font-weight="bold" fill="#1e293b">4</text>
    <text x="110" y="138" font-size="20" font-weight="bold" fill="#1e293b">4</text>

    <!-- Notes on Stave -->
    <!-- C4 -->
    <ellipse cx="250" cy="148" rx="7" ry="5.5" transform="rotate(-20 250 148)" fill="#1e293b" />
    <line x1="240" y1="148" x2="260" y2="148" stroke="#1e293b" stroke-width="1.5"/>
    <line x1="256" y1="148" x2="256" y2="105" stroke="#1e293b" stroke-width="1.5"/>

    <!-- E4 -->
    <ellipse cx="340" cy="140" rx="7" ry="5.5" transform="rotate(-20 340 140)" fill="#1e293b" />
    <line x1="346" y1="140" x2="346" y2="97" stroke="#1e293b" stroke-width="1.5"/>

    <!-- G4 -->
    <ellipse cx="430" cy="130" rx="7" ry="5.5" transform="rotate(-20 430 130)" fill="#1e293b" />
    <line x1="436" y1="130" x2="436" y2="87" stroke="#1e293b" stroke-width="1.5"/>

    <!-- C5 -->
    <ellipse cx="520" cy="110" rx="7" ry="5.5" transform="rotate(-20 520 110)" fill="#1e293b" />
    <line x1="526" y1="110" x2="526" y2="67" stroke="#1e293b" stroke-width="1.5"/>
  </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
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

  // 1. Time-Frequency Boxes (e.g. Bioacoustics / Birds)
  if (extentType === 'time_frequency_box') {
    const times = annotation.extent?.time || [];
    const durations = annotation.extent?.duration || [];
    const fmins = annotation.extent?.freq_min || [];
    const fmaxs = annotation.extent?.freq_max || [];
    const payloadObj = annotation.payload as any;
    const tags = Array.isArray(payloadObj.value) ? payloadObj.value : [];

    let totalDuration = 12.0;
    for (let i = 0; i < times.length; i++) {
      const end = (times[i] || 0) + (durations[i] || 0);
      if (end > totalDuration) totalDuration = end;
    }
    totalDuration += 0.5;

    const numSamples = Math.floor(sampleRate * totalDuration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
      let sampleVal = 0;

      // Find any active bird calls at this moment
      for (let k = 0; k < times.length; k++) {
        const boxStart = times[k] || 0;
        const boxDur = durations[k] || 1;
        const boxFmin = fmins[k] || 1000;
        const boxFmax = fmaxs[k] || 4000;
        const tag = String(tags[k] || '').toLowerCase();

        if (t >= boxStart && t < boxStart + boxDur) {
          const relT = (t - boxStart) / boxDur; // 0 to 1
          const noteT = t - boxStart;

          if (tag.includes('trill')) {
            // Rapid FM trill
            const centerFreq = (boxFmin + boxFmax) / 2;
            const span = (boxFmax - boxFmin) * 0.4;
            const instFreq = centerFreq + span * Math.sin(2 * Math.PI * 28 * noteT);
            const env = Math.sin(Math.PI * relT) * 0.6;
            sampleVal += Math.sin(2 * Math.PI * instFreq * noteT) * env;
          } else if (tag.includes('hoot')) {
            // Soft pure low tone
            const freq = (boxFmin + boxFmax) / 2;
            const env = Math.sin(Math.PI * relT) * 0.8;
            sampleVal += Math.sin(2 * Math.PI * freq * noteT) * env;
          } else if (tag.includes('drum')) {
            // Rapid acoustic bursts
            const clicksPerSec = 16;
            const clickPhase = (noteT * clicksPerSec) % 1;
            const burstEnv = clickPhase < 0.25 ? Math.exp(-clickPhase * 30) : 0;
            const freq = (boxFmin + boxFmax) / 2;
            sampleVal += Math.sin(2 * Math.PI * freq * noteT) * burstEnv * 0.7;
          } else {
            // Robin Chirp: upward pitch sweep inside box
            const instFreq = boxFmin + (boxFmax - boxFmin) * Math.pow(relT, 0.8);
            const env = Math.sin(Math.PI * relT) * 0.7;
            sampleVal += Math.sin(2 * Math.PI * instFreq * noteT) * env;
          }
        }
      }

      // Add gentle ambient background hiss
      sampleVal += (Math.random() * 2 - 1) * 0.015;

      const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 24000)));
      view.setInt16(writeOffset, int16, true);
      writeOffset += 2;
    }

    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return {
      url: URL.createObjectURL(wavBlob),
      name: 'Forest_Bioacoustics_Recording.wav',
      duration: totalDuration,
    };
  }

  // 2. Pitch Contour (Continuous Vocal F0) - Strictly Sonifies Voiced Segments
  if (payloadType === 'pitch_contour') {
    const rawValues = Array.isArray(annotation.payload.value) ? annotation.payload.value : [];
    let maxT = 3.5;
    const extentObj = annotation.extent as any;
    const timeArr = extentObj?.time && Array.isArray(extentObj.time) ? extentObj.time : [];
    if (timeArr.length > 0) {
      maxT = Math.max(...timeArr) + 0.1;
    }

    const numSamples = Math.floor(sampleRate * maxT);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
    let phase = 0;
    let timePtr = 0;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;

      // Find closest time point in extent
      while (timePtr < timeArr.length - 1 && timeArr[timePtr + 1] <= t) {
        timePtr++;
      }
      const pt = rawValues[timePtr] as any;
      const freq = (pt && typeof pt.frequency === 'number') ? pt.frequency : 440;
      // Strictly voiced: only sonify when voicing is active!
      const isVoiced = pt?.voicing === 1 || pt?.voicing === true;

      let sampleVal = 0;
      if (isVoiced && freq >= 40 && freq <= 3200) {
        phase += (2 * Math.PI * freq) / sampleRate;
        // Warm vocal tone with gentle harmonics
        sampleVal = Math.sin(phase) * 0.6 +
                    Math.sin(phase * 2) * 0.25 +
                    Math.sin(phase * 3) * 0.1;
      }

      const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 22000)));
      view.setInt16(writeOffset, int16, true);
      writeOffset += 2;
    }

    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return {
      url: URL.createObjectURL(wavBlob),
      name: 'Vocal_Melody_Stem.wav',
      duration: maxT,
    };
  }

  // 3. MIDI Notes (e.g. Bach Invention in ticks or Mozart in seconds)
  if (payloadType === 'note_midi') {
    const isMidiTicks = extentType?.includes('midi') || extentType?.includes('tick');
    const extentObj = annotation.extent as any;
    const ticks = isMidiTicks ? (extentObj?.tick || []) : (extentObj?.time || []);
    const durations = extentObj?.duration || [];
    const midiNotes = Array.isArray(annotation.payload.value) ? annotation.payload.value : [];

    const notes = [];
    let maxNoteEnd = 4.0;

    for (let k = 0; k < midiNotes.length; k++) {
      const midi = typeof midiNotes[k] === 'number' ? midiNotes[k] : 60;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      // Standard 480 PPQ @ 120 BPM: 960 ticks per sec
      const startSec = isMidiTicks ? (ticks[k] || 0) / 960 : (ticks[k] || 0);
      const durSec = isMidiTicks ? (durations[k] || 240) / 960 : (durations[k] || 0.5);
      notes.push({ t: startSec, d: durSec, freq });
      if (startSec + durSec > maxNoteEnd) {
        maxNoteEnd = startSec + durSec;
      }
    }
    maxNoteEnd += 0.5;

    const numSamples = Math.floor(sampleRate * maxNoteEnd);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
      let sampleVal = 0;

      for (const n of notes) {
        if (t >= n.t && t < n.t + n.d) {
          const relT = t - n.t;
          const env = Math.exp(-relT * 3.0) * Math.sin(Math.min(1, relT * 50) * Math.PI * 0.5);
          sampleVal += Math.sin(2 * Math.PI * n.freq * relT) * env * 0.5;
        }
      }

      const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 24000)));
      view.setInt16(writeOffset, int16, true);
      writeOffset += 2;
    }

    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return {
      url: URL.createObjectURL(wavBlob),
      name: isMidiTicks ? 'Bach_Invention_MidiStem.wav' : 'Piano_MidiStem.wav',
      duration: maxNoteEnd,
    };
  }

  // 3. Fallback / Default: Mozart Piano Sonata Motif
  const durationSec = 11.8;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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

  let writeOffset = 44;
  for (let i = 0; i < numSamples; i++) {
    const timeSec = i / sampleRate;
    const activeNote = notes.find(n => timeSec >= n.t && timeSec < n.t + n.d);

    let sampleVal = 0;
    if (activeNote) {
      const noteTime = timeSec - activeNote.t;
      const env = Math.exp(-noteTime * 2.5);
      const wave = Math.sin(2 * Math.PI * activeNote.freq * noteTime) * 0.75 +
                   Math.sin(4 * Math.PI * activeNote.freq * noteTime) * 0.25;
      sampleVal = wave * env * 0.6;
    }

    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sampleVal * 32767)));
    view.setInt16(writeOffset, int16, true);
    writeOffset += 2;
  }

  const wavBlob = new Blob([buffer], { type: 'audio/wav' });
  return {
    url: URL.createObjectURL(wavBlob),
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

