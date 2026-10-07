import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import { annotationToTabular } from '../src/utils/boppParser';
import { buildBoppVegaLiteSpec } from '../src/utils/vegaLiteBuilder';
import * as vl from 'vega-lite';
import * as vega from 'vega';

async function main() {
  const ds = SAMPLE_DATASETS.find(d => d.id === 'drive_bopp')!;
  const tabular = annotationToTabular(ds.data);
  const spec: any = buildBoppVegaLiteSpec(ds.data, tabular, {
    chartWidth: 700,
    chartHeight: 300,
    theme: 'dark',
  });

  // Try adding value to brush param
  if (spec.vconcat && spec.vconcat[1] && spec.vconcat[1].params) {
    spec.vconcat[1].params[0].value = { x: [0, 115] };
  }

  const compiled = vl.compile(spec as any);
  const runtime = vega.parse(compiled.spec);
  const view = new vega.View(runtime, { renderer: 'none' });
  await view.runAsync();
  console.log('SUCCESS with value!');
}

main().catch(err => console.error('FAILED with value:', err));





