/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BOPP Parser & Serializer for JSON and MessagePack formats
 */

import { decode as decodeMsgpack, encode as encodeMsgpack } from '@msgpack/msgpack';
import { normalizeKeyName } from './mirEvalColors';
import type {
  BoppAnnotation,
  BoppExtent,
  BoppPayload,
  BoppConfidence,
  TabularRecord,
  Fraction,
} from '../types/bopp';

/**
 * Parses BOPP data from JSON string
 */
export function parseBoppJson(jsonString: string): BoppAnnotation {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON: Root must be a BOPP annotation object.');
  }
  return parsed as BoppAnnotation;
}

/**
 * Parses BOPP data from MessagePack binary buffer (Uint8Array or ArrayBuffer)
 */
export function parseBoppMsgpack(data: Uint8Array | ArrayBuffer): BoppAnnotation {
  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const decoded = decodeMsgpack(uint8);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid MessagePack: Decoded content must be an object.');
  }
  return decoded as BoppAnnotation;
}

/**
 * Serializes BOPP annotation to JSON string
 */
export function serializeBoppJson(annotation: BoppAnnotation, indent = 2): string {
  return JSON.stringify(annotation, null, indent);
}

/**
 * Serializes BOPP annotation to MessagePack binary Uint8Array
 */
export function serializeBoppMsgpack(annotation: BoppAnnotation): Uint8Array {
  return encodeMsgpack(annotation);
}

/**
 * Evaluates rational fraction [num, denom] into a float
 */
function fractionToNumber(frac: Fraction | unknown): number {
  if (Array.isArray(frac) && frac.length === 2 && typeof frac[0] === 'number' && typeof frac[1] === 'number') {
    return frac[1] === 0 ? 0 : frac[0] / frac[1];
  }
  return typeof frac === 'number' ? frac : 0;
}

function fractionToString(frac: Fraction | unknown): string {
  if (Array.isArray(frac) && frac.length === 2) {
    return `${frac[0]}/${frac[1]}`;
  }
  return String(frac ?? '');
}

/**
 * Converts a BoppAnnotation into tabular records, matching bopp.util.to_dataframe
 */
export function annotationToTabular(annotation: BoppAnnotation): TabularRecord[] {
  const payload = annotation.payload;
  if (!payload || !payload.payload_type) {
    return [];
  }

  // Determine observation count from payload arrays
  let rowCount = 0;
  if ('value' in payload && Array.isArray(payload.value)) {
    rowCount = payload.value.length;
  } else if ('label' in payload && Array.isArray(payload.label)) {
    rowCount = payload.label.length;
  } else if ('valence' in payload && Array.isArray(payload.valence)) {
    rowCount = payload.valence.length;
  }

  const extent = annotation.extent;
  const confidence = annotation.confidence;

  const records: TabularRecord[] = [];

  for (let i = 0; i < rowCount; i++) {
    const record: TabularRecord = {
      __index: i,
    };

    // Extent fields
    if (extent) {
      switch (extent.extent_type) {
        case 'time':
          record.time = extent.time?.[i];
          break;
        case 'time_interval': {
          const t = extent.time?.[i] ?? 0;
          const dur = extent.duration?.[i] ?? 0;
          record.time = t;
          record.duration = dur;
          break;
        }
        case 'time_frequency_box': {
          const t = extent.time?.[i] ?? 0;
          const dur = extent.duration?.[i] ?? 0;
          record.time = t;
          record.duration = dur;
          record.freq_min = extent.freq_min?.[i];
          record.freq_max = extent.freq_max?.[i];
          break;
        }
        case 'pixel_box': {
          record.x = extent.x?.[i];
          record.y = extent.y?.[i];
          record.width = extent.width?.[i];
          record.height = extent.height?.[i];
          break;
        }
        case 'score_quarter': {
          const q = extent.quarter?.[i];
          record.quarter = fractionToNumber(q);
          record.quarter_str = fractionToString(q);
          break;
        }
        case 'score_interval': {
          const q = extent.quarter?.[i];
          const d = extent.duration?.[i];
          const qNum = fractionToNumber(q);
          const dNum = fractionToNumber(d);
          record.quarter = qNum;
          record.quarter_str = fractionToString(q);
          record.duration = dNum;
          record.quarter_duration_str = fractionToString(d);
          break;
        }
        case 'midi_tick': {
          record.tick = extent.tick?.[i];
          break;
        }
        case 'midi_interval': {
          const tick = extent.tick?.[i] ?? 0;
          const dur = extent.duration?.[i] ?? 0;
          record.tick = tick;
          record.duration = dur;
          break;
        }
      }
    }

    // Payload fields
    switch (payload.payload_type) {
      case 'beat':
        record.value = payload.value?.[i];
        break;
      case 'chord':
        record.value = payload.value?.[i];
        break;
      case 'key_mode': {
        const val = payload.value?.[i];
        record.value = val ? normalizeKeyName(String(val)) : val;
        break;
      }
      case 'lyrics':
        record.value = payload.value?.[i];
        break;
      case 'mood_thayer':
        record.valence = payload.valence?.[i];
        record.arousal = payload.arousal?.[i];
        break;
      case 'note_hz':
        record.value = payload.value?.[i];
        break;
      case 'note_midi': {
        const midi = payload.value?.[i];
        record.value = midi;
        if (typeof midi === 'number') {
          record.note_name = midiToNoteName(midi);
        }
        break;
      }
      case 'object':
        record.value = payload.value?.[i];
        break;
      case 'onset':
        record.value = (payload.value?.[i] as any) ?? 1;
        break;
      case 'pitch_contour': {
        const item = payload.value?.[i];
        if (item && typeof item === 'object') {
          const rawV = item.voicing ?? (item as Record<string, unknown>).voiced;
          let v = 1;
          if (rawV !== undefined && rawV !== null) {
            v = (rawV === 1 || rawV === true || rawV === 'voiced' || (typeof rawV === 'number' && rawV >= 0.5)) ? 1 : 0;
          }
          record.frequency = item.frequency;
          record.voicing = v;
          record.value = item.frequency;
        } else {
          const pAny = payload as unknown as Record<string, any>;
          const f = typeof item === 'number' ? item : (pAny.frequency?.[i] ?? pAny.f0?.[i]);
          const rawV = pAny.voicing?.[i] ?? pAny.voiced?.[i];
          let v = 1;
          if (rawV !== undefined && rawV !== null) {
            v = (rawV === 1 || rawV === true || rawV === 'voiced' || (typeof rawV === 'number' && rawV >= 0.5)) ? 1 : 0;
          } else if (f === 0 || f === null || f === undefined) {
            v = 0;
          }
          record.frequency = f;
          record.voicing = v;
          record.value = f;
        }
        break;
      }
      case 'relation':
        record.value = payload.value?.[i];
        record.relation = payload.relation?.[i];
        break;
      case 'multi_segment':
        record.label = payload.label?.[i];
        record.level = payload.level?.[i];
        record.value = payload.label?.[i];
        break;
      case 'segment_open':
        record.value = payload.value?.[i];
        break;
      case 'tag_open':
        record.value = payload.value?.[i];
        break;
      case 'tempo':
        record.value = payload.value?.[i];
        break;
    }

    // Confidence fields
    if (confidence) {
      record.confidence_type = confidence.confidence_type;
      switch (confidence.confidence_type) {
        case 'likelihood': {
          const conf = confidence.confidence?.[i];
          record.confidence = conf;
          if (typeof conf === 'number') {
            const pct = Math.round(conf * 100);
            record.confidence_pct = pct;
            record.confidence_label = `${pct}%`;
            const filledBlocks = Math.max(0, Math.min(10, Math.round(conf * 10)));
            record.confidence_meter = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);
            record.confidence_grade = conf >= 0.85 ? 'high' : conf >= 0.65 ? 'medium' : 'low';
            record.confidence_color = conf >= 0.85 ? '#10b981' : conf >= 0.65 ? '#f59e0b' : '#f43f5e';
            if (typeof record.duration === 'number') {
              record.confidence_duration = +(record.duration * conf).toFixed(4);
            }
          }
          break;
        }
        case 'agreement': {
          const conf = confidence.confidence?.[i];
          record.confidence = conf;
          const nTotal = confidence.n_annotators?.[i] ?? confidence.n_annotators_common;
          record.n_annotators = nTotal;
          if (typeof conf === 'number') {
            const pct = Math.round(conf * 100);
            record.confidence_pct = pct;
            record.confidence_label = `${pct}% agreement`;
            if (typeof nTotal === 'number' && nTotal > 0) {
              const nAgree = Math.round(conf * nTotal);
              record.n_agree = nAgree;
              record.agreement_ratio_str = `${nAgree}/${nTotal}`;
              record.agreement_text = `${nAgree} of ${nTotal} agreed (${pct}%)`;
              const maxIcons = Math.min(nTotal, 10);
              const agreeIcons = Math.min(maxIcons, Math.round(conf * maxIcons));
              record.agreement_icons = '👤'.repeat(agreeIcons) + '▫'.repeat(maxIcons - agreeIcons);
            } else {
              const agree5 = Math.max(0, Math.min(5, Math.round(conf * 5)));
              record.n_agree = agree5;
              record.n_annotators = 5;
              record.agreement_ratio_str = `${agree5}/5`;
              record.agreement_text = `${pct}% consensus (${agree5}/5)`;
              record.agreement_icons = '👤'.repeat(agree5) + '▫'.repeat(5 - agree5);
            }
            record.confidence_grade = conf >= 0.8 ? 'high' : conf >= 0.6 ? 'medium' : 'low';
            record.confidence_color = conf >= 0.8 ? '#10b981' : conf >= 0.6 ? '#f59e0b' : '#f43f5e';
            if (typeof record.duration === 'number') {
              record.confidence_duration = +(record.duration * conf).toFixed(4);
            }
          }
          break;
        }
        case 'variance': {
          const variance = confidence.confidence?.[i];
          record.confidence_variance = variance;
          if (typeof variance === 'number') {
            const std = Math.sqrt(Math.max(0, variance));
            record.confidence_std = std;
            const margin = +(1.96 * std).toFixed(3);
            record.confidence_ci_margin = margin;
            if (typeof record.value === 'number') {
              record.value_ci_lower = +(record.value - margin).toFixed(3);
              record.value_ci_upper = +(record.value + margin).toFixed(3);
            }
            if (typeof record.valence === 'number') {
              record.valence_ci_lower = +(record.valence - margin).toFixed(3);
              record.valence_ci_upper = +(record.valence + margin).toFixed(3);
            }
            if (typeof record.arousal === 'number') {
              record.arousal_ci_lower = +(record.arousal - margin).toFixed(3);
              record.arousal_ci_upper = +(record.arousal + margin).toFixed(3);
            }
          }
          break;
        }
      }
    }

    records.push(record);
  }

  return records;
}

/**
 * Converts MIDI note number (e.g. 60) to pitch name (e.g. C4)
 */
export function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rounded = Math.round(midi);
  const note = noteNames[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Generates summary statistics for a BOPP annotation
 */
export interface BoppSummaryStats {
  rowCount: number;
  timeRange: [number, number] | null;
  duration: number | null;
  extentType: string;
  payloadType: string;
  confidenceType: string | null;
  uniqueValuesCount: number;
  uniqueValuesSample: (string | number)[];
  meanConfidence: number | null;
  minConfidence: number | null;
  maxConfidence: number | null;
}

export function computeSummaryStats(annotation: BoppAnnotation, records: TabularRecord[]): BoppSummaryStats {
  const rowCount = records.length;
  let minTime: number | null = null;
  let maxTime: number | null = null;

  for (const r of records) {
    if (typeof r.time === 'number') {
      minTime = minTime === null ? r.time : Math.min(minTime, r.time);
      const end = typeof r.duration === 'number' ? r.time + r.duration : r.time;
      maxTime = maxTime === null ? end : Math.max(maxTime, end);
    } else if (typeof r.tick === 'number') {
      // Standard 480 PPQ @ 120 BPM -> 960 ticks per second
      const startSec = r.tick / 960;
      minTime = minTime === null ? startSec : Math.min(minTime, startSec);
      const durSec = typeof r.duration === 'number' ? r.duration / 960 : 0.25;
      maxTime = maxTime === null ? startSec + durSec : Math.max(maxTime, startSec + durSec);
    } else if (typeof r.quarter === 'number') {
      // 120 BPM -> 0.5s per quarter note
      const startSec = r.quarter * 0.5;
      minTime = minTime === null ? startSec : Math.min(minTime, startSec);
      const durSec = typeof r.duration === 'number' ? r.duration * 0.5 : 0.5;
      maxTime = maxTime === null ? startSec + durSec : Math.max(maxTime, startSec + durSec);
    }
  }

  // Values collection
  const valueSet = new Set<string | number>();
  let confSum = 0;
  let confCount = 0;
  let minConf: number | null = null;
  let maxConf: number | null = null;

  for (const r of records) {
    if (typeof r.value === 'string' || typeof r.value === 'number') {
      valueSet.add(r.value);
    } else if (r.label !== undefined) {
      valueSet.add(r.label);
    }
    if (typeof r.confidence === 'number') {
      confSum += r.confidence;
      confCount++;
      minConf = minConf === null ? r.confidence : Math.min(minConf, r.confidence);
      maxConf = maxConf === null ? r.confidence : Math.max(maxConf, r.confidence);
    }
  }

  const valuesArray = Array.from(valueSet);

  return {
    rowCount,
    timeRange: minTime !== null && maxTime !== null ? [minTime, maxTime] : null,
    duration: minTime !== null && maxTime !== null ? maxTime - minTime : null,
    extentType: annotation.extent?.extent_type || 'none (global)',
    payloadType: annotation.payload.payload_type,
    confidenceType: annotation.confidence?.confidence_type || null,
    uniqueValuesCount: valuesArray.length,
    uniqueValuesSample: valuesArray.slice(0, 8),
    meanConfidence: confCount > 0 ? confSum / confCount : null,
    minConfidence: minConf,
    maxConfidence: maxConf,
  };
}

/**
 * Converts tabular records into BOPP CSV text format
 */
export function exportToBoppCsv(annotation: BoppAnnotation, records: TabularRecord[]): string {
  const headerLines = [
    '# ---',
    `# media_id = "${annotation.media_id}"`,
    `# bopp_version = "${annotation.bopp_version}"`,
  ];
  if (annotation.id) headerLines.push(`# id = "${annotation.id}"`);
  headerLines.push('# ---');

  if (records.length === 0) {
    return headerLines.join('\n');
  }

  // Columns to include
  const keys = Object.keys(records[0]).filter(k => !k.startsWith('__'));
  const csvHeader = keys.join(',');

  const rows = records.map(r =>
    keys
      .map(k => {
        const val = r[k];
        if (val === undefined || val === null) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      })
      .join(',')
  );

  return `${headerLines.join('\n')}\n${csvHeader}\n${rows.join('\n')}`;
}
