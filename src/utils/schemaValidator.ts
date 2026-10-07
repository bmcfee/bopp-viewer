/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BOPP Schema Validator
 * Validates annotations according to BOPP v1.0 specifications and draft 2020-12 schemas
 */

import type { BoppAnnotation } from '../types/bopp';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  path: string;
  message: string;
  details?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0 to 100
  issues: ValidationIssue[];
  schemaVersion: string;
  checksSummary: {
    passed: number;
    warnings: number;
    errors: number;
  };
}

const HARTE_CHORD_REGEX = new RegExp(
  '^((N|X)|(([A-G](b*|#*))((:(maj|min|dim|aug|1|5|sus2|sus4|maj6|min6|7|maj7|min7|dim7|hdim7|minmaj7|aug7|9|maj9|min9|11|maj11|min11|13|maj13|min13)(\\((\\*?((b*|#*)([1-9]|1[0-3]?))(,\\*?((b*|#*)([1-9]|1[0-3]?)))*)\\))?)|(:\\((\\*?((b*|#*)([1-9]|1[0-3]?))(,\\*?((b*|#*)([1-9]|1[0-3]?)))*)\\)))?((/((b*|#*)([1-9]|1[0-3]?)))?)?))$'
);
const KEY_MODE_REGEX = /^(?:N|X|([A-Ga-g][b#]?)(?::(maj|major|min|minor|ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian))?)$/;
const UUID_V5_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-5[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MEDIA_ID_REGEX = /^[a-zA-Z0-9]+:.*$/;
const BOPP_VERSION_REGEX = /^1\.\d+$/;

export function validateBoppAnnotation(data: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      score: 0,
      issues: [{ severity: 'error', path: '$', message: 'Root must be a valid JSON object.' }],
      schemaVersion: 'unknown',
      checksSummary: { passed: 0, warnings: 0, errors: 1 },
    };
  }

  const ann = data as Partial<BoppAnnotation>;
  let passedCount = 0;

  // 1. media_id check
  if (!ann.media_id) {
    issues.push({ severity: 'error', path: 'media_id', message: 'Missing required field "media_id".' });
  } else if (typeof ann.media_id !== 'string') {
    issues.push({ severity: 'error', path: 'media_id', message: '"media_id" must be a string.' });
  } else if (!MEDIA_ID_REGEX.test(ann.media_id)) {
    issues.push({
      severity: 'error',
      path: 'media_id',
      message: '"media_id" does not match required URI prefix pattern "^[a-zA-Z0-9]+:.*$".',
      details: 'Example: "mbid:c8b417c8-04fb-4972-aeaf-161b4742a08d" or "audio:track_01"',
    });
  } else {
    passedCount++;
  }

  // 2. bopp_version check
  if (!ann.bopp_version) {
    issues.push({ severity: 'error', path: 'bopp_version', message: 'Missing required field "bopp_version".' });
  } else if (typeof ann.bopp_version !== 'string') {
    issues.push({ severity: 'error', path: 'bopp_version', message: '"bopp_version" must be a string.' });
  } else if (!BOPP_VERSION_REGEX.test(ann.bopp_version)) {
    issues.push({
      severity: 'error',
      path: 'bopp_version',
      message: `"bopp_version" must match semantic version pattern "^1\\.\\d+$" (e.g. "1.0"). Got "${ann.bopp_version}".`,
    });
  } else {
    passedCount++;
  }

  // 3. id (UUIDv5) check
  if (ann.id !== undefined) {
    if (typeof ann.id !== 'string') {
      issues.push({ severity: 'error', path: 'id', message: '"id" must be a string UUID.' });
    } else if (!UUID_V5_REGEX.test(ann.id)) {
      issues.push({
        severity: 'warning',
        path: 'id',
        message: '"id" is not a canonical UUIDv5 matching RFC 4122.',
        details: 'BOPP recommends generating UUIDv5 based on canonical annotation content.',
      });
    } else {
      passedCount++;
    }
  }

  // 4. payload check
  let payloadLength = 0;
  if (!ann.payload) {
    issues.push({ severity: 'error', path: 'payload', message: 'Missing required field "payload".' });
  } else if (typeof ann.payload !== 'object') {
    issues.push({ severity: 'error', path: 'payload', message: '"payload" must be an object.' });
  } else {
    const payload = (ann.payload as unknown) as Record<string, unknown>;
    if (!payload.payload_type || typeof payload.payload_type !== 'string') {
      issues.push({ severity: 'error', path: 'payload.payload_type', message: 'Missing discriminator "payload_type".' });
    } else {
      passedCount++;
      const pType = payload.payload_type;

      // Extract primary array and validate specific payload rules
      let primaryArray: unknown[] | null = null;
      if (Array.isArray(payload.value)) primaryArray = payload.value;
      else if (Array.isArray(payload.label)) primaryArray = payload.label;
      else if (Array.isArray(payload.valence)) primaryArray = payload.valence;

      if (!primaryArray) {
        issues.push({ severity: 'error', path: 'payload', message: `Payload "${pType}" does not contain expected observation array.` });
      } else {
        payloadLength = primaryArray.length;
        passedCount++;

        // Detailed checks per payload type
        if (pType === 'chord' && Array.isArray(payload.value)) {
          let invalidChordCount = 0;
          for (let i = 0; i < payload.value.length; i++) {
            const chord = payload.value[i];
            if (typeof chord !== 'string' || !HARTE_CHORD_REGEX.test(chord)) {
              invalidChordCount++;
              if (invalidChordCount <= 3) {
                issues.push({
                  severity: 'warning',
                  path: `payload.value[${i}]`,
                  message: `Chord "${chord}" does not strictly match Harte notation pattern.`,
                });
              }
            }
          }
          if (invalidChordCount === 0) passedCount++;
        } else if (pType === 'key_mode' && Array.isArray(payload.value)) {
          let invalidKey = 0;
          for (let i = 0; i < payload.value.length; i++) {
            const km = payload.value[i];
            if (typeof km !== 'string' || !KEY_MODE_REGEX.test(km)) {
              invalidKey++;
            }
          }
          if (invalidKey > 0) {
            issues.push({ severity: 'warning', path: 'payload.value', message: `${invalidKey} key_mode entries do not match key notation standard.` });
          } else {
            passedCount++;
          }
        } else if (pType === 'multi_segment') {
          if (!Array.isArray(payload.label) || !Array.isArray(payload.level)) {
            issues.push({ severity: 'error', path: 'payload', message: 'multi_segment requires both "label" and "level" arrays.' });
          } else if (payload.label.length !== payload.level.length) {
            issues.push({ severity: 'error', path: 'payload', message: `multi_segment "label" length (${payload.label.length}) != "level" length (${payload.level.length}).` });
          } else {
            passedCount++;
          }
        } else if (pType === 'mood_thayer') {
          if (!Array.isArray(payload.valence) || !Array.isArray(payload.arousal)) {
            issues.push({ severity: 'error', path: 'payload', message: 'mood_thayer requires both "valence" and "arousal" arrays.' });
          } else if (payload.valence.length !== payload.arousal.length) {
            issues.push({ severity: 'error', path: 'payload', message: `mood_thayer valence length (${payload.valence.length}) != arousal length (${payload.arousal.length}).` });
          } else {
            passedCount++;
          }
        }
      }
    }
  }

  // 5. extent check & array parallelism
  if (ann.extent) {
    const extent = (ann.extent as unknown) as Record<string, unknown>;
    if (!extent.extent_type || typeof extent.extent_type !== 'string') {
      issues.push({ severity: 'error', path: 'extent.extent_type', message: 'Missing discriminator "extent_type".' });
    } else {
      passedCount++;
      const eType = extent.extent_type;

      // Check array fields and parallel lengths
      const arrayFields: { name: string; arr: unknown[] }[] = [];
      for (const [k, v] of Object.entries(extent)) {
        if (k !== 'extent_type' && Array.isArray(v)) {
          arrayFields.push({ name: k, arr: v });
        }
      }

      if (arrayFields.length === 0) {
        issues.push({ severity: 'error', path: 'extent', message: `Extent "${eType}" has no columnar arrays.` });
      } else {
        // Parallel array length check across all extent arrays
        const extentLen = arrayFields[0].arr.length;
        for (const f of arrayFields) {
          if (f.arr.length !== extentLen) {
            issues.push({
              severity: 'error',
              path: `extent.${f.name}`,
              message: `Extent array "${f.name}" length (${f.arr.length}) does not match other extent arrays (${extentLen}).`,
            });
          }
        }

        // Extent vs Payload length parallelism check (BOPP fundamental invariant)
        if (payloadLength > 0 && extentLen !== payloadLength) {
          issues.push({
            severity: 'error',
            path: 'extent',
            message: `Extent length (${extentLen}) does not match parallel Payload length (${payloadLength}). In BOPP, extent and payload arrays must be strictly parallel.`,
          });
        } else if (payloadLength > 0) {
          passedCount++;
        }

        // Specific extent checks
        if (eType === 'time_interval' || eType === 'time_frequency_box') {
          const durations = extent.duration as number[];
          if (Array.isArray(durations)) {
            const negDur = durations.some(d => typeof d === 'number' && d < 0);
            if (negDur) {
              issues.push({ severity: 'error', path: 'extent.duration', message: 'Extent duration values must be non-negative.' });
            } else {
              passedCount++;
            }
          }
        }
      }
    }
  } else {
    issues.push({ severity: 'info', path: 'extent', message: 'Extent is omitted (valid in BOPP for ungrounded sequence/document annotations).' });
    passedCount++;
  }

  // 6. confidence check & parallelism
  if (ann.confidence) {
    const conf = (ann.confidence as unknown) as Record<string, unknown>;
    if (!conf.confidence_type || typeof conf.confidence_type !== 'string') {
      issues.push({ severity: 'error', path: 'confidence.confidence_type', message: 'Missing discriminator "confidence_type".' });
    } else {
      passedCount++;
      if (Array.isArray(conf.confidence)) {
        if (payloadLength > 0 && conf.confidence.length !== payloadLength) {
          issues.push({
            severity: 'error',
            path: 'confidence.confidence',
            message: `Confidence array length (${conf.confidence.length}) does not match Payload length (${payloadLength}).`,
          });
        } else {
          passedCount++;
        }

        // Range check
        if (conf.confidence_type === 'likelihood' || conf.confidence_type === 'agreement') {
          const outOfBounds = conf.confidence.some(c => typeof c === 'number' && (c < 0 || c > 1));
          if (outOfBounds) {
            issues.push({ severity: 'warning', path: 'confidence.confidence', message: 'Confidence values for likelihood/agreement should be in range [0.0, 1.0].' });
          } else {
            passedCount++;
          }
        } else if (conf.confidence_type === 'variance') {
          const negVar = conf.confidence.some(c => typeof c === 'number' && c < 0);
          if (negVar) {
            issues.push({ severity: 'error', path: 'confidence.confidence', message: 'Variance confidence values must be non-negative (>= 0).' });
          } else {
            passedCount++;
          }
        }
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const isValid = errors === 0;

  const totalChecks = Math.max(1, passedCount + errors + warnings);
  const score = Math.max(0, Math.round(((passedCount) / totalChecks) * 100));

  return {
    isValid,
    score,
    issues,
    schemaVersion: ann.bopp_version || '1.0',
    checksSummary: {
      passed: passedCount,
      warnings,
      errors,
    },
  };
}
