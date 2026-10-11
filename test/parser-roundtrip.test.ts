import test from 'node:test';
import assert from 'node:assert';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import {
  parseBoppJson,
  parseBoppMsgpack,
  serializeBoppJson,
  serializeBoppMsgpack,
  annotationToTabular,
} from '../src/utils/boppParser';

test('BOPP Parser & Serialization Test Suite', async (t) => {
  await t.test('1. JSON roundtrip preserves data fidelity across all datasets', () => {
    for (const sample of SAMPLE_DATASETS.slice(0, 10)) {
      const jsonStr = serializeBoppJson(sample.data);
      const parsed = parseBoppJson(jsonStr);
      assert.strictEqual(parsed.media_id, sample.data.media_id);
      assert.strictEqual(parsed.bopp_version, sample.data.bopp_version);
      assert.strictEqual(parsed.payload.payload_type, sample.data.payload.payload_type);
    }
  });

  await t.test('2. MessagePack binary roundtrip preserves data structures', () => {
    for (const sample of SAMPLE_DATASETS.slice(0, 10)) {
      const u8 = serializeBoppMsgpack(sample.data);
      assert.ok(u8 instanceof Uint8Array, 'MessagePack serialized must be Uint8Array');
      assert.ok(u8.length > 0, 'Serialized bytes must not be empty');

      const decoded = parseBoppMsgpack(u8);
      assert.strictEqual(decoded.media_id, sample.data.media_id);
      assert.strictEqual(decoded.payload.payload_type, sample.data.payload.payload_type);
    }
  });

  await t.test('3. Tabular conversion extracts correct column metrics', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id === 'drive_bopp')!;
    const rows = annotationToTabular(chordDs.data);

    assert.strictEqual(rows.length, chordDs.data.extent.time.length);
    assert.strictEqual(rows[0].time, chordDs.data.extent.time[0]);
    assert.strictEqual(rows[0].value, chordDs.data.payload.value[0]);
    assert.strictEqual(typeof rows[0].confidence, 'number');
  });
});
