/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab MIME Renderer for BOPP (Bounded Observation Payload Protocol)
 * Captures 'application/vnd.bopp+json', 'application/vnd.bopp+msgpack', and 'application/vnd.bopp'
 * mime-coded output from Python objects implementing _repr_mimebundle_().
 */

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Widget } from '@lumino/widgets';
import { IThemeManager } from '@jupyterlab/apputils';
import embed, { Result as VegaEmbedResult } from 'vega-embed';
import {
  parseBoppJson,
  parseBoppMsgpack,
  annotationToTabular,
  exportToBoppCsv,
} from '../utils/boppParser';
import { buildBoppVegaLiteSpec } from '../utils/vegaLiteBuilder';
import { validateBoppAnnotation } from '../utils/schemaValidator';
import type { BoppAnnotation } from '../types/bopp';

export const BOPP_MIME_TYPES = [
  'application/vnd.bopp+json',
  'application/vnd.bopp+msgpack',
  'application/vnd.bopp',
] as const;

export type BoppMimeType = typeof BOPP_MIME_TYPES[number];

/**
 * Renderer widget displaying BOPP mime data inside notebook cell outputs.
 */
export class BOPPMimeRenderer extends Widget implements IRenderMime.IRenderer {
  private _mimeType: string;
  private _themeManager: IThemeManager | null;
  private _containerNode: HTMLDivElement;
  private _cachedAnnotation: BoppAnnotation | null = null;
  private _activeTab: 'visualizer' | 'table' | 'raw' = 'visualizer';
  private _vegaResult: VegaEmbedResult | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  constructor(options: IRenderMime.IRendererOptions, themeManager: IThemeManager | null = null) {
    super();
    this._mimeType = options.mimeType;
    this._themeManager = themeManager;
    this.addClass('jp-BOPPMimeRenderer');

    this._containerNode = document.createElement('div');
    this._containerNode.className = 'jp-BOPP-mime-root';
    this.node.appendChild(this._containerNode);

    if (this._themeManager) {
      this._themeManager.themeChanged.connect(this._onThemeChanged, this);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    if (this._themeManager) {
      this._themeManager.themeChanged.disconnect(this._onThemeChanged, this);
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._vegaResult) {
      this._vegaResult.finalize();
      this._vegaResult = null;
    }
    super.dispose();
  }

  private _onThemeChanged(): void {
    if (this._cachedAnnotation) {
      this._renderUI(this._cachedAnnotation, this._isDark());
    }
  }

  private _isDark(): boolean {
    if (this._themeManager && this._themeManager.theme) {
      return this._themeManager.isLight(this._themeManager.theme) === false;
    }
    return (
      document.body.classList.contains('jp-theme-dark') ||
      document.documentElement.classList.contains('dark')
    );
  }

  /**
   * Render a mime model from Python _repr_mimebundle_().
   */
  public async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const isDark = this._isDark();
    this._containerNode.setAttribute('data-theme', isDark ? 'dark' : 'light');

    try {
      const annotation = this._extractAnnotation(model);
      this._cachedAnnotation = annotation;
      this._renderUI(annotation, isDark);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._containerNode.innerHTML = `
        <div style="padding: 14px 18px; font-family: system-ui, sans-serif; color: #ef4444; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; margin: 4px 0;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">Failed to render BOPP MIME data (${this._mimeType})</div>
          <pre style="margin: 0; font-size: 11px; white-space: pre-wrap; font-family: monospace;">${msg}</pre>
        </div>
      `;
    }
  }

  /**
   * Parse either JSON or MessagePack payload from the model mimebundle.
   */
  private _extractAnnotation(model: IRenderMime.IMimeModel): BoppAnnotation {
    const data = model.data;
    const raw =
      data[this._mimeType] ??
      data['application/vnd.bopp+json'] ??
      data['application/vnd.bopp+msgpack'] ??
      data['application/vnd.bopp'];

    if (!raw) {
      throw new Error(`No BOPP data found under mime types: ${BOPP_MIME_TYPES.join(', ')}`);
    }

    // 1. MessagePack Binary or Base64 payload
    if (this._mimeType === 'application/vnd.bopp+msgpack') {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        // Check if string is base64 encoded bytes
        try {
          const binaryStr = atob(trimmed);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return parseBoppMsgpack(bytes);
        } catch {
          // If not base64, try UTF-8 text encoder fallback
          const encoder = new TextEncoder();
          return parseBoppMsgpack(encoder.encode(trimmed));
        }
      }
      if (raw instanceof Uint8Array) {
        return parseBoppMsgpack(raw);
      }
      if (raw instanceof ArrayBuffer) {
        return parseBoppMsgpack(new Uint8Array(raw));
      }
      if (typeof raw === 'object' && raw !== null) {
        // Node Buffer serialized JSON format { type: 'Buffer', data: [...] }
        const maybeBuf = raw as { type?: string; data?: number[] };
        if (maybeBuf.type === 'Buffer' && Array.isArray(maybeBuf.data)) {
          return parseBoppMsgpack(new Uint8Array(maybeBuf.data));
        }
        return raw as unknown as BoppAnnotation;
      }
    }

    // 2. JSON or Generic Object payload
    if (typeof raw === 'string') {
      return parseBoppJson(raw);
    }
    if (typeof raw === 'object' && raw !== null) {
      return raw as unknown as BoppAnnotation;
    }

    throw new Error(`Unsupported BOPP data format: ${typeof raw}`);
  }

  private _renderUI(annotation: BoppAnnotation, isDark: boolean): void {
    if (this._vegaResult) {
      this._vegaResult.finalize();
      this._vegaResult = null;
    }

    const tabular = annotationToTabular(annotation);
    const validation = validateBoppAnnotation(annotation);
    const extentType = annotation.extent?.extent_type ?? 'none';
    const payloadType = annotation.payload?.payload_type ?? 'unknown';
    const confidenceType = annotation.confidence?.confidence_type ?? 'none';

    const bg = isDark ? '#18181b' : '#ffffff';
    const fg = isDark ? '#f4f4f5' : '#0f172a';
    const border = isDark ? '#27272a' : '#e4e4e7';
    const headerBg = isDark ? '#202024' : '#f8fafc';
    const badgeBg = isDark ? '#27272a' : '#f1f5f9';
    const badgeFg = isDark ? '#94a3b8' : '#475569';
    const activeTabBg = isDark ? '#27272a' : '#ffffff';

    this._containerNode.style.display = 'flex';
    this._containerNode.style.flexDirection = 'column';
    this._containerNode.style.width = '100%';
    this._containerNode.style.background = bg;
    this._containerNode.style.color = fg;
    this._containerNode.style.border = `1px solid ${border}`;
    this._containerNode.style.borderRadius = '8px';
    this._containerNode.style.overflow = 'hidden';
    this._containerNode.style.margin = '6px 0';
    this._containerNode.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // 1. Header Toolbar
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '8px 12px';
    header.style.background = headerBg;
    header.style.borderBottom = `1px solid ${border}`;
    header.style.fontSize = '12px';

    // Left info badges
    const leftBadges = document.createElement('div');
    leftBadges.style.display = 'flex';
    leftBadges.style.alignItems = 'center';
    leftBadges.style.gap = '6px';
    leftBadges.style.flexWrap = 'wrap';

    leftBadges.innerHTML = `
      <span style="font-weight: 700; color: #2563eb; background: rgba(37,99,235,0.12); padding: 2px 7px; border-radius: 4px; font-size: 11px;">BOPP</span>
      <span style="font-family: monospace; font-weight: 600; color: ${fg}; font-size: 11px;" title="${annotation.media_id}">${annotation.media_id}</span>
      <span style="background: ${badgeBg}; color: ${badgeFg}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: monospace;">${extentType}</span>
      <span style="background: rgba(37,99,235,0.1); color: #2563eb; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: monospace;">${payloadType}</span>
      ${
        confidenceType !== 'none'
          ? `<span style="background: ${badgeBg}; color: ${badgeFg}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: monospace;">${confidenceType}</span>`
          : ''
      }
      ${
        !validation.isValid
          ? `<span style="background: rgba(239,68,68,0.12); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">Invalid Schema (${validation.checksSummary.errors})</span>`
          : ''
      }
    `;
    header.appendChild(leftBadges);

    // Right Tabs (Plot / Table / JSON)
    const rightTabs = document.createElement('div');
    rightTabs.style.display = 'flex';
    rightTabs.style.gap = '2px';
    rightTabs.style.background = badgeBg;
    rightTabs.style.padding = '2px';
    rightTabs.style.borderRadius = '5px';

    const tabs: Array<{ id: 'visualizer' | 'table' | 'raw'; label: string }> = [
      { id: 'visualizer', label: 'Plot' },
      { id: 'table', label: 'Table' },
      { id: 'raw', label: 'JSON' },
    ];

    tabs.forEach(t => {
      const btn = document.createElement('button');
      btn.innerText = t.label;
      const isActive = this._activeTab === t.id;
      btn.style.border = 'none';
      btn.style.background = isActive ? activeTabBg : 'transparent';
      btn.style.color = isActive ? fg : badgeFg;
      btn.style.fontWeight = isActive ? '600' : 'normal';
      btn.style.padding = '3px 10px';
      btn.style.borderRadius = '4px';
      btn.style.fontSize = '11px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 0.15s ease';
      btn.onclick = () => {
        this._activeTab = t.id;
        this._renderUI(annotation, isDark);
      };
      rightTabs.appendChild(btn);
    });
    header.appendChild(rightTabs);

    this._containerNode.innerHTML = '';
    this._containerNode.appendChild(header);

    // 2. Main Content Body
    const bodyContainer = document.createElement('div');
    bodyContainer.style.padding = '12px';
    bodyContainer.style.overflow = 'auto';
    this._containerNode.appendChild(bodyContainer);

    if (this._activeTab === 'visualizer') {
      const vizTarget = document.createElement('div');
      vizTarget.style.width = '100%';
      vizTarget.style.minHeight = '280px';
      vizTarget.style.display = 'flex';
      vizTarget.style.justifyContent = 'center';
      bodyContainer.appendChild(vizTarget);

      const renderViz = () => {
        const availableW = this._containerNode.clientWidth;
        const chartWidth = Math.max(320, Math.min(840, (availableW > 0 ? availableW : 720) - 48));

        const spec = buildBoppVegaLiteSpec(annotation, tabular, {
          theme: isDark ? 'dark' : 'light',
          chartWidth,
          chartHeight: 280,
          showLabels: true,
          enableZoomPan: true,
        });

        vizTarget.innerHTML = '';
        embed(vizTarget, spec as unknown as any, {
          actions: { export: true, source: false, compiled: false, editor: false },
          renderer: 'canvas',
          hover: true,
          tooltip: true,
        })
          .then(res => {
            this._vegaResult = res;
          })
          .catch(err => {
            vizTarget.innerHTML = `<div style="color: #ef4444; font-size: 12px; padding: 12px;">Vega render error: ${err?.message || err}</div>`;
          });
      };

      renderViz();

      // Setup dynamic ResizeObserver
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
      }
      let prevWidth = this._containerNode.clientWidth;
      this._resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const newW = entry.contentRect.width;
          if (Math.abs(newW - prevWidth) >= 32) {
            prevWidth = newW;
            renderViz();
          }
        }
      });
      this._resizeObserver.observe(this._containerNode);
    } else if (this._activeTab === 'table') {
      const tableWrapper = document.createElement('div');
      tableWrapper.style.maxHeight = '320px';
      tableWrapper.style.overflow = 'auto';
      tableWrapper.style.border = `1px solid ${border}`;
      tableWrapper.style.borderRadius = '6px';

      const columns = tabular.length > 0 ? Object.keys(tabular[0]).filter(k => k !== '__index') : [];
      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: monospace;">
          <thead>
            <tr style="background: ${headerBg}; position: sticky; top: 0;">
              <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid ${border};">#</th>
              ${columns.map(c => `<th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid ${border};">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;

      tabular.slice(0, 100).forEach((row, idx) => {
        const rowBg = idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)');
        tableHtml += `<tr style="background: ${rowBg}; border-bottom: 1px solid ${border};">`;
        tableHtml += `<td style="padding: 5px 10px; color: ${badgeFg};">${idx + 1}</td>`;
        columns.forEach(c => {
          const val = row[c];
          const display = typeof val === 'number' ? val.toFixed(3).replace(/\.?0+$/, '') : String(val ?? '');
          tableHtml += `<td style="padding: 5px 10px;">${display}</td>`;
        });
        tableHtml += `</tr>`;
      });

      tableHtml += `</tbody></table>`;
      tableWrapper.innerHTML = tableHtml;
      bodyContainer.appendChild(tableWrapper);

      const countMsg = document.createElement('div');
      countMsg.style.fontSize = '10px';
      countMsg.style.color = badgeFg;
      countMsg.style.marginTop = '6px';
      countMsg.innerText = `Showing ${Math.min(100, tabular.length)} of ${tabular.length} observations`;
      bodyContainer.appendChild(countMsg);
    } else if (this._activeTab === 'raw') {
      const pre = document.createElement('pre');
      pre.style.margin = '0';
      pre.style.padding = '12px';
      pre.style.background = isDark ? '#111113' : '#f8fafc';
      pre.style.border = `1px solid ${border}`;
      pre.style.borderRadius = '6px';
      pre.style.fontSize = '11px';
      pre.style.fontFamily = 'ui-monospace, monospace';
      pre.style.maxHeight = '320px';
      pre.style.overflow = 'auto';
      pre.innerText = JSON.stringify(annotation, null, 2);
      bodyContainer.appendChild(pre);
    }

    // 3. Footer metadata bar
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';
    footer.style.padding = '6px 12px';
    footer.style.background = headerBg;
    footer.style.borderTop = `1px solid ${border}`;
    footer.style.fontSize = '10px';
    footer.style.color = badgeFg;

    const desc = annotation.metadata?.description || '';
    footer.innerHTML = `
      <span style="font-family: monospace;">${tabular.length} observations · BOPP v${annotation.bopp_version || '1.0'}</span>
      <span style="truncate; max-width: 60%;" title="${desc}">${desc ? desc : 'Interactive BOPP Visualization'}</span>
    `;
    this._containerNode.appendChild(footer);
  }
}

/**
 * Creates the renderer factory for IRenderMimeRegistry.addFactory()
 */
export function createBOPPRendererFactory(
  themeManager: IThemeManager | null = null
): IRenderMime.IRendererFactory {
  return {
    safe: true,
    mimeTypes: [...BOPP_MIME_TYPES],
    defaultRank: 0,
    createRenderer: (options: IRenderMime.IRendererOptions) => {
      return new BOPPMimeRenderer(options, themeManager);
    },
  };
}
