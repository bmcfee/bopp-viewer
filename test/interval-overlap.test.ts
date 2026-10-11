import test from 'node:test';
import assert from 'node:assert';
import * as vl from 'vega-lite';
import {
  isIntervalExtentType,
  toNumericCoordinate,
  checkIntervalsDisjoint,
  extractIntervalSpans,
  analyzeIntervalAnnotation,
} from '../src/utils/intervalOverlap';
import { buildBoppVegaLiteSpec } from '../src/utils/vegaLiteBuilder';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import type { BoppAnnotation } from '../src/types/bopp';

test('Interval Disjoint vs Overlap Analysis Suite', async (t) => {
  await t.test('1. isIntervalExtentType recognizes time/score/midi interval extents', () => {
    assert.strictEqual(isIntervalExtentType('time_interval'), true);
    assert.strictEqual(isIntervalExtentType('score_interval'), true);
    assert.strictEqual(isIntervalExtentType('midi_interval'), true);
    assert.strictEqual(isIntervalExtentType('custom_time_interval'), true);
    assert.strictEqual(isIntervalExtentType('beat_interval'), true);

    // Non-intervals
    assert.strictEqual(isIntervalExtentType('time'), false);
    assert.strictEqual(isIntervalExtentType('score_quarter'), false);
    assert.strictEqual(isIntervalExtentType('midi_tick'), false);
    assert.strictEqual(isIntervalExtentType('pixel_box'), false);
    assert.strictEqual(isIntervalExtentType('none'), false);
    assert.strictEqual(isIntervalExtentType(null), false);
    assert.strictEqual(isIntervalExtentType(undefined), false);
  });

  await t.test('2. toNumericCoordinate handles numbers, rational tuples, and strings', () => {
    assert.strictEqual(toNumericCoordinate(42), 42);
    assert.strictEqual(toNumericCoordinate(0), 0);
    assert.strictEqual(toNumericCoordinate(-15.5), -15.5);

    // Rational tuples [num, den]
    assert.strictEqual(toNumericCoordinate([4, 1]), 4);
    assert.strictEqual(toNumericCoordinate([1, 2]), 0.5);
    assert.strictEqual(toNumericCoordinate([3, 4]), 0.75);
    assert.strictEqual(toNumericCoordinate([0, 1]), 0);

    // Fractions in strings
    assert.strictEqual(toNumericCoordinate('3/4'), 0.75);
    assert.strictEqual(toNumericCoordinate('12.5'), 12.5);

    // Invalid coordinates
    assert.strictEqual(toNumericCoordinate(null), null);
    assert.strictEqual(toNumericCoordinate(undefined), null);
    assert.strictEqual(toNumericCoordinate('invalid'), null);
  });

  await t.test('3. checkIntervalsDisjoint identifies disjoint vs overlapping intervals', () => {
    // Empty or single
    assert.strictEqual(checkIntervalsDisjoint([]), true);
    assert.strictEqual(checkIntervalsDisjoint([{ start: 0, end: 10 }]), true);

    // Contiguous abutting intervals (0-10, 10-20, 20-30) are disjoint!
    const abutting = [
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: 30 },
    ];
    assert.strictEqual(checkIntervalsDisjoint(abutting), true);

    // Spaced intervals (gaps between them) are disjoint
    const spaced = [
      { start: 0, end: 5 },
      { start: 10, end: 15 },
      { start: 20, end: 25 },
    ];
    assert.strictEqual(checkIntervalsDisjoint(spaced), true);

    // Overlapping intervals
    const overlapping = [
      { start: 0, end: 12 },
      { start: 10, end: 25 }, // overlaps with 0-12
    ];
    assert.strictEqual(checkIntervalsDisjoint(overlapping), false);

    // Out-of-order intervals
    const outOfOrderDisjoint = [
      { start: 20, end: 30 },
      { start: 0, end: 10 },
      { start: 10, end: 20 },
    ];
    assert.strictEqual(checkIntervalsDisjoint(outOfOrderDisjoint), true);

    const outOfOrderOverlap = [
      { start: 20, end: 30 },
      { start: 5, end: 15 },
      { start: 0, end: 10 }, // overlaps with 5-15
    ];
    assert.strictEqual(checkIntervalsDisjoint(outOfOrderOverlap), false);
  });

  await t.test('4. Time interval annotations: disjoint vs overlapping analysis', () => {
    // Disjoint time intervals (e.g. tags_time_intervals)
    const disjointTimeDoc: BoppAnnotation = {
      media_id: 'audio:solo_and_ensemble',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0.0, 10.0, 25.0],
        duration: [10.0, 15.0, 20.0],
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Cello Solo', 'String Quartet', 'Orchestra'],
      },
    };
    const analysisDisjoint = analyzeIntervalAnnotation(disjointTimeDoc);
    assert.strictEqual(analysisDisjoint.isIntervalExtent, true);
    assert.strictEqual(analysisDisjoint.coordinateAxis, 'time');
    assert.strictEqual(analysisDisjoint.isDisjoint, true);
    assert.strictEqual(analysisDisjoint.hasOverlap, false);
    assert.strictEqual(analysisDisjoint.overlapCount, 0);
    assert.strictEqual(analysisDisjoint.shouldUseSingleRow, true);

    // Overlapping time intervals
    const overlappingTimeDoc: BoppAnnotation = {
      media_id: 'audio:concurrent_tracks',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0.0, 5.0, 15.0],
        duration: [20.0, 25.0, 20.0], // 0-20, 5-30, 15-35 all overlap!
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Bass', 'Drums', 'Lead Guitar'],
      },
    };
    const analysisOverlap = analyzeIntervalAnnotation(overlappingTimeDoc);
    assert.strictEqual(analysisOverlap.isIntervalExtent, true);
    assert.strictEqual(analysisOverlap.isDisjoint, false);
    assert.strictEqual(analysisOverlap.hasOverlap, true);
    assert.ok(analysisOverlap.overlapCount >= 2);
    assert.strictEqual(analysisOverlap.shouldUseSingleRow, false);
  });

  await t.test('5. Score interval annotations: rational fractions disjoint vs overlapping', () => {
    // Disjoint score intervals with fractional notation
    const disjointScoreDoc: BoppAnnotation = {
      media_id: 'score:beethoven_phrasing',
      bopp_version: '1.0',
      extent: {
        extent_type: 'score_interval',
        quarter: [[0, 1], [4, 1], [8, 1]],
        duration: [[4, 1], [4, 1], [4, 1]],
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Phrase 1', 'Phrase 2', 'Phrase 3'],
      },
    };
    const analysisScoreDisjoint = analyzeIntervalAnnotation(disjointScoreDoc);
    assert.strictEqual(analysisScoreDisjoint.isIntervalExtent, true);
    assert.strictEqual(analysisScoreDisjoint.coordinateAxis, 'score');
    assert.strictEqual(analysisScoreDisjoint.isDisjoint, true);
    assert.strictEqual(analysisScoreDisjoint.shouldUseSingleRow, true);

    // Overlapping score intervals
    const overlappingScoreDoc: BoppAnnotation = {
      media_id: 'score:polyphony',
      bopp_version: '1.0',
      extent: {
        extent_type: 'score_interval',
        quarter: [[0, 1], [2, 1]],
        duration: [[4, 1], [4, 1]], // [0, 4] and [2, 6] overlap!
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Voice 1', 'Voice 2'],
      },
    };
    const analysisScoreOverlap = analyzeIntervalAnnotation(overlappingScoreDoc);
    assert.strictEqual(analysisScoreOverlap.isIntervalExtent, true);
    assert.strictEqual(analysisScoreOverlap.isDisjoint, false);
    assert.strictEqual(analysisScoreOverlap.shouldUseSingleRow, false);
  });

  await t.test('6. MIDI interval annotations: tick intervals disjoint vs overlapping', () => {
    // Disjoint MIDI intervals
    const disjointMidiDoc: BoppAnnotation = {
      media_id: 'midi:arp_progression',
      bopp_version: '1.0',
      extent: {
        extent_type: 'midi_interval',
        tick: [0, 960, 1920],
        duration: [960, 960, 960],
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Part 1', 'Part 2', 'Part 3'],
      },
    };
    const analysisMidiDisjoint = analyzeIntervalAnnotation(disjointMidiDoc);
    assert.strictEqual(analysisMidiDisjoint.isIntervalExtent, true);
    assert.strictEqual(analysisMidiDisjoint.coordinateAxis, 'midi');
    assert.strictEqual(analysisMidiDisjoint.isDisjoint, true);
    assert.strictEqual(analysisMidiDisjoint.shouldUseSingleRow, true);

    // Overlapping MIDI intervals
    const overlappingMidiDoc: BoppAnnotation = {
      media_id: 'midi:poly_synth',
      bopp_version: '1.0',
      extent: {
        extent_type: 'midi_interval',
        tick: [0, 480],
        duration: [960, 960], // [0, 960] and [480, 1440] overlap!
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Layer A', 'Layer B'],
      },
    };
    const analysisMidiOverlap = analyzeIntervalAnnotation(overlappingMidiDoc);
    assert.strictEqual(analysisMidiOverlap.isIntervalExtent, true);
    assert.strictEqual(analysisMidiOverlap.isDisjoint, false);
    assert.strictEqual(analysisMidiOverlap.shouldUseSingleRow, false);
  });

  await t.test('7. Vega-Lite spec builder assigns single row for disjoint and multi rows for overlapping', () => {
    // 7A: Disjoint annotation uses single row (_single_row)
    const disjointDoc: BoppAnnotation = {
      media_id: 'audio:disjoint_test',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0, 10, 20],
        duration: [10, 10, 10],
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Tag A', 'Tag B', 'Tag C'],
      },
    };
    const specDisjoint = buildBoppVegaLiteSpec(disjointDoc);
    const layer0Disjoint = (specDisjoint.layer as any[])[0];
    assert.strictEqual(layer0Disjoint.encoding.y.field, '_single_row', 'Disjoint intervals must use _single_row for vertical axis');
    assert.ok(
      (specDisjoint.transform as any[]).some((t: any) => t.as === '_single_row'),
      'Must inject _single_row calculation transform'
    );

    // Verify it compiles to valid Vega
    const compiledDisjoint = vl.compile(specDisjoint as any);
    assert.ok(compiledDisjoint.spec, 'Disjoint spec must compile cleanly');

    // 7B: Overlapping annotation uses different row for each value (y: { field: "value" })
    const overlapDoc: BoppAnnotation = {
      media_id: 'audio:overlap_test',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0, 5],
        duration: [10, 10], // 0-10 and 5-15 overlap!
      },
      payload: {
        payload_type: 'tag_open',
        value: ['Tag A', 'Tag B'],
      },
    };
    const specOverlap = buildBoppVegaLiteSpec(overlapDoc);
    const layer0Overlap = (specOverlap.layer as any[])[0];
    assert.strictEqual(layer0Overlap.encoding.y.field, 'value', 'Overlapping intervals must use field "value" to allocate different rows');

    // Verify it compiles to valid Vega
    const compiledOverlap = vl.compile(specOverlap as any);
    assert.ok(compiledOverlap.spec, 'Overlapping spec must compile cleanly');
  });

  await t.test('8. Sample dataset tags_time_intervals renders as single row while tags_overlapping renders as multi-row', () => {
    const disjointDs = SAMPLE_DATASETS.find(d => d.id === 'tags_time_intervals');
    assert.ok(disjointDs, 'tags_time_intervals must exist');
    const specDisjoint = buildBoppVegaLiteSpec(disjointDs.data);
    assert.strictEqual((specDisjoint.layer as any[])[0].encoding.y.field, '_single_row');

    const overlapDs = SAMPLE_DATASETS.find(d => d.id === 'tags_overlapping_instruments');
    assert.ok(overlapDs, 'tags_overlapping_instruments must exist');
    const specOverlap = buildBoppVegaLiteSpec(overlapDs.data);
    assert.strictEqual((specOverlap.layer as any[])[0].encoding.y.field, 'value');
  });

  await t.test('9. Key mode time interval annotations use disjoint single-row vs overlapping multi-row logic', () => {
    // Disjoint modal progression -> single row track
    const disjointKeyDs = SAMPLE_DATASETS.find(d => d.id === 'modal_key_time');
    assert.ok(disjointKeyDs, 'modal_key_time must exist');
    const analysisDisjoint = analyzeIntervalAnnotation(disjointKeyDs.data);
    assert.strictEqual(analysisDisjoint.isDisjoint, true);
    assert.strictEqual(analysisDisjoint.shouldUseSingleRow, true);

    const specDisjoint = buildBoppVegaLiteSpec(disjointKeyDs.data);
    const layer0 = (specDisjoint.layer as any[])[0];
    assert.strictEqual(layer0.encoding.y.field, '_single_row', 'Disjoint key mode intervals must render on single row');
    const compiledDisjoint = vl.compile(specDisjoint as any);
    assert.ok(compiledDisjoint.spec, 'Disjoint key mode spec must compile cleanly');

    // Overlapping key intervals -> multi-row
    const overlappingKeyDoc: BoppAnnotation = {
      media_id: 'audio:polytonal_overlap',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        time: [0.0, 5.0],
        duration: [15.0, 15.0], // 0-15 and 5-20 overlap (polytonal)
      },
      payload: {
        payload_type: 'key_mode',
        value: ['C:maj', 'F#:maj'],
      },
    };
    const analysisOverlap = analyzeIntervalAnnotation(overlappingKeyDoc);
    assert.strictEqual(analysisOverlap.isDisjoint, false);
    assert.strictEqual(analysisOverlap.shouldUseSingleRow, false);

    const specOverlap = buildBoppVegaLiteSpec(overlappingKeyDoc);
    const layer0Overlap = (specOverlap.layer as any[])[0];
    assert.strictEqual(layer0Overlap.encoding.y.field, 'value', 'Overlapping key mode must use multi-row value field');
    const compiledOverlap = vl.compile(specOverlap as any);
    assert.ok(compiledOverlap.spec, 'Overlapping polytonal key spec must compile cleanly');
  });

  await t.test('10. Modal key split coloring displays tonic on top/outer and relative major on bottom/inner in static and time-varying cases', () => {
    const staticDs = SAMPLE_DATASETS.find(d => d.id === 'modal_key_global');
    assert.ok(staticDs, 'modal_key_global dataset must exist');
    const specStatic = buildBoppVegaLiteSpec(staticDs.data);
    const compiledStatic = vl.compile(specStatic as any);
    assert.ok(compiledStatic.spec, 'Static modal key spec must compile cleanly');

    const timeDs = SAMPLE_DATASETS.find(d => d.id === 'modal_key_time');
    assert.ok(timeDs, 'modal_key_time dataset must exist');
    const specTime = buildBoppVegaLiteSpec(timeDs.data);
    const compiledTime = vl.compile(specTime as any);
    assert.ok(compiledTime.spec, 'Time-varying modal key spec must compile cleanly');

    // Verify split patches are included in layers
    const timeLayers = specTime.layer as any[];
    assert.ok(timeLayers.length >= 4, 'Must contain base, top half, bottom half, and label layers');
  });
});
