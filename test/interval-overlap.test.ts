import test from 'node:test';
import assert from 'node:assert';
import * as vl from 'vega-lite';
import {
  isIntervalExtentType,
  getExtentTopology,
  resolveDomainRange,
  formatExtentBoundsSummary,
  resolveActiveGrouping,
} from '../src/utils/extentTopology';
import { annotationToTabular } from '../src/utils/boppParser';
import { buildBoppVegaLiteSpec } from '../src/utils/vegaLiteBuilder';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import type { BoppAnnotation } from '../src/types/bopp';

test('Extent Topology & Coherent Grouping Routing Suite', async (t) => {
  await t.test('1. isIntervalExtentType recognizes time/score/midi/text/spatial interval extents', () => {
    assert.strictEqual(isIntervalExtentType('time_interval'), true);
    assert.strictEqual(isIntervalExtentType('score_interval'), true);
    assert.strictEqual(isIntervalExtentType('score_interval_float'), true);
    assert.strictEqual(isIntervalExtentType('midi_interval'), true);
    assert.strictEqual(isIntervalExtentType('text_interval'), true);
    assert.strictEqual(isIntervalExtentType('cartesian_time_interval'), true);
    assert.strictEqual(isIntervalExtentType('spherical_time_interval'), true);

    // Non-intervals
    assert.strictEqual(isIntervalExtentType('time'), false);
    assert.strictEqual(isIntervalExtentType('time_uniform'), false);
    assert.strictEqual(isIntervalExtentType('score_quarter'), false);
    assert.strictEqual(isIntervalExtentType('midi_tick'), false);
    assert.strictEqual(isIntervalExtentType('pixel_box'), false);
    assert.strictEqual(isIntervalExtentType('none'), false);
    assert.strictEqual(isIntervalExtentType(null), false);
    assert.strictEqual(isIntervalExtentType(undefined), false);
  });

  await t.test('2. getExtentTopology and resolveDomainRange extract disjoint, exhaustive, and min/max bounds', () => {
    const topo = getExtentTopology({
      extent_type: 'time_interval',
      disjoint: true,
      exhaustive: false,
      min_time: 0.0,
      max_time: 120.0,
      time: [5.0, 20.0],
      duration: [10.0, 15.0],
    });

    assert.strictEqual(topo.disjoint, true);
    assert.strictEqual(topo.exhaustive, false);
    assert.strictEqual(topo.minPrimary, 0.0);
    assert.strictEqual(topo.maxPrimary, 120.0);

    const [lo, hi] = resolveDomainRange(5.0, 35.0, topo.minPrimary, topo.maxPrimary);
    assert.strictEqual(lo, 0.0);
    assert.strictEqual(hi, 120.0);

    const summary = formatExtentBoundsSummary({
      extent_type: 'time_frequency_box',
      disjoint: false,
      exhaustive: false,
      min_time: 0,
      max_time: 10,
      min_freq: 100,
      max_freq: 8000,
      time: [1],
      duration: [2],
      freq_min: [200],
      freq_max: [400],
    });
    assert.ok(summary.some(s => s.includes('time: [0, 10]s')));
    assert.ok(summary.some(s => s.includes('freq: [100, 8000] Hz')));
  });

  await t.test('3. resolveActiveGrouping resolves group IDs, inverted labels, and negative ungrouped sentinel', () => {
    const doc: BoppAnnotation = {
      media_id: 'audio:test_grouping',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        disjoint: false,
        exhaustive: true,
        time: [0, 10, 0, 10, 5],
        duration: [10, 10, 10, 10, 5],
      },
      payload: {
        payload_type: 'tag',
        value: ['A', 'B', 'a1', 'b1', 'noise'],
      },
      groupings: [
        {
          name: 'Hierarchy',
          disjoint: true,
          exhaustive: true,
          labels: { 'Coarse Level': 0, 'Fine Level': 1 },
          ids: [0, 0, 1, 1, -1],
        },
        {
          name: 'Secondary',
          disjoint: false,
          exhaustive: false,
          ids: [0, 1, 0, 1, 0],
        },
      ],
    };

    const g0 = resolveActiveGrouping(doc, 0);
    assert.ok(g0);
    assert.strictEqual(g0.name, 'Hierarchy');
    assert.strictEqual(g0.disjoint, true);
    assert.strictEqual(g0.exhaustive, true);
    assert.deepStrictEqual(g0.nonNegativeGroupIds, [0, 1]);
    assert.deepStrictEqual(g0.nonNegativeGroupLabels, ['Coarse Level', 'Fine Level']);
    assert.strictEqual(g0.hasUngrouped, true);
    assert.deepStrictEqual(g0.orderedGroupLabels, ['Coarse Level', 'Fine Level', 'Ungrouped']);
    assert.strictEqual(g0.getLabelForId(0), 'Coarse Level');
    assert.strictEqual(g0.getLabelForId(-1), 'Ungrouped');

    // Explicitly ungrouped (activeGroupingIndex = null)
    const gNone = resolveActiveGrouping(doc, null);
    assert.strictEqual(gNone, null);

    // Second grouping with auto-generated fallback labels
    const g1 = resolveActiveGrouping(doc, 1);
    assert.ok(g1);
    assert.strictEqual(g1.name, 'Secondary');
    assert.strictEqual(g1.disjoint, false);
    assert.strictEqual(g1.getLabelForId(0), 'Secondary 0');
    assert.strictEqual(g1.getLabelForId(1), 'Secondary 1');

    // Tabular injection
    const rows = annotationToTabular(doc, 0);
    assert.strictEqual(rows[0]._group_id, 0);
    assert.strictEqual(rows[0]._group_label, 'Coarse Level');
    assert.strictEqual(rows[4]._group_id, -1);
    assert.strictEqual(rows[4]._group_label, 'Ungrouped');
  });

  await t.test('4. Vega-Lite spec builder routes disjoint vs overlapping interval extents via schema flags', () => {
    // Disjoint annotation uses single row (_single_row)
    const disjointDoc: BoppAnnotation = {
      media_id: 'audio:disjoint_test',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        disjoint: true,
        exhaustive: true,
        time: [0, 10, 20],
        duration: [10, 10, 10],
      },
      payload: {
        payload_type: 'tag',
        value: ['Tag A', 'Tag B', 'Tag C'],
      },
    };
    const specDisjoint = buildBoppVegaLiteSpec(disjointDoc);
    const disjointLayers = (specDisjoint as any).vconcat ? (specDisjoint as any).vconcat[0].layer : (specDisjoint as any).layer;
    const layer0Disjoint = disjointLayers[0];
    assert.strictEqual(layer0Disjoint.encoding.y.field, '_single_row', 'Disjoint intervals must use _single_row for vertical axis');
    assert.ok(vl.compile(specDisjoint as any).spec);

    // Overlapping annotation uses different row for each value (y: { field: "value" })
    const overlapDoc: BoppAnnotation = {
      media_id: 'audio:overlap_test',
      bopp_version: '1.0',
      extent: {
        extent_type: 'time_interval',
        disjoint: false,
        exhaustive: false,
        time: [0, 5],
        duration: [10, 10],
      },
      payload: {
        payload_type: 'tag',
        value: ['Tag A', 'Tag B'],
      },
    };
    const specOverlap = buildBoppVegaLiteSpec(overlapDoc);
    const overlapLayers = (specOverlap as any).vconcat ? (specOverlap as any).vconcat[0].layer : (specOverlap as any).layer;
    const layer0Overlap = overlapLayers[0];
    assert.strictEqual(layer0Overlap.encoding.y.field, 'value', 'Overlapping intervals must use field "value" to allocate different rows');
    assert.ok(vl.compile(specOverlap as any).spec);
  });

  await t.test('5. Multi-level hierarchical segmentation (grouping.disjoint = true) routes to 1 row per group level', () => {
    const hierDs = SAMPLE_DATASETS.find(d => d.id === 'hierarchical_segmentation_salami')!;
    assert.ok(hierDs, 'hierarchical_segmentation_salami dataset must exist');

    // Grouping 0: Hierarchy Level (disjoint: true) -> 1 horizontal row per group ID (_group_label on Y axis)
    const tabular0 = annotationToTabular(hierDs.data, 0);
    const specG0: any = buildBoppVegaLiteSpec(hierDs.data, tabular0, { activeGroupingIndex: 0 });
    const detailG0 = specG0.vconcat ? specG0.vconcat[0] : specG0;
    assert.strictEqual(detailG0.layer[0].encoding.y.field, '_group_label', 'Disjoint grouping on intervals must map _group_label to Y axis rows');
    assert.ok(vl.compile(specG0).spec);

    // Grouping 1: Thematic Family (disjoint: false) -> ordered vertical subplots (vconcat)
    const tabular1 = annotationToTabular(hierDs.data, 1);
    const specG1: any = buildBoppVegaLiteSpec(hierDs.data, tabular1, { activeGroupingIndex: 1 });
    assert.ok(Array.isArray(specG1.vconcat), 'Non-disjoint tag grouping must render ordered vertical subplots via vconcat');
    assert.ok(specG1.vconcat.length >= 3, 'Must have a subplot for each thematic family group');
    assert.ok(vl.compile(specG1).spec);

    // Ungrouped (activeGroupingIndex: null) -> falls back to extent.disjoint = false (one row per tag value)
    const tabularNone = annotationToTabular(hierDs.data, null);
    const specNone: any = buildBoppVegaLiteSpec(hierDs.data, tabularNone, { activeGroupingIndex: null });
    const detailNone = specNone.vconcat ? specNone.vconcat[0] : specNone;
    assert.strictEqual(detailNone.layer[0].encoding.y.field, 'value');
    assert.ok(vl.compile(specNone).spec);
  });

  await t.test('6. Polyphonic F0 trajectories with groupings render colored group outlines and trajectory lines', () => {
    const duetDs = SAMPLE_DATASETS.find(d => d.id === 'polyphonic_f0_duet_grouped')!;
    assert.ok(duetDs, 'polyphonic_f0_duet_grouped dataset must exist');

    // Grouping 0: Voice Stream (disjoint: true) -> connected trajectory lines per group + colored outer casing
    const tab0 = annotationToTabular(duetDs.data, 0);
    const spec0: any = buildBoppVegaLiteSpec(duetDs.data, tab0, { activeGroupingIndex: 0 });
    const detail0 = spec0.vconcat ? spec0.vconcat[0] : spec0;
    const lineLayers0 = detail0.layer.filter((l: any) => l.mark?.type === 'line');
    assert.ok(lineLayers0.length >= 2, 'Voice Stream (disjoint=true) must render both outer group casing line and inner trajectory line');
    assert.ok(vl.compile(spec0).spec);

    // Ungrouped (activeGroupingIndex: null) -> extent.disjoint is false, so multipitch scatter points without connecting line
    const tabNone = annotationToTabular(duetDs.data, null);
    const specNone: any = buildBoppVegaLiteSpec(duetDs.data, tabNone, { activeGroupingIndex: null });
    const detailNone = specNone.vconcat ? specNone.vconcat[0] : specNone;
    const lineLayersNone = detailNone.layer.filter((l: any) => l.mark?.type === 'line');
    assert.strictEqual(lineLayersNone.length, 0, 'Ungrouped polyphonic F0 (extent.disjoint=false) must render as multipitch scatter without trajectory line');
    assert.ok(vl.compile(specNone).spec);
  });
});
