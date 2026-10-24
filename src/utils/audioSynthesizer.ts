/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Web Audio API Sonification Engine for BOPP Annotations
 * Plays chords, beats, and MIDI pitches synchronized with Vega-Lite timeline
 */

import type { BoppAnnotation, TabularRecord } from '../types/bopp';
import { getRecordStartSeconds, getRecordDurationSeconds } from './boppParser';

/**
 * Standard MIDI timing constants
 * 480 PPQ (pulses per quarter note) at BPM = 120 means:
 * 1 quarter note = 480 ticks = 0.50 seconds.
 * 1 tick = 0.5 / 480 seconds = 1 / 960 seconds.
 */
export const MIDI_PPQ = 480;
export const DEFAULT_BPM = 120;

export function ticksToSeconds(ticks: number, bpm = DEFAULT_BPM, ppq = MIDI_PPQ): number {
  return (ticks * 60) / (bpm * ppq); // ticks / 960
}

export function quartersToSeconds(quarters: number, bpm = DEFAULT_BPM): number {
  return (quarters * 60) / bpm; // quarters * 0.5
}

/**
 * Checks whether a given BOPP payload and extent type can be sonified meaningfully
 */
export function isSonifiablePayload(payloadType?: string, extentType?: string): boolean {
  if (extentType === 'pixel_box') return false;
  const sonifiableTypes = new Set([
    'chord',
    'beat',
    'note_midi',
    'note_hz',
    'onset',
    'pitch_contour',
  ]);
  return Boolean(payloadType && sonifiableTypes.has(payloadType));
}

export class BoppAudioPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentPlayhead = 0; // in seconds
  private duration = 10;
  private annotationMaxSec = 10;
  private speed = 1.0;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private lastAudioCtxTime: number | null = null;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private records: TabularRecord[] = [];
  private annotation: BoppAnnotation | null = null;
  private activeScheduledIndices = new Set<number>();
  private activeNodes = new Set<{ osc: OscillatorNode; gain: GainNode }>();
  private linkedAudioEl: HTMLAudioElement | null = null;

  // Dedicated continuous oscillator & gain for f0 vocal pitch contours
  private f0Osc: OscillatorNode | null = null;
  private f0Gain: GainNode | null = null;

  constructor() {
    // Lazy AudioContext initialization on user interaction
  }

  public getAudioContext(): AudioContext {
    this.initAudio();
    return this.ctx!;
  }

  public setLinkedAudioElement(el: HTMLAudioElement | null, explicitDuration?: number) {
    if (this.linkedAudioEl && this.linkedAudioEl !== el) {
      this.linkedAudioEl.pause();
    }
    this.stopActiveNodes();
    this.linkedAudioEl = el;
    if (typeof explicitDuration === 'number' && explicitDuration > 0) {
      this.duration = explicitDuration;
    } else if (!el) {
      this.duration = Math.max(1, this.annotationMaxSec);
    }
    if (el) {
      if (!isNaN(el.duration) && el.duration > 0) {
        this.duration = el.duration;
      }
      el.addEventListener('loadedmetadata', () => {
        if (!isNaN(el.duration) && el.duration > 0) {
          this.duration = el.duration;
        }
      });
      el.playbackRate = this.speed;
      el.onended = () => {
        this.isPlaying = false;
        this.onEndedCallback?.();
      };
    }
  }

  private initAudio() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public loadAnnotation(annotation: BoppAnnotation, records: TabularRecord[]) {
    this.stop();
    this.annotation = annotation;
    this.records = records;

    // Calculate duration strictly in seconds, matching computeSummaryStats & vegaLiteBuilder:
    // For MIDI ticks at standard 480 PPQ and 120 BPM: 1 tick = 1 / 960 seconds.
    // For Score quarters at 120 BPM: 1 quarter = 0.50 seconds.
    let maxSec = 0;
    const isMidiExtent = Boolean(annotation.extent?.extent_type?.includes('midi') || (records.length > 0 && typeof records[0].tick === 'number'));
    const isScoreExtent = Boolean(annotation.extent?.extent_type?.includes('score') || (records.length > 0 && typeof records[0].quarter === 'number'));

    for (const r of records) {
      const startSec = getRecordStartSeconds(r, { isMidiExtent, isScoreExtent }) ?? 0;
      const durSec = getRecordDurationSeconds(r, 0, { isMidiExtent, isScoreExtent });
      const endSec = startSec + durSec;
      if (endSec > maxSec) {
        maxSec = endSec;
      }
    }

    this.annotationMaxSec = maxSec;
    if (this.linkedAudioEl && !isNaN(this.linkedAudioEl.duration) && this.linkedAudioEl.duration > 0) {
      this.duration = Math.max(this.linkedAudioEl.duration, maxSec);
    } else {
      this.duration = Math.max(1, maxSec);
    }
    this.currentPlayhead = 0;
    this.activeScheduledIndices.clear();
  }

  public onTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public play() {
    if (this.isPlaying) return;
    this.initAudio();
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.lastAudioCtxTime = this.ctx ? this.ctx.currentTime : null;

    // Auto-rewind if at or near the end
    if (this.currentPlayhead >= this.duration - 0.05) {
      this.currentPlayhead = 0;
      this.activeScheduledIndices.clear();
      this.onTimeUpdateCallback?.(0);
    }

    if (this.linkedAudioEl) {
      this.linkedAudioEl.currentTime = this.currentPlayhead;
      this.linkedAudioEl.playbackRate = this.speed;
      this.linkedAudioEl.play().catch(e => console.warn('Linked audio play error:', e));
    } else if (this.annotation?.payload.payload_type === 'pitch_contour') {
      this.startF0Synthesizer();
      this.updateF0Pitch(this.currentPlayhead);
    } else {
      this.triggerActiveIntervalsAt(this.currentPlayhead);
    }

    this.tickLoop();
  }

  public pause() {
    this.isPlaying = false;
    this.stopF0Synthesizer();
    this.stopActiveNodes();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.linkedAudioEl) {
      this.linkedAudioEl.pause();
    }
  }

  public stop() {
    this.pause();
    this.stopF0Synthesizer();
    this.stopActiveNodes();
    this.currentPlayhead = 0;
    this.activeScheduledIndices.clear();
    if (this.linkedAudioEl) {
      this.linkedAudioEl.currentTime = 0;
    }
    this.onTimeUpdateCallback?.(0);
  }

  public seek(seconds: number) {
    this.currentPlayhead = Math.max(0, Math.min(seconds, this.duration));
    this.activeScheduledIndices.clear();
    this.stopActiveNodes();
    this.lastTimestamp = performance.now();
    this.lastAudioCtxTime = this.ctx ? this.ctx.currentTime : null;
    if (this.linkedAudioEl) {
      this.linkedAudioEl.currentTime = this.currentPlayhead;
    } else if (this.isPlaying) {
      if (this.annotation?.payload.payload_type === 'pitch_contour') {
        this.updateF0Pitch(this.currentPlayhead);
      } else {
        this.triggerActiveIntervalsAt(this.currentPlayhead);
      }
    }
    this.onTimeUpdateCallback?.(this.currentPlayhead);
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(speed, 4.0));
    if (this.linkedAudioEl) {
      this.linkedAudioEl.playbackRate = this.speed;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentTime(): number {
    return this.currentPlayhead;
  }

  public getDuration(): number {
    return this.duration;
  }

  private startF0Synthesizer() {
    this.stopF0Synthesizer();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pure sinusoidal tone - standard MIR sonification model for vocal/instrumental F0 contours
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      this.f0Osc = osc;
      this.f0Gain = gain;
    } catch (e) {
      console.warn('Could not start F0 synth:', e);
    }
  }

  private stopF0Synthesizer() {
    if (this.f0Osc) {
      try {
        if (this.f0Gain && this.ctx) {
          const now = this.ctx.currentTime;
          this.f0Gain.gain.cancelScheduledValues(now);
          this.f0Gain.gain.setValueAtTime(0, now);
        }
        this.f0Osc.stop();
        this.f0Osc.disconnect();
      } catch {}
      this.f0Osc = null;
      this.f0Gain = null;
    }
  }

  private updateF0Pitch(timeSec: number) {
    if (!this.ctx || !this.f0Osc || !this.f0Gain || this.records.length === 0) return;

    // Binary search for nearest time record
    let left = 0;
    let right = this.records.length - 1;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const t = this.records[mid].time ?? 0;
      if (t < timeSec) left = mid + 1;
      else right = mid;
    }

    const idx = Math.max(0, Math.min(this.records.length - 1, left));
    const r = this.records[idx];
    const prevR = idx > 0 ? this.records[idx - 1] : r;
    const rTime = r.time ?? 0;
    const prevTime = prevR.time ?? 0;
    const bestRecord = Math.abs(rTime - timeSec) < Math.abs(prevTime - timeSec) ? r : prevR;
    const bestTime = bestRecord.time ?? 0;

    // Proximity check: if nearest point is farther than 0.12s, we are in a gap or outside bounds -> mute
    const timeDistance = Math.abs(bestTime - timeSec);
    const isNearby = timeDistance <= 0.12;

    // Strict Voicing Check:
    // Support boolean true/false, numeric 1/0, probabilities >= 0.5, and string 'voiced'/'unvoiced'
    let isVoiced = false;
    const rawVoicing = bestRecord.voicing ?? (bestRecord as Record<string, unknown>).voiced;

    if (rawVoicing !== undefined && rawVoicing !== null) {
      if (typeof rawVoicing === 'boolean') {
        isVoiced = rawVoicing;
      } else if (typeof rawVoicing === 'number') {
        isVoiced = rawVoicing >= 0.5;
      } else if (typeof rawVoicing === 'string') {
        const vLower = rawVoicing.toLowerCase().trim();
        isVoiced = vLower === 'voiced' || vLower === 'true' || vLower === '1' || vLower === 'v';
      }
    } else {
      // If voicing column is omitted, non-zero frequency in valid vocal range indicates voiced
      const rawF = bestRecord.frequency ?? bestRecord.value;
      isVoiced = typeof rawF === 'number' && rawF > 40;
    }

    const freq = typeof bestRecord.frequency === 'number'
      ? bestRecord.frequency
      : typeof bestRecord.value === 'number'
      ? bestRecord.value
      : 0;

    const now = this.ctx.currentTime;
    // Only sonify strictly voiced sections within legitimate human vocal pitch boundaries (40 Hz to 3500 Hz)
    if (isNearby && isVoiced && freq >= 40 && freq <= 3500) {
      this.f0Osc.frequency.cancelScheduledValues(now);
      this.f0Osc.frequency.setValueAtTime(freq, now);
      this.f0Gain.gain.cancelScheduledValues(now);
      this.f0Gain.gain.setTargetAtTime(0.28, now, 0.015);
    } else {
      // Unvoiced segment, gap, or silence: smoothly fade gain to zero
      this.f0Gain.gain.cancelScheduledValues(now);
      this.f0Gain.gain.setTargetAtTime(0, now, 0.012);
    }
  }

  private stopActiveNodes() {
    if (!this.ctx || this.activeNodes.size === 0) {
      this.activeNodes.clear();
      return;
    }
    const now = this.ctx.currentTime;
    for (const { osc, gain } of this.activeNodes) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.activeNodes.clear();
  }

  private registerActiveNode(osc: OscillatorNode, gain: GainNode) {
    const entry = { osc, gain };
    this.activeNodes.add(entry);
    osc.onended = () => {
      this.activeNodes.delete(entry);
    };
  }

  private tickLoop = () => {
    if (!this.isPlaying) return;

    if (this.linkedAudioEl) {
      // Real linked audio master clock
      this.currentPlayhead = this.linkedAudioEl.currentTime;
      if (this.linkedAudioEl.ended || this.currentPlayhead >= this.duration) {
        this.pause();
        this.onTimeUpdateCallback?.(this.duration);
        this.onEndedCallback?.();
        return;
      }
      if (this.annotation?.payload.payload_type === 'pitch_contour') {
        this.updateF0Pitch(this.currentPlayhead);
      }
    } else {
      const now = performance.now();
      let delta = (now - this.lastTimestamp) / 1000;
      if (
        this.ctx &&
        this.ctx.state === 'running' &&
        this.lastAudioCtxTime !== null &&
        this.ctx.currentTime > this.lastAudioCtxTime
      ) {
        delta = this.ctx.currentTime - this.lastAudioCtxTime;
      }
      this.lastTimestamp = now;
      this.lastAudioCtxTime = this.ctx ? this.ctx.currentTime : null;

      const prevTime = this.currentPlayhead;
      this.currentPlayhead += delta * this.speed;

      if (this.currentPlayhead >= this.duration) {
        this.currentPlayhead = this.duration;
        if (this.annotation?.payload.payload_type !== 'pitch_contour') {
          this.triggerSounds(prevTime, this.duration, true);
        }
        this.pause();
        this.onTimeUpdateCallback?.(this.currentPlayhead);
        this.onEndedCallback?.();
        return;
      }

      // Check if continuous F0 pitch contour needs update
      if (this.annotation?.payload.payload_type === 'pitch_contour') {
        this.updateF0Pitch(this.currentPlayhead);
      } else {
        // Trigger discrete event sounds crossed between prevTime and currentPlayhead
        this.triggerSounds(prevTime, this.currentPlayhead);
      }
    }

    this.onTimeUpdateCallback?.(this.currentPlayhead);
    this.animationFrameId = requestAnimationFrame(this.tickLoop);
  };

  private triggerActiveIntervalsAt(timeSec: number) {
    if (!this.ctx || !this.annotation) return;

    const payloadType = this.annotation.payload.payload_type;

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      const tSec = getRecordStartSeconds(r);
      if (tSec === null) continue;

      const hasExplicitDuration = typeof r.duration === 'number' && Number.isFinite(r.duration);
      const fallbackDur = typeof r.tick === 'number' ? 0.25 : 0.5;
      const durSec = getRecordDurationSeconds(r, fallbackDur);

      const isOngoingInterval = hasExplicitDuration && tSec <= timeSec && timeSec < tSec + durSec;
      const isExactPoint = !hasExplicitDuration && Math.abs(tSec - timeSec) < 1e-4;

      if ((isOngoingInterval || isExactPoint) && !this.activeScheduledIndices.has(i)) {
        this.activeScheduledIndices.add(i);
        const remainingDur = isOngoingInterval ? Math.max(0.08, tSec + durSec - timeSec) : durSec;
        this.triggerRecordSound(payloadType, r, remainingDur);
      }
    }
  }

  private triggerSounds(fromTime: number, toTime: number, inclusiveEnd = false) {
    if (!this.ctx || !this.annotation) return;

    const payloadType = this.annotation.payload.payload_type;

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      const tSec = getRecordStartSeconds(r);
      if (tSec === null) continue;

      const fallbackDur = typeof r.tick === 'number' ? 0.25 : 0.5;
      const durSec = getRecordDurationSeconds(r, fallbackDur);

      const inWindow = inclusiveEnd
        ? tSec >= fromTime && tSec <= toTime
        : tSec >= fromTime && tSec < toTime;

      if (inWindow && !this.activeScheduledIndices.has(i)) {
        this.activeScheduledIndices.add(i);
        this.triggerRecordSound(payloadType, r, durSec);
      }
    }
  }

  private triggerRecordSound(payloadType: string, r: TabularRecord, durSec: number) {
    if (payloadType === 'chord' && typeof r.value === 'string') {
      this.playChord(r.value, durSec);
    } else if (payloadType === 'beat') {
      const isDownbeat = r.value === 1;
      this.playClick(isDownbeat);
    } else if (payloadType === 'note_midi' && typeof r.value === 'number') {
      this.playMidiNote(r.value, durSec);
    } else if (payloadType === 'note_hz' && typeof r.value === 'number') {
      this.playTone(r.value, durSec);
    } else if (payloadType !== 'pitch_contour') {
      // Default click for other events (onsets, segments)
      this.playClick(false);
    }
  }

  private playClick(isDownbeat: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isDownbeat ? 880 : 440, this.ctx.currentTime);

    gain.gain.setValueAtTime(isDownbeat ? 0.35 : 0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    this.registerActiveNode(osc, gain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  private playMidiNote(midi: number, durationSec: number) {
    if (!this.ctx) return;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    this.playTone(freq, durationSec);
  }

  private playTone(freq: number, durationSec: number) {
    if (!this.ctx || freq <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const scaledDur = durationSec / Math.max(0.25, this.speed);
    const dur = Math.min(Math.max(0.1, scaledDur), 2.0);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    this.registerActiveNode(osc, gain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  private playChord(chordStr: string, durationSec: number) {
    if (!this.ctx || chordStr === 'N' || chordStr === 'X') return;

    // Parse root pitch and intervals
    const match = chordStr.match(/^([A-G][b#]?)(?::(.*))?$/);
    if (!match) return;

    const rootName = match[1];
    const quality = match[2] || 'maj';

    const rootPitchMap: Record<string, number> = {
      C: 48,
      'C#': 49,
      Db: 49,
      D: 50,
      'D#': 51,
      Eb: 51,
      E: 52,
      F: 53,
      'F#': 54,
      Gb: 54,
      G: 55,
      'G#': 56,
      Ab: 56,
      A: 57,
      'A#': 58,
      Bb: 58,
      B: 59,
    };

    const rootMidi = rootPitchMap[rootName] ?? 48;
    const isMinor = quality.includes('min') || quality.includes('dim');
    const isSeventh = quality.includes('7');

    const intervals = [0, isMinor ? 3 : 4, 7];
    if (isSeventh) intervals.push(isMinor ? 10 : 11);

    const scaledDur = durationSec / Math.max(0.25, this.speed);
    const dur = Math.min(Math.max(0.2, scaledDur), 2.5);

    for (const semitones of intervals) {
      const midi = rootMidi + semitones;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      this.registerActiveNode(osc, gain);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    }
  }
}
