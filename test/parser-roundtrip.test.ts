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
    const chordDs = SAMPLE_DATASETS.find(d => d.id.includes('drive'))!;
    const rows = annotationToTabular(chordDs.data);

    assert.strictEqual(rows.length, chordDs.data.extent.time.length);
    assert.strictEqual(rows[0].time, chordDs.data.extent.time[0]);
    assert.strictEqual(rows[0].value, chordDs.data.payload.value[0]);
    assert.strictEqual(typeof rows[0].confidence, 'number');
  });

  await t.test('4. time_uniform extent synthesizes time coordinates t[i] = start_time + i * sampling_period', () => {
    const uniformDs = SAMPLE_DATASETS.find(d => d.id === 'time_uniform_frequency_hz_likelihood')!;
    const rows = annotationToTabular(uniformDs.data);

    assert.strictEqual(rows.length, (uniformDs.data.payload as any).value.length);
    assert.strictEqual(rows[0].time, 0.0);
    assert.strictEqual(rows[1].time, 0.05);
    assert.strictEqual(rows[2].time, 0.1);
    assert.strictEqual(rows[3].time, 0.15);
    assert.strictEqual(rows[0].hz, 220.0);
    assert.strictEqual(rows[0].voiced, true);
    assert.strictEqual(rows[12].voiced, false); // Voiced flag false correctly captured
  });

  await t.test('5. marker payload determines observation count from extent and sets description', () => {
    const markerDs = SAMPLE_DATASETS.find(d => d.id === 'time_onset_likelihood')!;
    const rows = annotationToTabular(markerDs.data);

    assert.strictEqual(rows.length, (markerDs.data.extent as any).time.length);
    assert.strictEqual(rows[0].description, 'onset');
    assert.strictEqual(rows[0].time, 0.12);
  });

  await t.test('6. Scientific Pitch Notation (SPN) note payload is parsed to MIDI numbers and semitones', () => {
    const spnDs = SAMPLE_DATASETS.find(d => d.id === 'interval_note_spn_pianoroll')!;
    const rows = annotationToTabular(spnDs.data);

    assert.strictEqual(rows.length, 8);
    // C4 is MIDI 60
    assert.strictEqual(rows[0].midi, 60);
    assert.strictEqual(rows[0].note_name, 'C4');
    // D4 is MIDI 62
    assert.strictEqual(rows[1].midi, 62);
    // E♭4 is MIDI 63
    assert.strictEqual(rows[2].midi, 63);
    assert.strictEqual(rows[2].note_name, 'E♭4');
    // F4 is MIDI 65
    assert.strictEqual(rows[3].midi, 65);
    // C5 is MIDI 72
    assert.strictEqual(rows[7].midi, 72);
  });

  await t.test('7. pixel extent extracts 2D image coordinates (x, y)', () => {
    const pixelDs = SAMPLE_DATASETS.find(d => d.id === 'spatial_pixel_notehead_centers')!;
    const rows = annotationToTabular(pixelDs.data);

    assert.strictEqual(rows.length, 8);
    assert.strictEqual(rows[0].x, 120);
    assert.strictEqual(rows[0].y, 340);
  });

  await t.test('8. text and text_interval extents extract offset and length', () => {
    const textIntervalDs = SAMPLE_DATASETS.find(d => d.id === 'text_interval_lyrics_word_spans')!;
    const rows = annotationToTabular(textIntervalDs.data);

    assert.strictEqual(rows.length, 8);
    assert.strictEqual(rows[0].offset, 0);
    assert.strictEqual(rows[0].length, 3);
    assert.strictEqual(rows[0].value, 'Row');
    assert.strictEqual(rows[0].language, 'en-US');
  });

  await t.test('9. agreement confidence extracts num_annotators and num_annotators_common', () => {
    const agreeDs = SAMPLE_DATASETS.find(d => d.id === 'interval_segment_open_agreement')!;
    const rows = annotationToTabular(agreeDs.data);

    assert.strictEqual(rows.length, 7);
    assert.strictEqual(rows[0].num_annotators, 25);
    assert.strictEqual(rows[0].num_annotators_common, 25);
    assert.strictEqual(rows[2].num_annotators, 24);
  });
});
