/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab DocumentWidget for BOPP (Bounded Observation Payload Protocol)
 */

import { DocumentWidget, DocumentRegistry, ABCWidgetFactory } from '@jupyterlab/docregistry';
import { Widget } from '@lumino/widgets';
import { IThemeManager } from '@jupyterlab/apputils';
import embed from 'vega-embed';
import {
  parseBoppJson,
  parseBoppMsgpack,
  annotationToTabular,
  exportToBoppCsv
} from '../utils/boppParser';
import { buildBoppVegaLiteSpec } from '../utils/vegaLiteBuilder';
import { validateBoppAnnotation } from '../utils/schemaValidator';
import type { BoppAnnotation } from '../types/bopp';

export class BOPPWidget extends DocumentWidget<Widget> {
  private _themeManager: IThemeManager | null;
  private _activeTab: 'visualizer' | 'table' | 'raw' | 'validation' = 'visualizer';
  private _cachedAnnotation: BoppAnnotation | null = null;
  private _containerNode: HTMLDivElement;

  constructor(context: DocumentRegistry.Context, themeManager: IThemeManager | null) {
    const content = new Widget();
    content.addClass('jp-BOPPViewer');
    super({ context, content });

    this._themeManager = themeManager;
    this._containerNode = document.createElement('div');
    this._containerNode.className = 'jp-BOPP-root';
    this.content.node.appendChild(this._containerNode);

    void context.ready.then(() => {
      this.render();
    });

    context.model.contentChanged.connect(this.render, this);
    if (this._themeManager) {
      this._themeManager.themeChanged.connect(this.render, this);
    }
  }

  private _isDark(): boolean {
    if (this._themeManager && this._themeManager.theme) {
      return this._themeManager.isLight(this._themeManager.theme) === false;
    }
    return document.body.classList.contains('jp-theme-dark') ||
           document.documentElement.classList.contains('dark');
  }

  public render(): void {
    const isDark = this._isDark();
    this._containerNode.setAttribute('data-theme', isDark ? 'dark' : 'light');

    try {
      const model = this.context.model;
      const path = this.context.path.toLowerCase();
      let annotation: BoppAnnotation;

      if (path.endsWith('.msgpack') || path.endsWith('.bin')) {
        const rawContent = model.toString();
        // In JupyterLab base64 models, content is base64-encoded string
        try {
          const binaryStr = atob(rawContent.trim());
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          annotation = parseBoppMsgpack(bytes);
        } catch {
          // Fallback if model was read as UTF-8
          const encoder = new TextEncoder();
          annotation = parseBoppMsgpack(encoder.encode(rawContent));
        }
      } else {
        annotation = parseBoppJson(model.toString());
      }

      this._cachedAnnotation = annotation;
      this._renderUI(annotation, isDark);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._containerNode.innerHTML = `
        <div style="padding: 24px; font-family: system-ui, sans-serif; color: #dc2626;">
          <h3 style="margin-top: 0; font-size: 16px;">Failed to parse BOPP document</h3>
          <p style="font-size: 13px; color: #64748b;">${this.context.path}</p>
          <pre style="background: rgba(0,0,0,0.06); padding: 12px; border-radius: 6px; font-size: 12px; overflow: auto;">${msg}</pre>
        </div>
      `;
    }
  }

  private _renderUI(annotation: BoppAnnotation, isDark: boolean): void {
    const tabular = annotationToTabular(annotation);
    const validation = validateBoppAnnotation(annotation);
    const extentType = annotation.extent?.extent_type ?? 'none';
    const payloadType = annotation.payload?.payload_type ?? 'unknown';
    const confidenceType = annotation.confidence?.confidence_type ?? 'none';

    const bg = isDark ? '#18181b' : '#ffffff';
    const fg = isDark ? '#f4f4f5' : '#18181b';
    const border = isDark ? '#27272a' : '#e4e4e7';
    const headerBg = isDark ? '#202024' : '#f8fafc';
    const activeTabBg = isDark ? '#27272a' : '#ffffff';

    this._containerNode.style.display = 'flex';
    this._containerNode.style.flexDirection = 'column';
    this._containerNode.style.height = '100%';
    this._containerNode.style.width = '100%';
    this._containerNode.style.background = bg;
    this._containerNode.style.color = fg;
    this._containerNode.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Build Toolbar Header
    const toolbar = document.createElement('div');
    toolbar.style.padding = '8px 16px';
    toolbar.style.borderBottom = `1px solid ${border}`;
    toolbar.style.background = headerBg;
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.flexWrap = 'wrap';
    toolbar.style.gap = '8px';

    // Left info
    const leftInfo = document.createElement('div');
    leftInfo.style.display = 'flex';
    leftInfo.style.alignItems = 'center';
    leftInfo.style.gap = '8px';
    leftInfo.innerHTML = `
      <span style="font-weight: 600; font-size: 13px;">${annotation.media_id || 'BOPP File'}</span>
      <span style="background: #3b82f620; color: #3b82f6; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">v${annotation.bopp_version || '1.0'}</span>
      <span style="background: #10b98120; color: #10b981; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">ext: ${extentType}</span>
      <span style="background: #8b5cf620; color: #8b5cf6; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">load: ${payloadType}</span>
      ${confidenceType !== 'none' ? `<span style="background: #f59e0b20; color: #f59e0b; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">conf: ${confidenceType}</span>` : ''}
    `;

    // Tab buttons
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.alignItems = 'center';
    tabsContainer.style.gap = '4px';

    const tabs: Array<{ id: 'visualizer' | 'table' | 'raw' | 'validation'; label: string }> = [
      { id: 'visualizer', label: '📊 Visualizer' },
      { id: 'table', label: `📋 Table (${tabular.length})` },
      { id: 'raw', label: '📝 JSON' },
      { id: 'validation', label: `🛡️ Validation (${validation.score}%)` }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.innerText = tab.label;
      btn.style.fontSize = '11px';
      btn.style.fontWeight = '500';
      btn.style.padding = '4px 10px';
      btn.style.border = `1px solid ${this._activeTab === tab.id ? border : 'transparent'}`;
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      btn.style.background = this._activeTab === tab.id ? activeTabBg : 'transparent';
      btn.style.color = fg;
      btn.onclick = () => {
        this._activeTab = tab.id;
        this._renderUI(annotation, isDark);
      };
      tabsContainer.appendChild(btn);
    });

    // Right Actions
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    actions.style.gap = '6px';

    const exportCsvBtn = document.createElement('button');
    exportCsvBtn.innerText = 'Export CSV';
    exportCsvBtn.style.fontSize = '11px';
    exportCsvBtn.style.padding = '4px 8px';
    exportCsvBtn.style.borderRadius = '4px';
    exportCsvBtn.style.border = `1px solid ${border}`;
    exportCsvBtn.style.background = isDark ? '#27272a' : '#f1f5f9';
    exportCsvBtn.style.color = fg;
    exportCsvBtn.style.cursor = 'pointer';
    exportCsvBtn.onclick = () => {
      const csv = exportToBoppCsv(annotation, tabular);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(annotation.media_id || 'bopp').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    actions.appendChild(exportCsvBtn);

    toolbar.appendChild(leftInfo);
    toolbar.appendChild(tabsContainer);
    toolbar.appendChild(actions);

    // Body Area
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.overflow = 'auto';
    body.style.position = 'relative';

    this._containerNode.innerHTML = '';
    this._containerNode.appendChild(toolbar);
    this._containerNode.appendChild(body);

    if (this._activeTab === 'visualizer') {
      this._renderVisualizer(body, annotation, tabular, isDark);
    } else if (this._activeTab === 'table') {
      this._renderTable(body, tabular, isDark);
    } else if (this._activeTab === 'raw') {
      this._renderRaw(body, annotation, isDark);
    } else if (this._activeTab === 'validation') {
      this._renderValidation(body, validation, isDark);
    }
  }

  private _renderVisualizer(
    container: HTMLElement,
    annotation: BoppAnnotation,
    tabular: Array<Record<string, unknown>>,
    isDark: boolean
  ): void {
    const chartDiv = document.createElement('div');
    chartDiv.style.width = '100%';
    chartDiv.style.minHeight = '480px';
    chartDiv.style.padding = '16px';
    chartDiv.style.boxSizing = 'border-box';
    container.appendChild(chartDiv);

    try {
      const spec = buildBoppVegaLiteSpec(annotation, tabular as any, {
        theme: isDark ? 'dark' : 'light',
        enableOverviewBrush: true,
        enableZoomPan: true
      });

      void embed(chartDiv, spec as any, {
        actions: { export: true, source: false, compiled: false, editor: false },
        renderer: 'canvas'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      chartDiv.innerHTML = `<div style="color: #ef4444; font-size: 13px;">Error rendering Vega-Lite: ${msg}</div>`;
    }
  }

  private _renderTable(
    container: HTMLElement,
    tabular: Array<Record<string, unknown>>,
    isDark: boolean
  ): void {
    if (tabular.length === 0) {
      container.innerHTML = `<div style="padding: 24px; color: #71717a;">No data records in this annotation.</div>`;
      return;
    }

    const keys = Object.keys(tabular[0]);
    const border = isDark ? '#27272a' : '#e4e4e7';
    const thBg = isDark ? '#202024' : '#f8fafc';

    let html = `
      <div style="padding: 12px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: monospace;">
          <thead>
            <tr style="background: ${thBg}; border-bottom: 2px solid ${border}; text-align: left;">
              ${keys.map(k => `<th style="padding: 6px 10px; font-weight: 600;">${k}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    tabular.slice(0, 500).forEach(row => {
      html += `<tr style="border-bottom: 1px solid ${border};">`;
      keys.forEach(k => {
        const val = row[k];
        html += `<td style="padding: 6px 10px;">${val !== undefined && val !== null ? String(val) : ''}</td>`;
      });
      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
        ${tabular.length > 500 ? `<div style="padding: 8px; font-size: 11px; color: #71717a;">Showing first 500 rows of ${tabular.length} total records.</div>` : ''}
      </div>
    `;

    container.innerHTML = html;
  }

  private _renderRaw(container: HTMLElement, annotation: BoppAnnotation, isDark: boolean): void {
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.padding = '16px';
    pre.style.fontSize = '11px';
    pre.style.fontFamily = 'monospace';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.style.background = isDark ? '#141416' : '#f8fafc';
    pre.style.color = isDark ? '#e4e4e7' : '#18181b';
    pre.innerText = JSON.stringify(annotation, null, 2);
    container.appendChild(pre);
  }

  private _renderValidation(container: HTMLElement, validation: any, isDark: boolean): void {
    const border = isDark ? '#27272a' : '#e4e4e7';
    let html = `
      <div style="padding: 20px; font-size: 13px; max-width: 800px;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
          <div style="font-size: 32px; font-weight: 700; color: ${validation.isValid ? '#10b981' : '#f59e0b'};">
            ${validation.score}%
          </div>
          <div>
            <div style="font-weight: 600;">${validation.isValid ? 'Valid BOPP Schema Specification' : 'Schema Warnings or Issues Detected'}</div>
            <div style="color: #71717a; font-size: 12px;">Checks passed: ${validation.checksSummary.passed} | Warnings: ${validation.checksSummary.warnings} | Errors: ${validation.checksSummary.errors}</div>
          </div>
        </div>
        <div style="border-top: 1px solid ${border}; padding-top: 12px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px;">Validation Report</h4>
    `;

    if (validation.issues.length === 0) {
      html += `<div style="color: #10b981; font-size: 12px;">✓ Perfect score. All required discriminators, arrays, and parallel columns are verified.</div>`;
    } else {
      validation.issues.forEach((issue: any) => {
        const color = issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6';
        html += `
          <div style="margin-bottom: 8px; padding: 8px 12px; border-radius: 4px; background: ${color}15; border-left: 3px solid ${color};">
            <span style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: ${color};">[${issue.severity}]</span>
            <span style="font-family: monospace; font-size: 11px; margin-left: 6px;">${issue.path}:</span>
            <span style="margin-left: 6px; font-size: 12px;">${issue.message}</span>
          </div>
        `;
      });
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }
}

export class BOPPWidgetFactory extends ABCWidgetFactory<BOPPWidget> {
  private _themeManager: IThemeManager | null;

  constructor(options: DocumentRegistry.IWidgetFactoryOptions & { themeManager: IThemeManager | null }) {
    super(options);
    this._themeManager = options.themeManager;
  }

  protected createNewWidget(context: DocumentRegistry.Context): BOPPWidget {
    return new BOPPWidget(context, this._themeManager);
  }
}
