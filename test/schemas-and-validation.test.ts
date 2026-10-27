import test from 'node:test';
import assert from 'node:assert';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import { validateBoppAnnotation } from '../src/utils/schemaValidator';

test('BOPP Schema Validation & Integrity Test Suite', async (t) => {
  await t.test('1. All sample datasets pass BOPP schema validation without critical errors', () => {
    assert.ok(SAMPLE_DATASETS.length > 0, 'Must have sample datasets');
    for (const sample of SAMPLE_DATASETS) {
      const result = validateBoppAnnotation(sample.data);
      assert.strictEqual(
        result.isValid,
        true,
        `Sample dataset "${sample.id}" (${sample.filename}) failed validation: ${JSON.stringify(result.issues)}`
      );
      assert.strictEqual(
        result.checksSummary.errors,
        0,
        `Sample dataset "${sample.id}" must have 0 errors`
      );
    }
  });

  await t.test('2. Schema validator catches missing media_id or version', () => {
    const invalidObj: any = {
      bopp_version: '1.0',
      payload: { payload_type: 'chord', value: ['C:maj'] },
    };
    const result = validateBoppAnnotation(invalidObj);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.issues.some(i => i.path.includes('media_id') || i.message.includes('media_id')));
  });

  await t.test('3. Schema validator catches extent length mismatches with payload', () => {
    const mismatchedObj: any = {
      media_id: 'test',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time',
        time: [0.0, 1.0, 2.0], // 3 items
      },
      payload: {
        payload_type: 'chord',
        value: ['C:maj'], // 1 item (mismatch!)
      },
    };
    const result = validateBoppAnnotation(mismatchedObj);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.issues.length > 0);
  });

  await t.test('4. Schema validator validates time_uniform grid and catches non-positive sampling_period', () => {
    const validUniform: any = {
      media_id: 'audio:test_uniform',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_uniform',
        start_time: 0.0,
        sampling_period: 0.05,
      },
      payload: {
        payload_type: 'frequency_hz',
        value: [440.0, 442.0, 445.0],
      },
    };
    const validRes = validateBoppAnnotation(validUniform);
    assert.strictEqual(validRes.isValid, true, JSON.stringify(validRes.issues));

    const invalidUniform: any = {
      ...validUniform,
      extent: {
        extent_type: 'time_uniform',
        start_time: 0.0,
        sampling_period: -0.1, // Invalid non-positive period
      },
    };
    const invalidRes = validateBoppAnnotation(invalidUniform);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.some(i => i.path.includes('sampling_period')));
  });

  await t.test('5. Schema validator validates marker payload with scalar description', () => {
    const validMarker: any = {
      media_id: 'audio:test_marker',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time',
        time: [0.1, 0.5, 0.9],
      },
      payload: {
        payload_type: 'marker',
        description: 'onset',
      },
    };
    const res = validateBoppAnnotation(validMarker);
    assert.strictEqual(res.isValid, true, JSON.stringify(res.issues));

    const invalidMarker: any = {
      ...validMarker,
      payload: {
        payload_type: 'marker',
        // missing required description
      },
    };
    const invalidRes = validateBoppAnnotation(invalidMarker);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.some(i => i.path.includes('description')));
  });

  await t.test('6. Schema validator validates Scientific Pitch Notation (SPN) for note payload', () => {
    const validNote: any = {
      media_id: 'audio:test_spn',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0.0, 1.0, 2.0],
        duration: [1.0, 1.0, 1.0],
      },
      payload: {
        payload_type: 'note',
        value: ['C4', 'E♭4', 'F♯3'],
      },
    };
    const validRes = validateBoppAnnotation(validNote);
    assert.strictEqual(validRes.isValid, true, JSON.stringify(validRes.issues));

    const invalidNote: any = {
      ...validNote,
      payload: {
        payload_type: 'note',
        value: ['C4', 'INVALID_PITCH', 'H4'],
      },
    };
    const invalidRes = validateBoppAnnotation(invalidNote);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.some(i => i.path.includes('value')));
  });

  await t.test('7. Schema validator validates spherical coordinate ranges', () => {
    const validSpherical: any = {
      media_id: 'sensor:test_spherical',
      bopp_version: '1.0',
      extent: {
        extent_type: 'spherical',
        azimuth: [-180.0, 0.0, 179.9],
        elevation: [-90.0, 0.0, 90.0],
        radius: [1.0, 2.5, 10.0],
      },
      payload: {
        payload_type: 'tag',
        value: ['src1', 'src2', 'src3'],
      },
    };
    const validRes = validateBoppAnnotation(validSpherical);
    assert.strictEqual(validRes.isValid, true, JSON.stringify(validRes.issues));

    const invalidSpherical: any = {
      ...validSpherical,
      extent: {
        extent_type: 'spherical',
        azimuth: [200.0], // Out of [-180, 180) range
        elevation: [100.0], // Out of [-90, 90] range
        radius: [-1.0], // Non-positive radius
      },
      payload: {
        payload_type: 'tag',
        value: ['src1'],
      },
    };
    const invalidRes = validateBoppAnnotation(invalidSpherical);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.length >= 2);
  });

  await t.test('8. Schema validator validates lyrics IETF BCP 47 language tags', () => {
    const validLyrics: any = {
      media_id: 'text:test_lyrics',
      bopp_version: '1.0',
      extent: {
        extent_type: 'text_interval',
        offset: [0, 5],
        length: [4, 4],
      },
      payload: {
        payload_type: 'lyrics',
        value: ['Hello', 'world'],
        language: 'en-US',
      },
    };
    const validRes = validateBoppAnnotation(validLyrics);
    assert.strictEqual(validRes.isValid, true, JSON.stringify(validRes.issues));

    const invalidLyrics: any = {
      ...validLyrics,
      payload: {
        ...validLyrics.payload,
        language: 'INVALID_1234_TAG_TOO_LONG_AND_NUMBERS',
      },
    };
    const invalidRes = validateBoppAnnotation(invalidLyrics);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.some(i => i.path.includes('language')));
  });

  await t.test('9. Schema validator validates agreement confidence with num_annotators', () => {
    const validAgreement: any = {
      media_id: 'audio:test_agreement',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time',
        time: [0.0, 1.0],
      },
      payload: {
        payload_type: 'tag',
        value: ['A', 'B'],
      },
      confidence: {
        confidence_type: 'agreement',
        num_annotators_common: 10,
        num_annotators: [10, 9],
        confidence: [0.9, 0.8],
      },
    };
    const validRes = validateBoppAnnotation(validAgreement);
    assert.strictEqual(validRes.isValid, true, JSON.stringify(validRes.issues));

    const invalidAgreement: any = {
      ...validAgreement,
      confidence: {
        confidence_type: 'agreement',
        num_annotators_common: -5, // Non-negative required
        confidence: [0.9, 0.8],
      },
    };
    const invalidRes = validateBoppAnnotation(invalidAgreement);
    assert.strictEqual(invalidRes.isValid, false);
    assert.ok(invalidRes.issues.some(i => i.path.includes('num_annotators_common')));
  });
});
