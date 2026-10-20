import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';
import { annotationToTabular } from '../src/utils/boppParser';
import { buildBoppVegaLiteSpec } from '../src/utils/vegaLiteBuilder';

const ds = SAMPLE_DATASETS.find(d => d.id === 'spatial_bioacoustic_tf_likelihood')!;
const tabular = annotationToTabular(ds.data);
for (const isDark of [false, true]) {
  const spec = buildBoppVegaLiteSpec(ds.data, tabular, {
    chartWidth: 700,
    chartHeight: 300,
    isDark,
    enableOverviewBrush: true,
    confidenceChannel: 'meter',
  });
  console.log(`=== isDark=${isDark} ===`);
  console.log(JSON.stringify(spec, null, 2));
}
