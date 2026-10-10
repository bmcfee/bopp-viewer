/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BOPP Grammar of Graphics for Confidence Ratings
 * Modular visual encodings combining Confidence Types (Likelihood, Agreement, Variance)
 * with Extent Choices (Intervals, Instantaneous Points, Bounding Boxes, and Non-Extent/Global).
 */

import type { TabularRecord } from '../types/bopp';

export type ConfidenceChannelMode = 'meter' | 'height' | 'opacity' | 'none';

export interface ConfidenceGrammarConfig {
  channel?: ConfidenceChannelMode;
  theme?: 'light' | 'dark';
  chartHeight?: number;
}

/**
 * Returns human-readable person icon glyphs for agreement.
 * If nTotal is provided: e.g. 4 of 5 agreed -> 👤👤👤👤▫ (4/5, 80%)
 * If nTotal is not provided: calculates normalized 5-person consensus glyphs -> 👥 80% (●●●●○)
 */
export function getAgreementGlyph(
  confidence: number,
  nAnnotators?: number
): {
  iconString: string;
  badgeText: string;
  tooltipText: string;
} {
  const pct = Math.round(confidence * 100);

  if (typeof nAnnotators === 'number' && nAnnotators > 0) {
    const nAgree = Math.round(confidence * nAnnotators);
    const maxIcons = Math.min(nAnnotators, 8);
    const agreedIcons = Math.min(maxIcons, Math.round(confidence * maxIcons));
    const disagreeIcons = Math.max(0, maxIcons - agreedIcons);
    const icons = '👤'.repeat(agreedIcons) + '▫'.repeat(disagreeIcons);
    return {
      iconString: icons,
      badgeText: `${nAgree}/${nAnnotators} (${pct}%)`,
      tooltipText: `${nAgree} of ${nAnnotators} annotators agreed (${pct}%)`,
    };
  }

  // When n_annotators is not provided:
  const starCount = Math.max(0, Math.min(5, Math.round(confidence * 5)));
  const dots = '●'.repeat(starCount) + '○'.repeat(5 - starCount);
  return {
    iconString: `👥 ${dots}`,
    badgeText: `${pct}% consensus`,
    tooltipText: `${pct}% annotator consensus (N unspecified, ${starCount}/5 score)`,
  };
}

/**
 * Calibrated color for confidence ratings across all channels.
 */
export function getConfidenceColor(
  confidence: number,
  type: 'likelihood' | 'agreement' | 'variance' = 'likelihood'
): string {
  if (type === 'variance') {
    // For variance: lower variance means higher certainty (crisper)
    const std = Math.sqrt(Math.max(0, confidence));
    if (std <= 0.15) return '#10b981'; // Green: tight distribution
    if (std <= 0.35) return '#3b82f6'; // Blue: moderate distribution
    if (std <= 0.6) return '#f59e0b';  // Amber: broad uncertainty
    return '#ef4444';                  // Red: highly diffuse
  }

  if (type === 'agreement') {
    if (confidence >= 0.8) return '#10b981'; // Strong consensus
    if (confidence >= 0.6) return '#f59e0b'; // Moderate agreement
    return '#ef4444';                        // Disagreement / low consensus
  }

  // Likelihood (probability)
  if (confidence >= 0.85) return '#10b981'; // High
  if (confidence >= 0.65) return '#f59e0b'; // Medium
  return '#ef4444';                         // Low
}

/**
 * Builds Vega-Lite layers for Interval extents (time_interval, midi_interval, score_interval)
 * Overlays a horizontal confidence meter along the top edge of each rectangle patch,
 * compatible with variable-sized intervals and overlapping spans.
 */
export function buildIntervalConfidenceLayers(params: {
  xField: string;
  endField: string;
  durField: string;
  chartHeight: number;
  isDark: boolean;
  confidenceType?: 'likelihood' | 'agreement' | 'variance';
  channelMode: ConfidenceChannelMode;
  yTop?: number;
  yBottom?: number;
  meterHeight?: number;
}): Record<string, unknown>[] {
  const {
    xField,
    endField,
    durField,
    chartHeight,
    isDark,
    confidenceType = 'likelihood',
    channelMode,
    yTop = 0,
    yBottom = chartHeight - 60,
    meterHeight = 7,
  } = params;

  if (channelMode === 'none' || channelMode === 'opacity') {
    return [];
  }

  const layers: Record<string, unknown>[] = [];
  const trackBg = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(15, 23, 42, 0.25)';

  if (channelMode === 'meter') {
    // 1. Backing Meter Track along the top edge of each interval patch
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
      ],
      mark: {
        type: 'rect',
        fill: trackBg,
        stroke: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.25)',
        strokeWidth: 0.5,
        cornerRadius: 1.5,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: endField },
        y: { value: yTop },
        y2: { value: yTop + meterHeight },
        tooltip: [
          { field: 'value', type: 'nominal', title: 'Annotation' },
          { field: xField, type: 'quantitative', format: '.2f', title: 'Start' },
          { field: durField, type: 'quantitative', format: '.2f', title: 'Duration' },
          {
            field: 'confidence',
            type: 'quantitative',
            format: '.1%',
            title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence',
          },
          ...(confidenceType === 'agreement'
            ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }]
            : []),
        ],
      },
    });

    // 2. Active Confidence Fill Bar: spans [start, start + duration * confidence]
    layers.push({
      transform: [
        { filter: 'datum.confidence != null && datum.confidence > 0' },
        {
          calculate: `datum.${xField} + (datum.${durField} != null ? datum.${durField} * datum.confidence : 0)`,
          as: '_conf_meter_end',
        },
      ],
      mark: {
        type: 'rect',
        cornerRadius: 1.5,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: '_conf_meter_end' },
        y: { value: yTop + 1 },
        y2: { value: yTop + meterHeight - 1 },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.65, 0.85, 1.0],
            range: ['#ef4444', '#f59e0b', '#10b981', '#10b981'],
          },
          legend: null,
        },
        tooltip: [
          { field: 'value', type: 'nominal', title: 'Annotation' },
          {
            field: 'confidence',
            type: 'quantitative',
            format: '.1%',
            title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence',
          },
          ...(confidenceType === 'agreement'
            ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }]
            : []),
        ],
      },
    });

    // 3. Agreement / Confidence Icon Glyphs overlay for sufficiently wide intervals
    layers.push({
      transform: [
        { filter: `datum.confidence != null && (datum.${durField} != null && datum.${durField} >= 0.75)` },
        {
          calculate: `datum.${xField} + (datum.${durField} != null ? datum.${durField} / 2 : 0)`,
          as: '_badge_x_mid',
        },
        {
          calculate: confidenceType === 'agreement'
            ? "datum.agreement_ratio_str != null ? '👥 ' + datum.agreement_ratio_str : round(datum.confidence * 100) + '%'"
            : "round(datum.confidence * 100) + '%'",
          as: '_badge_label',
        },
      ],
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'top',
        dy: meterHeight + 2,
        fontSize: 9.5,
        fontWeight: 'bold',
        fill: isDark ? '#ffffff' : '#0f172a',
        font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        limit: { expr: `max(0, scale('x', datum.${endField}) - scale('x', datum.${xField}) - 6)` },
      },
      encoding: {
        x: { field: '_badge_x_mid', type: 'quantitative' },
        y: { value: yTop },
        text: { field: '_badge_label', type: 'nominal' },
      },
    });
  } else if (channelMode === 'height') {
    // Proportional Height Gauge: fills from bottom of interval block upwards by confidence ratio
    layers.push({
      transform: [
        { filter: 'datum.confidence != null && datum.confidence > 0' },
        {
          calculate: `${yBottom} - (${yBottom - yTop}) * datum.confidence`,
          as: '_conf_y_top',
        },
      ],
      mark: {
        type: 'rect',
        opacity: 0.35,
        cornerRadius: 2,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: endField },
        y: { field: '_conf_y_top' },
        y2: { value: yBottom },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.65, 0.85, 1.0],
            range: ['#ef4444', '#f59e0b', '#10b981', '#10b981'],
          },
          legend: null,
        },
      },
    });
  }

  return layers;
}

/**
 * Builds Vega-Lite layers for Instantaneous Point extents (time, midi_tick, score_quarter)
 * Renders:
 * - Likelihood & Agreement: Vertical confidence pin / lollipop marks with head node and consensus glyphs
 * - Variance: Vertical error bars with caps around continuous numerical payloads
 */
export function buildInstantaneousConfidenceLayers(params: {
  xField: string;
  chartHeight: number;
  isDark: boolean;
  confidenceType?: 'likelihood' | 'agreement' | 'variance';
  channelMode: ConfidenceChannelMode;
  yBaseline?: number;
}): Record<string, unknown>[] {
  const {
    xField,
    chartHeight,
    isDark,
    confidenceType = 'likelihood',
    channelMode,
    yBaseline = chartHeight - 60,
  } = params;

  if (channelMode === 'none') {
    return [];
  }

  const layers: Record<string, unknown>[] = [];
  const maxHeight = yBaseline - 40;

  if (confidenceType === 'likelihood' || confidenceType === 'agreement') {
    // 1. Stem of the confidence pin (rule)
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
        {
          calculate: `${yBaseline} - ${maxHeight} * datum.confidence`,
          as: '_pin_y_head',
        },
      ],
      mark: {
        type: 'rule',
        strokeWidth: 2,
        strokeCap: 'round',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { value: yBaseline },
        y2: { field: '_pin_y_head' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.65, 0.85, 1.0],
            range: ['#ef4444', '#f59e0b', '#10b981', '#10b981'],
          },
          legend: null,
        },
      },
    });

    // 2. Head circle of the confidence pin (point)
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
        {
          calculate: `${yBaseline} - ${maxHeight} * datum.confidence`,
          as: '_pin_y_head',
        },
      ],
      mark: {
        type: 'circle',
        size: 90,
        stroke: isDark ? '#0f172a' : '#ffffff',
        strokeWidth: 1.5,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: '_pin_y_head' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.65, 0.85, 1.0],
            range: ['#ef4444', '#f59e0b', '#10b981', '#10b981'],
          },
          legend: null,
        },
        tooltip: [
          { field: 'value', type: 'nominal', title: 'Value' },
          { field: xField, type: 'quantitative', format: '.3f', title: 'Position' },
          {
            field: 'confidence',
            type: 'quantitative',
            format: '.1%',
            title: confidenceType === 'agreement' ? 'Agreement' : 'Confidence',
          },
          ...(confidenceType === 'agreement'
            ? [{ field: 'agreement_text', type: 'nominal', title: 'Consensus' }]
            : []),
        ],
      },
    });

    // 3. Agreement / Percent label above the pin
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
        {
          calculate: `${yBaseline} - ${maxHeight} * datum.confidence - 8`,
          as: '_pin_y_text',
        },
        {
          calculate: confidenceType === 'agreement'
            ? "datum.agreement_ratio_str != null ? '👥 ' + datum.agreement_ratio_str : round(datum.confidence * 100) + '%'"
            : "round(datum.confidence * 100) + '%'",
          as: '_pin_label',
        },
      ],
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'bottom',
        fontSize: 9,
        fontWeight: 'bold',
        fill: isDark ? '#e2e8f0' : '#1e293b',
        font: 'ui-monospace, monospace',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: '_pin_y_text' },
        text: { field: '_pin_label', type: 'nominal' },
      },
    });
  }

  return layers;
}

/**
 * Builds Vega-Lite error-bar layers for Continuous Numerical Payloads with Variance.
 * Renders symmetric 95% Confidence Interval (±1.96σ) whiskers and shaded ribbons.
 */
export function buildVarianceErrorBarLayers(params: {
  xField: string;
  yField: string;
  isDark: boolean;
  capWidth?: number;
}): Record<string, unknown>[] {
  const { xField, yField, isDark, capWidth = 6 } = params;

  return [
    // Error Bar Whisker Rule: extends between value_ci_lower and value_ci_upper
    {
      transform: [
        { filter: 'datum.value_ci_lower != null && datum.value_ci_upper != null' },
      ],
      mark: {
        type: 'rule',
        stroke: isDark ? '#38bdf8' : '#0284c7',
        strokeWidth: 2,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: 'value_ci_lower', type: 'quantitative' },
        y2: { field: 'value_ci_upper' },
        tooltip: [
          { field: xField, type: 'quantitative', format: '.2f', title: 'Time' },
          { field: yField, type: 'quantitative', format: '.3f', title: 'Value' },
          { field: 'confidence_variance', type: 'quantitative', format: '.4f', title: 'Variance (σ²)' },
          { field: 'confidence_std', type: 'quantitative', format: '.3f', title: 'Std Dev (σ)' },
          { field: 'value_ci_lower', type: 'quantitative', format: '.3f', title: '95% CI Lower' },
          { field: 'value_ci_upper', type: 'quantitative', format: '.3f', title: '95% CI Upper' },
        ],
      },
    },
    // Top Error Bar Cap Tick
    {
      transform: [
        { filter: 'datum.value_ci_upper != null' },
      ],
      mark: {
        type: 'tick',
        color: isDark ? '#38bdf8' : '#0284c7',
        thickness: 2,
        size: capWidth,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: 'value_ci_upper', type: 'quantitative' },
      },
    },
    // Bottom Error Bar Cap Tick
    {
      transform: [
        { filter: 'datum.value_ci_lower != null' },
      ],
      mark: {
        type: 'tick',
        color: isDark ? '#38bdf8' : '#0284c7',
        thickness: 2,
        size: capWidth,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: 'value_ci_lower', type: 'quantitative' },
      },
    },
  ];
}
