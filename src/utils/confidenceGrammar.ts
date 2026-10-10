/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BOPP Grammar of Graphics for Confidence Ratings
 * Modular visual encodings combining Confidence Types (Likelihood, Agreement, Variance)
 * with Extent Choices (Intervals, Instantaneous Points, Bounding Boxes, and Non-Extent/Global).
 * 
 * Achromatic (No-Hue) Design:
 * Uses pure neutral grayscale / luminance encodings so confidence overlays never compete with
 * or confuse categorical color mappings (such as Circle of Fifths chord hues, pitch contours, or structural labels).
 * - Dark theme: Bright White (#ffffff) / Silver (#cbd5e1) / Slate Gray (#64748b)
 * - Light theme: Deep Charcoal (#0f172a) / Medium Slate (#475569) / Light Slate (#94a3b8)
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
 * If nTotal is provided:
 * - For small groups (e.g. 5): 👤👤👤👤▫ (4/5, 80%)
 * - For crowds (e.g. 20-25): 👥 19/20 (95% crowd consensus)
 * If nTotal is not provided:
 * - Normalizes to 5-person consensus glyph: 👥 80% (●●●●○)
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
    if (nAnnotators >= 10) {
      // Crowd agreement display for large pools (crowd-sourcing: MTurk / Prolific / study)
      return {
        iconString: `👥 ${nAgree}/${nAnnotators}`,
        badgeText: `${nAgree}/${nAnnotators} (${pct}% crowd)`,
        tooltipText: `Crowd consensus: ${nAgree} of ${nAnnotators} independent annotators agreed (${pct}%)`,
      };
    }
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
 * Calibrated achromatic (no-hue) color for confidence ratings across all channels.
 * Completely free of chromatic hue so it never clashes with chord or segment palettes.
 */
export function getConfidenceColor(
  confidence: number,
  type: 'likelihood' | 'agreement' | 'variance' = 'likelihood',
  isDark = true
): string {
  if (isDark) {
    if (type === 'variance') {
      const std = Math.sqrt(Math.max(0, confidence));
      if (std <= 0.15) return '#ffffff'; // Tight certainty: bright white
      if (std <= 0.35) return '#e2e8f0'; // Silver
      if (std <= 0.6) return '#94a3b8';  // Slate
      return '#64748b';                  // Diffuse: dim slate
    }
    if (confidence >= 0.85) return '#ffffff';
    if (confidence >= 0.65) return '#cbd5e1';
    return '#64748b';
  } else {
    if (type === 'variance') {
      const std = Math.sqrt(Math.max(0, confidence));
      if (std <= 0.15) return '#0f172a'; // Tight certainty: solid dark
      if (std <= 0.35) return '#334155'; // Charcoal
      if (std <= 0.6) return '#64748b';  // Slate
      return '#94a3b8';                  // Diffuse: light slate
    }
    if (confidence >= 0.85) return '#0f172a';
    if (confidence >= 0.65) return '#475569';
    return '#94a3b8';
  }
}

/**
 * Builds Vega-Lite layers for Interval extents (time_interval, midi_interval, score_interval)
 * Overlays a prominent horizontal confidence meter along the top edge of each rectangle patch,
 * styled with NO HUE (pure neutral white/charcoal and grayscale luminosity).
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
    yTop = 8,
    yBottom = chartHeight - 60,
    meterHeight = 12,
  } = params;

  if (channelMode === 'none' || channelMode === 'opacity') {
    return [];
  }

  const layers: Record<string, unknown>[] = [];
  // Achromatic container capsule: pure black background on dark theme, pure white on light theme
  const trackBg = isDark ? '#000000' : '#ffffff';
  const trackBorder = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.60)';

  if (channelMode === 'meter') {
    // 1. Backing Meter Track along the top edge of each interval patch
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
      ],
      mark: {
        type: 'rect',
        fill: trackBg,
        stroke: trackBorder,
        strokeWidth: 1.2,
        cornerRadius: 3,
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

    // 2. Active Confidence Fill Bar (NO HUE: pure luminance scale from slate to white/charcoal)
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
        cornerRadius: 2,
        stroke: isDark ? '#ffffff' : '#09090b',
        strokeWidth: 0.5,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: '_conf_meter_end' },
        y: { value: yTop + 2 },
        y2: { value: yTop + meterHeight - 2 },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.5, 0.8, 1.0],
            range: isDark
              ? ['#52525b', '#a1a1aa', '#e4e4e7', '#ffffff']
              : ['#a1a1aa', '#52525b', '#27272a', '#09090b'],
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

    // 3. Agreement / Confidence Text Glyphs overlay for visible intervals
    layers.push({
      transform: [
        { filter: `datum.confidence != null && (datum.${durField} == null || datum.${durField} >= 0.25)` },
        {
          calculate: `datum.${xField} + (datum.${durField} != null ? datum.${durField} / 2 : 0)`,
          as: '_badge_x_mid',
        },
        {
          calculate: confidenceType === 'agreement'
            ? "datum.agreement_ratio_str != null ? (datum.n_annotators >= 10 ? '👥 ' + datum.agreement_ratio_str : '👤 ' + datum.agreement_ratio_str) : round(datum.confidence * 100) + '%'"
            : "round(datum.confidence * 100) + '%'",
          as: '_badge_label',
        },
      ],
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'top',
        dy: meterHeight + 3,
        fontSize: 10,
        fontWeight: 'bold',
        fill: isDark ? '#ffffff' : '#09090b',
        font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        clip: true,
      },
      encoding: {
        x: { field: '_badge_x_mid', type: 'quantitative' },
        y: { value: yTop },
        text: { field: '_badge_label', type: 'nominal' },
      },
    });
  } else if (channelMode === 'height') {
    // Proportional Height Gauge: fills from bottom of interval block upwards by confidence ratio (Achromatic)
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
        y: { field: '_conf_y_top', type: 'quantitative' },
        y2: { datum: yBottom },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.5, 0.8, 1.0],
            range: isDark
              ? ['#52525b', '#a1a1aa', '#e4e4e7', '#ffffff']
              : ['#a1a1aa', '#52525b', '#27272a', '#09090b'],
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
        ],
      },
    });
  }

  return layers;
}

/**
 * Builds Vega-Lite layers for Instantaneous Point extents (time, midi_tick, score_quarter)
 * Encodes confidence using achromatic lollipop confidence pins (stem rule + head circle + label).
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

  if (channelMode === 'none' || channelMode === 'opacity') {
    return [];
  }

  const layers: Record<string, unknown>[] = [];
  const maxHeight = yBaseline - 40;

  if (confidenceType === 'likelihood' || confidenceType === 'agreement') {
    // 1. Stem of the confidence pin (rule) - Achromatic
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
        y: { datum: yBaseline },
        y2: { field: '_pin_y_head', type: 'quantitative' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.5, 0.8, 1.0],
            range: isDark
              ? ['#52525b', '#a1a1aa', '#e4e4e7', '#ffffff']
              : ['#a1a1aa', '#52525b', '#27272a', '#09090b'],
          },
          legend: null,
        },
      },
    });

    // 2. Head circle of the confidence pin (point) - Achromatic
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
        stroke: isDark ? '#000000' : '#ffffff',
        strokeWidth: 1.5,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: '_pin_y_head', type: 'quantitative' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: {
            domain: [0, 0.5, 0.8, 1.0],
            range: isDark
              ? ['#52525b', '#a1a1aa', '#e4e4e7', '#ffffff']
              : ['#a1a1aa', '#52525b', '#27272a', '#09090b'],
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

    // 3. Agreement / Percent label above the pin (Achromatic text)
    layers.push({
      transform: [
        { filter: 'datum.confidence != null' },
        {
          calculate: `${yBaseline} - ${maxHeight} * datum.confidence - 8`,
          as: '_pin_y_text',
        },
        {
          calculate: confidenceType === 'agreement'
            ? "datum.agreement_ratio_str != null ? (datum.n_annotators >= 10 ? '👥 ' + datum.agreement_ratio_str : '👤 ' + datum.agreement_ratio_str) : round(datum.confidence * 100) + '%'"
            : "round(datum.confidence * 100) + '%'",
          as: '_pin_label',
        },
      ],
      mark: {
        type: 'text',
        align: 'center',
        baseline: 'bottom',
        fontSize: 9.5,
        fontWeight: 'bold',
        fill: isDark ? '#ffffff' : '#0f172a',
        font: 'ui-monospace, monospace',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: '_pin_y_text', type: 'quantitative' },
        text: { field: '_pin_label', type: 'nominal' },
      },
    });
  }

  return layers;
}

/**
 * Builds Vega-Lite error-bar layers for Continuous Numerical Payloads with Variance.
 * Renders symmetric 95% Confidence Interval (±1.96σ) whiskers and horizontal caps
 * using clean, achromatic (no-hue) styling.
 */
export function buildVarianceErrorBarLayers(params: {
  xField: string;
  yField?: string;
  lowerField?: string;
  upperField?: string;
  isDark: boolean;
  capWidth?: number;
  whiskerColor?: string;
}): Record<string, unknown>[] {
  const {
    xField,
    yField = 'value',
    lowerField = 'value_ci_lower',
    upperField = 'value_ci_upper',
    isDark,
    capWidth = 8,
    whiskerColor,
  } = params;

  // Default to pure achromatic: white in dark theme, dark charcoal in light theme
  const color = whiskerColor ?? (isDark ? '#ffffff' : '#0f172a');

  return [
    // Error Bar Whisker Rule: extends between lowerField and upperField
    {
      transform: [
        { filter: `datum.${lowerField} != null && datum.${upperField} != null` },
      ],
      mark: {
        type: 'rule',
        stroke: color,
        strokeWidth: 2,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: lowerField, type: 'quantitative', scale: { zero: false } },
        y2: { field: upperField },
        tooltip: [
          { field: xField, type: 'quantitative', format: '.3f', title: 'Time (s)' },
          { field: yField, type: 'quantitative', format: '.2f', title: 'Value' },
          { field: 'confidence_variance', type: 'quantitative', format: '.3f', title: 'Variance (σ²)' },
          { field: 'confidence_std', type: 'quantitative', format: '.3f', title: 'Std Dev (σ)' },
          { field: lowerField, type: 'quantitative', format: '.2f', title: '95% CI Lower' },
          { field: upperField, type: 'quantitative', format: '.2f', title: '95% CI Upper' },
        ],
      },
    },
    // Top Error Bar Cap Tick
    {
      transform: [
        { filter: `datum.${upperField} != null` },
      ],
      mark: {
        type: 'tick',
        color: color,
        thickness: 2,
        size: capWidth,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: upperField, type: 'quantitative', scale: { zero: false } },
      },
    },
    // Bottom Error Bar Cap Tick
    {
      transform: [
        { filter: `datum.${lowerField} != null` },
      ],
      mark: {
        type: 'tick',
        color: color,
        thickness: 2,
        size: capWidth,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: lowerField, type: 'quantitative', scale: { zero: false } },
      },
    },
  ];
}
