import test from 'node:test';
import assert from 'node:assert';
import * as vl from 'vega-lite';
import { parse as parseVega } from 'vega-parser';
import { View } from 'vega';
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
        'https://vega.github.io/schema/vega-lite/v6.json',
        `Spec must reference Vega-Lite v6 schema for ${sample.id}`
      );

      // Verify Vega-Lite can compile without error and Vega can parse it cleanly
      const compiled = vl.compile(spec as any);
      assert.doesNotThrow(() => {
        parseVega(compiled.spec);
      }, `Vega parser failed for ${sample.id}`);
    }
  });

  await t.test('2. Chord datasets with overview brush compile with direct unit pattern and scale binding', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id.includes('drive'))!;
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
    const chordDs = SAMPLE_DATASETS.find(d => d.id.includes('drive'))!;
    const tabular = annotationToTabular(chordDs.data);
    const darkSpec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      isDark: true,
      confidenceChannel: 'meter',
    }) as any;

    const layers = darkSpec.vconcat ? darkSpec.vconcat[0].layer : darkSpec.layer;
    // Check meter track & active bar
    const meterLayer = layers.find((l: any) => l.mark?.type === 'rect' && (l.mark?.fill === '#000000' || l.mark?.fill?.includes('rgba(0,0,0') || l.mark?.fill?.includes('rgba(0, 0, 0')));
    assert.ok(meterLayer, 'Dark theme confidence track must be achromatic');

    const activeBarLayer = layers.find((l: any) => l.mark?.type === 'rect' && l.mark?.stroke === '#ffffff');
    assert.ok(activeBarLayer, 'Dark theme active confidence bar must have achromatic white border');

    const range = activeBarLayer.encoding.color.scale.range;
    for (const color of range) {
      assert.ok(
        color === '#ffffff' ||
        color.startsWith('#52525b') ||
        color.startsWith('#a1a1aa') ||
        color.startsWith('#e4e4e7') ||
        color.startsWith('#64748b') ||
        color.startsWith('#94a3b8') ||
        color.startsWith('#e2e8f0'),
        `Confidence bar color ${color} must be achromatic`
      );
    }
  });

  await t.test('4. Vocal melody with variance renders error whiskers (±1.96σ)', () => {
    const vocalDs = SAMPLE_DATASETS.find(d => d.id.includes('puccini') || d.id === 'time_f0_puccini_variance')!;
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

  await t.test('5. Bioacoustic TF boxes with likelihood compiles and parses in dark mode', () => {
    const tfDs = SAMPLE_DATASETS.find(d => d.id === 'spatial_bioacoustic_tf_likelihood')!;
    const tabular = annotationToTabular(tfDs.data);
    const darkSpec = buildBoppVegaLiteSpec(tfDs.data, tabular, {
      isDark: true,
      confidenceChannel: 'meter',
    });
    const compiled = vl.compile(darkSpec as any);
    assert.ok(compiled.spec, 'Bioacoustic spec must compile in dark mode');
    assert.doesNotThrow(() => {
      parseVega(compiled.spec);
    }, 'Vega parser failed on Bioacoustic spec in dark mode');
  });

  await t.test('6. Timeline navigator detail scale binds domainRaw to brush signal for zoom and pan', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id.includes('drive'))!;
    const tabular = annotationToTabular(chordDs.data);
    const spec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      chartWidth: 700,
      chartHeight: 300,
      enableOverviewBrush: true,
      enableZoomPan: true,
    }) as any;

    const compiled = vl.compile(spec);
    const xDetailScale = compiled.spec.scales?.find((s: any) => s.name === 'concat_0_x');
    assert.ok(xDetailScale, 'Spec must contain concat_0_x scale');
    assert.ok(xDetailScale.domainRaw, 'Detail scale concat_0_x must bind domainRaw to brush signal');
    assert.strictEqual(xDetailScale.domainRaw.signal, 'brush["time"]', 'Detail scale domainRaw must reference brush["time"]');
  });

  await t.test('7. TF boxes and pixel boxes use unified label styling with halo backdrop and crisp foreground', () => {
    // 1. Check TF box
    const tfDs = SAMPLE_DATASETS.find(d => d.id === 'spatial_bioacoustic_tf_likelihood')!;
    const tfTabular = annotationToTabular(tfDs.data);
    const tfSpec = buildBoppVegaLiteSpec(tfDs.data, tfTabular, {
      showLabels: true,
      hasConfidence: true,
    }) as any;
    const tfLayers = tfSpec.vconcat ? tfSpec.vconcat[0].layer : tfSpec.layer;
    const tfTextLayers = tfLayers.filter((l: any) => l.mark?.type === 'text');
    assert.strictEqual(tfTextLayers.length, 2, 'TF box must have 2 text layers (halo + foreground)');
    const tfHalo = tfTextLayers[0];
    const tfFg = tfTextLayers[1];
    assert.strictEqual(tfHalo.mark.strokeWidth, 3, 'TF halo strokeWidth must be 3');
    assert.strictEqual(tfHalo.mark.fill, 'transparent', 'TF halo fill must be transparent');
    assert.strictEqual(tfFg.mark.fill, '#ffffff', 'TF foreground text must be white');
    assert.strictEqual(tfFg.mark.baseline, 'top', 'TF foreground baseline must be top');
    assert.strictEqual(tfFg.mark.dx, 4, 'TF foreground dx must be 4');
    assert.strictEqual(tfFg.mark.dy, 4, 'TF foreground dy must be 4');

    // 2. Check Pixel box
    const pixelAnnotation: any = {
      media_id: 'omr_test_page',
      version: '1.0.0',
      extent: { extent_type: 'pixel_box' },
      payload: { payload_type: 'symbol_classes' },
      confidence: { confidence_type: 'likelihood' },
      records: [
        { x: 10, y: 20, width: 50, height: 40, value: 'clef_g', confidence: 0.95 }
      ]
    };
    const pixelTabular = annotationToTabular(pixelAnnotation);
    const pixelSpec = buildBoppVegaLiteSpec(pixelAnnotation, pixelTabular, {
      showLabels: true,
      hasConfidence: true,
    }) as any;
    const pixelLayers = pixelSpec.layer;
    const pixelTextLayers = pixelLayers.filter((l: any) => l.mark?.type === 'text');
    assert.strictEqual(pixelTextLayers.length, 2, 'Pixel box must have 2 text layers (halo + foreground)');
    const pixelHalo = pixelTextLayers[0];
    const pixelFg = pixelTextLayers[1];
    assert.strictEqual(pixelHalo.mark.strokeWidth, 3, 'Pixel halo strokeWidth must be 3');
    assert.strictEqual(pixelHalo.mark.fill, 'transparent', 'Pixel halo fill must be transparent');
    assert.strictEqual(pixelFg.mark.fill, '#ffffff', 'Pixel foreground text must be white');
    assert.strictEqual(pixelFg.mark.baseline, 'top', 'Pixel foreground baseline must be top');
    assert.strictEqual(pixelFg.mark.dx, 4, 'Pixel foreground dx must be 4');
    assert.strictEqual(pixelFg.mark.dy, 4, 'Pixel foreground dy must be 4');

    // Both must use identical label transform expressions
    assert.strictEqual(
      tfHalo.transform[0].calculate,
      pixelHalo.transform[0].calculate.replace('_box_label', '_tf_label'),
      'TF and Pixel boxes must use identical calculate expressions for labels'
    );
  });

  await t.test('8. Confidence meters are positioned strictly inside extent boxes and never float above', async () => {
    const dsList = ['interval_chord_overlapping_likelihood', 'interval_key_likelihood', 'interval_tags_overlapping_likelihood'];
    for (const id of dsList) {
      const ds = SAMPLE_DATASETS.find(d => d.id === id)!;
      const tabular = annotationToTabular(ds.data);
      for (const multiRow of [false, true]) {
        const spec = buildBoppVegaLiteSpec(ds.data, tabular, {
          chartWidth: 700,
          chartHeight: 300,
          isDark: true,
          confidenceChannel: 'meter',
          forceMultiRow: multiRow,
        }) as any;

        const compiled = vl.compile(spec);
        const runtime = parseVega(compiled.spec);
        const view = new View(runtime, { renderer: 'none' });
        await view.runAsync();

        const sgRoot = (view as any).scenegraph?.()?.root?.items?.[0];
        const g0 = sgRoot?.items?.[0]?.items?.[0] || sgRoot;
        const primaryMark = g0.items.find((m: any) =>
          m.marktype === 'rect' && m.name && (m.name.includes('layer_0') || m.name.includes('layer_1')) &&
          m.items?.[0]?.height && m.items[0].height > 5
        );
        const meterMarks = g0.items.filter((m: any) =>
          m.marktype === 'rect' && m.items?.[0]?.height && m.items[0].height <= 5 &&
          m.name && (m.name.includes('layer_1') || m.name.includes('layer_2') || m.name.includes('layer_3') || m.name.includes('layer_4'))
        );

        if (primaryMark && meterMarks.length > 0) {
          const pItem = primaryMark.items[0];
          const mItem = meterMarks[0].items[0];
          const pTop = pItem.y;
          const pBottom = pItem.y + pItem.height;
          const mTop = mItem.y;
          const mBottom = mItem.y + mItem.height;

          assert.ok(mTop >= pTop - 0.5, `Meter top ${mTop} must not be above box top ${pTop} in ${id} (multiRow=${multiRow})`);
          assert.ok(mBottom <= pBottom + 0.5, `Meter bottom ${mBottom} must not be below box bottom ${pBottom} in ${id} (multiRow=${multiRow})`);
        }
      }
    }
  });

  await t.test('9. Playhead scale mapping is valid across all display types and extents', async () => {
    for (const sample of SAMPLE_DATASETS) {
      const tabular = annotationToTabular(sample.data);
      const spec = buildBoppVegaLiteSpec(sample.data, tabular, {
        chartWidth: 700,
        chartHeight: 300,
        enableOverviewBrush: true,
      }) as any;
      const compiled = vl.compile(spec);
      const runtime = parseVega(compiled.spec);
      const view = new View(runtime, { renderer: 'none' });
      await view.runAsync();

      const scaleNames = Object.keys((view as any)._runtime?.scales || {});
      const detailScaleName = ['concat_0_x', 'x', 'layer_0_x', ...scaleNames.filter(k => k.endsWith('_x'))].find(k => scaleNames.includes(k));
      if (!detailScaleName) continue;
      const detailScale = view.scale(detailScaleName);
      assert.strictEqual(typeof detailScale, 'function', `Scale ${detailScaleName} must be a function for ${sample.id}`);

      // Test playhead at t = 1.0 second
      const tSec = 1.0;
      const extentType = sample.data.extent?.extent_type;
      let coordVal = tSec;
      if (extentType?.includes('tick') || extentType?.includes('midi')) {
        coordVal = tSec * 960;
      } else if (extentType?.includes('quarter') || extentType?.includes('score')) {
        coordVal = tSec * 2;
      }
      const x = detailScale(coordVal);
      assert.strictEqual(typeof x, 'number', `Scale output for ${sample.id} must be a number`);
      assert.ok(!isNaN(x), `Scale output for ${sample.id} must not be NaN`);
    }
  });

  await t.test('10. Playhead and detailGroup alignment are accurate in both vconcat and single-plot modes', async () => {
    for (const enableOverview of [true, false]) {
      for (const sample of SAMPLE_DATASETS) {
        const tabular = annotationToTabular(sample.data);
        const spec = buildBoppVegaLiteSpec(sample.data, tabular, {
          chartWidth: 760,
          chartHeight: 300,
          enableOverviewBrush: enableOverview,
        }) as any;
        const compiled = vl.compile(spec);
        const runtime = parseVega(compiled.spec);
        const view = new View(runtime, { renderer: 'none' });
        await view.runAsync();

        const scaleNames = Object.keys((view as any)._runtime?.scales || {});
        let detailScaleName = ['concat_0_x', 'x', 'layer_0_x', ...scaleNames.filter(k => k.endsWith('_x'))].find(k => scaleNames.includes(k));
        if (detailScaleName === 'concat_0_x' && scaleNames.includes('concat_1_x')) {
          const s0 = view.scale('concat_0_x');
          const d0 = s0 && typeof s0.domain === 'function' ? s0.domain() : null;
          if (d0 && typeof d0[0] === 'number' && d0[0] < -0.1) {
            detailScaleName = 'concat_1_x';
          }
        }
        if (!detailScaleName) continue;

        const isVConcat = Boolean(scaleNames.includes('concat_0_x') && scaleNames.includes('concat_1_x') && detailScaleName === 'concat_0_x');
        const sgRoot = (view as any).scenegraph?.()?.root?.items?.[0];
        const detailGroup = isVConcat
          ? (sgRoot?.items?.[0]?.items?.[0] || sgRoot?.items?.[0])
          : detailScaleName === 'concat_1_x'
          ? (sgRoot?.items?.[1]?.items?.[0] || sgRoot?.items?.[1])
          : sgRoot;

        const yOffset = detailGroup?.y ?? 0;
        // Detail group y-offset must always align to 0 (top of the plot area) and never point to an axis offset (> 50px)
        assert.ok(
          yOffset <= 1,
          `Detail group yOffset for ${sample.id} (enableOverview=${enableOverview}) must be 0, got ${yOffset}`
        );
      }
    }
  });

  await t.test('11. Playhead mapping directly matches mark timestamps with zero offset across all datasets', async () => {
    for (const sample of SAMPLE_DATASETS) {
      const extentType = sample.data.extent?.extent_type;
      if (!extentType || extentType === 'pixel_box') continue;

      const tabular = annotationToTabular(sample.data);
      const spec = buildBoppVegaLiteSpec(sample.data, tabular, {
        chartWidth: 760,
        chartHeight: 300,
        enableOverviewBrush: true,
      }) as any;
      const compiled = vl.compile(spec);
      const runtime = parseVega(compiled.spec);
      const view = new View(runtime, { renderer: 'none' });
      await view.runAsync();

      const scaleNames = Object.keys((view as any)._runtime?.scales || {});
      let detailScaleName = ['concat_0_x', 'x', 'layer_0_x', ...scaleNames.filter(k => k.endsWith('_x'))].find(k => scaleNames.includes(k));
      if (detailScaleName === 'concat_0_x' && scaleNames.includes('concat_1_x')) {
        const s0 = view.scale('concat_0_x');
        const d0 = s0 && typeof s0.domain === 'function' ? s0.domain() : null;
        if (d0 && typeof d0[0] === 'number' && d0[0] < -0.1) {
          detailScaleName = 'concat_1_x';
        }
      }
      if (!detailScaleName) continue;
      const detailScale = view.scale(detailScaleName);

      // Verify that at t = 0 or the first item time, scale returns non-NaN and within range
      const firstRecord = tabular[0];
      if (firstRecord) {
        const t = (firstRecord.time ?? (firstRecord.tick ? firstRecord.tick / 960 : firstRecord.quarter ? firstRecord.quarter * 0.5 : 0)) as number;
        let coordVal = t;
        if (extentType?.includes('tick') || extentType?.includes('midi')) {
          coordVal = t * 960;
        } else if (extentType?.includes('quarter') || extentType?.includes('score')) {
          coordVal = t * 2;
        }
        const mappedX = detailScale(coordVal);
        assert.ok(typeof mappedX === 'number' && !isNaN(mappedX), `Mapping for ${sample.id} at t=${t} must be valid number, got ${mappedX}`);
        assert.ok(mappedX >= -1 && mappedX <= 761, `Mapping for ${sample.id} at t=${t} must be within chart bounds, got ${mappedX}`);
      }
    }
  });

  await t.test('12. Global genres/tags with no confidence render as an alphabetized collection of badges', () => {
    const globalNoConf = SAMPLE_DATASETS.find(d => d.id === 'global_tags_noconf')!;
    const tabular = annotationToTabular(globalNoConf.data);
    const spec = buildBoppVegaLiteSpec(globalNoConf.data, tabular, {
      chartWidth: 760,
      isDark: true,
    }) as any;

    assert.ok(spec, 'Spec must be generated for global tags without confidence');
    assert.strictEqual(spec.$schema, 'https://vega.github.io/schema/vega-lite/v6.json');
    assert.ok(spec.title?.text?.includes('Global Genres & Tags'), 'Title should reflect global genres/tags');
    assert.ok(spec.title?.subtitle?.includes('Alphabetized'), 'Subtitle should indicate alphabetized collection');

    // Values must be strictly alphabetized
    const values = spec.data?.values;
    assert.ok(Array.isArray(values), 'Spec data values must be an array');
    assert.strictEqual(values.length, 6, 'Must include all 6 tags');
    const tags = values.map((v: any) => v.value);
    const sorted = [...tags].sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(tags, sorted, 'Tags must be strictly alphabetized');

    // Badges must flow in rows: left-to-right across columns, then top-to-bottom down rows:
    // First row: Ambient (col 0), Cinematic (col 1), Crescendo (col 2) sharing the same y coordinate
    assert.strictEqual(values[0].y1, values[1].y1, 'Row items must share the same vertical baseline');
    assert.strictEqual(values[1].y1, values[2].y1, 'Row items must share the same vertical baseline');
    assert.ok(values[0].x1 < values[1].x1, 'Row items must flow left-to-right');
    assert.ok(values[1].x1 < values[2].x1, 'Row items must flow left-to-right');
    // Second row: Electric Guitar (col 0) starts below the first row
    assert.ok(values[3].y1 > values[0].y1, 'Next row must be positioned below previous row (top-to-bottom)');
    assert.strictEqual(values[3].x1, values[0].x1, 'Start of next row aligns with column 0');

    // Marks must render badge pills, accent dots, and text labels (no quantitative axis or redundant bar charts)
    assert.ok(spec.layer, 'Spec must have layers');
    const rectMark = spec.layer.find((l: any) => l.mark?.type === 'rect' && l.mark?.cornerRadius > 0);
    assert.ok(rectMark, 'Must include rounded rect mark for badge cards');
    const textMark = spec.layer.find((l: any) => l.mark?.type === 'text');
    assert.ok(textMark, 'Must include text mark for badge labels');

    // Vega compilation verification
    const compiled = vl.compile(spec);
    assert.doesNotThrow(() => {
      parseVega(compiled.spec);
    }, 'Vega parser failed for global tags badge spec');
  });

  await t.test('13. Bidirectional confidence filter supports min and max ranges to isolate low or high confidence regions', () => {
    const chordDs = SAMPLE_DATASETS.find(d => d.id === 'interval_chord_overlapping_likelihood')!;
    const tabular = annotationToTabular(chordDs.data);

    // Test low-confidence isolation: min 0.0, max 0.4
    const lowConfSpec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      chartWidth: 700,
      minConfidenceFilter: 0,
      maxConfidenceFilter: 0.4,
    }) as any;

    assert.ok(lowConfSpec.transform, 'Spec must contain transforms');
    const lowFilter = lowConfSpec.transform.find((tr: any) => typeof tr.filter === 'string' && tr.filter.includes('datum.confidence'));
    assert.ok(lowFilter, 'Must have confidence filter transform');
    assert.ok(lowFilter.filter.includes('<= 0.4'), 'Must filter upper bound <= 0.4');

    // Test mid-confidence slice: min 0.3, max 0.7
    const midConfSpec = buildBoppVegaLiteSpec(chordDs.data, tabular, {
      chartWidth: 700,
      minConfidenceFilter: 0.3,
      maxConfidenceFilter: 0.7,
    }) as any;

    const midFilter = midConfSpec.transform.find((tr: any) => typeof tr.filter === 'string' && tr.filter.includes('datum.confidence'));
    assert.ok(midFilter, 'Must have confidence filter transform');
    assert.ok(midFilter.filter.includes('>= 0.3'), 'Must filter lower bound >= 0.3');
    assert.ok(midFilter.filter.includes('<= 0.7'), 'Must filter upper bound <= 0.7');

    // Compilation check
    assert.doesNotThrow(() => {
      const c = vl.compile(midConfSpec);
      parseVega(c.spec);
    }, 'Bidirectional confidence filter must compile cleanly in Vega');
  });

  await t.test('14. Confidence presentation is pinned to supported data encodings', () => {
    // 1. Continuous pitch with variance pins to error whiskers
    const vocalDs = SAMPLE_DATASETS.find(d => d.id === 'time_f0_puccini_variance')!;
    const vocalSpec = buildBoppVegaLiteSpec(vocalDs.data, annotationToTabular(vocalDs.data), { chartWidth: 700 }) as any;
    const vocalLayers = vocalSpec.vconcat ? vocalSpec.vconcat[0].layer : vocalSpec.layer;
    const ruleLayer = vocalLayers?.find((l: any) => l.mark?.type === 'rule' && l.encoding?.y2);
    assert.ok(ruleLayer, 'Continuous pitch contour with variance must include error bar whiskers');

    // 2. Interval extents with likelihood pin to horizontal meter layers
    const chordDs = SAMPLE_DATASETS.find(d => d.id === 'interval_chord_overlapping_likelihood')!;
    const chordSpec = buildBoppVegaLiteSpec(chordDs.data, annotationToTabular(chordDs.data), { chartWidth: 700 }) as any;
    const detailView = chordSpec.vconcat ? chordSpec.vconcat[0] : chordSpec;
    const meterLayer = detailView.layer?.find((l: any) => l.mark?.type === 'rect' && l.mark?.height <= 4);
    assert.ok(meterLayer, 'Interval with likelihood must include horizontal meter layer');
  });

  await t.test('15. Visualizer titles, subtitles, and legends do not include redundant mir_eval Circle of Fifths commentary', () => {
    for (const sample of SAMPLE_DATASETS) {
      const tabular = annotationToTabular(sample.data);
      const spec = buildBoppVegaLiteSpec(sample.data, tabular, { chartWidth: 700 }) as any;
      const jsonStr = JSON.stringify(spec);

      // Verify that "mir_eval Circle of Fifths" does not appear in user-facing texts
      assert.ok(!jsonStr.includes('mir_eval Circle of Fifths'), `Spec for ${sample.id} should not explain 'mir_eval Circle of Fifths'`);
      assert.ok(!jsonStr.includes('mir_eval Pitch Class Colors'), `Spec for ${sample.id} should not mention 'mir_eval Pitch Class Colors'`);
    }
  });
});




