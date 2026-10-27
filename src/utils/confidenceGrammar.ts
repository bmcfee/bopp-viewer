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
  showTextLabels?: boolean;
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
    showTextLabels = false,
  } = params;

  if (channelMode === 'none' || channelMode === 'opacity') {
    return [];
  }

  const layers: Record<string, unknown>[] = [];
  // Subtle backing track embedded within patch top edge: small and consistent with MIDI note style
  const trackBg = isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.25)';
  const trackBorder = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)';
  const mH = Math.min(meterHeight, 4);

  if (channelMode === 'meter') {
    layers.push(
      ...buildEmbeddedConfidenceMeterLayers({
        xField,
        endField,
        confX2Field: '_conf_meter_end',
        isDark,
        confidenceType,
        trackBackingFill: trackBg,
        cornerRadius: 1,
        yEncoding: { value: yTop },
        y2Encoding: { value: yTop + mH },
        markProps: {
          stroke: trackBorder,
          strokeWidth: 0.5,
        },
        activeMarkProps: {
          stroke: isDark ? '#ffffff' : '#09090b',
          strokeWidth: 0.5,
        },
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
      })
    );

    // 3. Agreement / Confidence Text Glyphs overlay for visible intervals (only if explicitly enabled to prevent cluttering patch tags)
    if (showTextLabels) {
      layers.push({
        transform: [
          { filter: `datum.confidence != null && (datum.${durField} == null || datum.${durField} >= 0.25)` },
          {
            calculate: `datum.${xField} + (datum.${durField} != null ? datum.${durField} / 2 : 0)`,
            as: '_badge_x_mid',
          },
          {
            calculate: confidenceType === 'agreement'
              ? "datum.agreement_ratio_str != null ? ((datum.num_annotators != null ? datum.num_annotators : datum.n_annotators) >= 10 ? '👥 ' + datum.agreement_ratio_str : '👤 ' + datum.agreement_ratio_str) : round(datum.confidence * 100) + '%'"
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
          limit: { expr: `max(0.001, (scale('concat_0_x', datum.${endField}) != null ? scale('concat_0_x', datum.${endField}) : scale('x', datum.${endField})) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField})) - 4)` },
        },
        encoding: {
          x: { field: '_badge_x_mid', type: 'quantitative' },
          y: { value: yTop },
          text: {
            condition: {
              test: `((scale('concat_0_x', datum.${endField}) != null ? scale('concat_0_x', datum.${endField}) : scale('x', datum.${endField})) - (scale('concat_0_x', datum.${xField}) != null ? scale('concat_0_x', datum.${xField}) : scale('x', datum.${xField}))) <= 16`,
              value: '',
            },
            field: '_badge_label',
            type: 'nominal',
          },
        },
      });
    }
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
          scale: getAchromaticConfidenceScale(isDark, 'pin'),
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
  showTextLabels?: boolean;
}): Record<string, unknown>[] {
  const {
    xField,
    chartHeight,
    isDark,
    confidenceType = 'likelihood',
    channelMode,
    yBaseline = chartHeight - 60,
    showTextLabels = false,
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
        strokeWidth: 1.5,
        strokeCap: 'round',
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { datum: yBaseline },
        y2: { field: '_pin_y_head', type: 'quantitative' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: getAchromaticConfidenceScale(isDark, 'pin'),
          legend: null,
        },
      },
    });

    // 2. Head circle of the confidence pin (point) - Sleek 32px point (approx 3.5px radius)
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
        size: 32,
        stroke: isDark ? '#000000' : '#ffffff',
        strokeWidth: 1,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        y: { field: '_pin_y_head', type: 'quantitative' },
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: getAchromaticConfidenceScale(isDark, 'pin'),
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

    // 3. Agreement / Percent label above the pin (only if explicitly enabled to prevent crowding)
    if (showTextLabels) {
      layers.push({
        transform: [
          { filter: 'datum.confidence != null' },
          {
            calculate: `${yBaseline} - ${maxHeight} * datum.confidence - 8`,
            as: '_pin_y_text',
          },
          {
            calculate: confidenceType === 'agreement'
              ? "datum.agreement_ratio_str != null ? ((datum.num_annotators != null ? datum.num_annotators : datum.n_annotators) >= 10 ? '👥 ' + datum.agreement_ratio_str : '👤 ' + datum.agreement_ratio_str) : round(datum.confidence * 100) + '%'"
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
  }

  return layers;
}

/**
 * Returns the standard zero-hue achromatic luminance scale for confidence / agreement rendering.
 */
export function getAchromaticConfidenceScale(
  isDark: boolean,
  variant: 'meter' | 'pin' = 'meter'
): { domain: number[]; range: string[] } {
  if (variant === 'pin') {
    return {
      domain: [0, 0.5, 0.8, 1.0],
      range: isDark
        ? ['#52525b', '#a1a1aa', '#e4e4e7', '#ffffff']
        : ['#a1a1aa', '#52525b', '#27272a', '#09090b'],
    };
  }
  return {
    domain: [0, 0.65, 0.85, 1.0],
    range: isDark
      ? ['#64748b', '#94a3b8', '#e2e8f0', '#ffffff']
      : ['#94a3b8', '#64748b', '#334155', '#0f172a'],
  };
}

export interface EmbeddedConfidenceMeterParams {
  xField: string;
  endField?: string;
  confX2Field?: string;
  isDark: boolean;
  confidenceType?: string;
  trackBackingFill?: string;
  cornerRadius?: number;
  extraTransforms?: Record<string, unknown>[];
  yEncoding: Record<string, unknown>;
  y2Encoding?: Record<string, unknown>;
  markProps?: Record<string, unknown>;
  activeMarkProps?: Record<string, unknown>;
  tooltip?: Record<string, unknown>[];
}

/**
 * Composable 2-layer embedded top-edge confidence meter (backing track + proportional achromatic fill).
 * Supports fixed pixel y/y2 bounds, nominal row y + yOffset, or quantitative y/y2 box bounds.
 */
export function buildEmbeddedConfidenceMeterLayers(
  params: EmbeddedConfidenceMeterParams
): Record<string, unknown>[] {
  const {
    xField,
    endField = '_calc_end',
    confX2Field = '_conf_x2',
    isDark,
    trackBackingFill,
    cornerRadius,
    extraTransforms = [],
    yEncoding,
    y2Encoding,
    markProps = {},
    activeMarkProps = {},
    tooltip,
  } = params;

  const backingFill = trackBackingFill ?? (isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.22)');

  return [
    {
      transform: [
        { filter: 'datum.confidence != null' },
        ...extraTransforms,
      ],
      mark: {
        type: 'rect',
        fill: backingFill,
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
        ...markProps,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: endField },
        y: yEncoding,
        ...(y2Encoding ? { y2: y2Encoding } : {}),
        ...(tooltip ? { tooltip } : {}),
      },
    },
    {
      transform: [
        { filter: 'datum.confidence != null' },
        ...extraTransforms,
        {
          calculate: `datum.${xField} + (datum.${endField} - datum.${xField}) * clamp(datum.confidence, 0, 1)`,
          as: confX2Field,
        },
      ],
      mark: {
        type: 'rect',
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
        ...markProps,
        ...activeMarkProps,
      },
      encoding: {
        x: { field: xField, type: 'quantitative' },
        x2: { field: confX2Field },
        y: yEncoding,
        ...(y2Encoding ? { y2: y2Encoding } : {}),
        color: {
          field: 'confidence',
          type: 'quantitative',
          scale: getAchromaticConfidenceScale(isDark, 'meter'),
          legend: null,
        },
        ...(tooltip ? { tooltip } : {}),
      },
    },
  ];
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
