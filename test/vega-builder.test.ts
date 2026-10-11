import test from 'node:test';
import assert from 'node:assert';
import * as vl from 'vega-lite';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import { annotationToTabular } from '../src/utils/boppParser';
import { buildBoppVegaLiteSpec } from '../src/utils/vegaLiteBuilder';

test('Vega-Lite Visualizer Builder Test Suite', async (t) => {
  await t.test('1. Every sample dataset builds a valid, compilable Vega-Lite specification', () => {
    for (const sample of SAMPLE_DATASETS) {
      const tabular = annotationToTabular(sample.data);
      const spec = buildBoppVegaLiteSpec(sample.data, tabular, {
        chartWidth: 700,
        chartHeight: 300,
        isDark: true,
        enableOverviewBrush: true,
      });

      assert.ok(spec, `Spec must be generated for ${sample.id}`);
      assert.strictEqual(
        spec.$schema,
        'https://vega.github.io/schema/vega-lite/v5.json',
        `Spec must reference Vega-Lite v5 schema for ${sample.id}`
      );

      // Verify Vega-Lite can compile without error
      assert.doesNotThrow(() => {
        vl.compile(spec as any);
      }, `Vega-Lite compiler failed for ${sample.id}`);
    }
  });

  await t.test('2. Chord datasets with overview brush compile with direct unit pattern and scale binding', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id === 'drive_bopp')!;
    const tabular = annotationToTabular(chordDs.data);
    const spec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      chartWidth: 700,
      chartHeight: 300,
      isDark: true,
      enableOverviewBrush: true,
    }) as any;

    assert.ok(spec.vconcat, 'Drive BOPP should compile to vconcat when overview brush is enabled');
    assert.strictEqual(spec.vconcat.length, 2, 'Should have detail and overview components');

    // Detail view should bind x scale to brush parameter
    const detail = spec.vconcat[0];
    const rectLayer = detail.layer[0];
    assert.deepStrictEqual(
      rectLayer.encoding.x.scale,
      { domain: { param: 'brush' } },
      'Detail view must bind x scale to param: brush'
    );

    // Overview navigator must declare brush parameter
    const overview = spec.vconcat[1];
    assert.ok(overview.params, 'Overview must declare params');
    const brushParam = overview.params.find((p: any) => p.name === 'brush');
    assert.ok(brushParam, 'Overview must declare param named brush');
    assert.strictEqual(brushParam.select.type, 'interval');
    assert.strictEqual(brushParam.select.zoom, true, 'Brush must have zoom enabled');
    assert.strictEqual(brushParam.select.clear, false, 'Brush must have clear: false');
  });

  await t.test('3. Confidence bars are achromatic (zero-hue: black, white, gray only)', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id === 'drive_bopp')!;
    const tabular = annotationToTabular(chordDs.data);
    const darkSpec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      isDark: true,
      confidenceChannel: 'meter',
    }) as any;

    const layers = darkSpec.vconcat ? darkSpec.vconcat[0].layer : darkSpec.layer;
    // Check meter track & active bar
    const meterLayer = layers.find((l: any) => l.mark?.type === 'rect' && l.mark?.fill === '#000000');
    assert.ok(meterLayer, 'Dark theme confidence track must be achromatic (#000000)');

    const activeBarLayer = layers.find((l: any) => l.mark?.type === 'rect' && l.mark?.stroke === '#ffffff');
    assert.ok(activeBarLayer, 'Dark theme active confidence bar must have achromatic white border');

    const range = activeBarLayer.encoding.color.scale.range;
    for (const color of range) {
      assert.ok(
        color === '#ffffff' || color.startsWith('#52525b') || color.startsWith('#a1a1aa') || color.startsWith('#e4e4e7'),
        `Confidence bar color ${color} must be achromatic`
      );
    }
  });

  await t.test('4. Vocal melody with variance renders error whiskers (±1.96σ)', () => {
    const vocalDs = SAMPLE_DATASETS.find(d => d.id === 'vocal_f0_contour')!;
    const tabular = annotationToTabular(vocalDs.data);
    const spec = buildBoppVegaLiteSpec(vocalDs.data, tabular, {
      isDark: true,
    }) as any;

    const layers = spec.vconcat ? spec.vconcat[0].layer : spec.layer;
    const ruleLayer = layers.find((l: any) => l.mark?.type === 'rule' && l.encoding?.y2?.field === 'frequency_ci_upper');
    assert.ok(ruleLayer, 'Vocal melody must render error whisker rules from lower to upper CI');

    const tickLayer = layers.find((l: any) => l.mark?.type === 'tick' && l.encoding?.y?.field === 'frequency_ci_upper');
    assert.ok(tickLayer, 'Vocal melody must render error bar cap ticks');
  });
});
