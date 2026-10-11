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
});
