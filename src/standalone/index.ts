/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone BOPP Viewer Application
 * Bundled with jupyterlab_bopp pip package for the `boppview` CLI command.
 * Renders the exact Vega-Lite v6 plot and document widget as JupyterLab without IDE dressings.
 */

import embed from 'vega-embed';
import {
  parseBoppJson,
  parseBoppMsgpack,
  annotationToTabular,
  exportToBoppCsv
} from '../utils/boppParser';
import { buildBoppVegaLiteSpec } from '../utils/vegaLiteBuilder';
import { validateBoppAnnotation } from '../utils/schemaValidator';
import { createAnnotationMetadataCardDOM } from '../extension/metadataCard';
import type { BoppAnnotation, TabularRecord } from '../types/bopp';

interface ServerDataResponse {
  filename: string;
  path: string;
  size?: number;
  mtime?: number;
  theme?: string;
  annotation?: BoppAnnotation | null;
  raw_base64?: string | null;
  error?: string | null;
}

declare global {
  interface Window {
    __BOPP_DATA__?: ServerDataResponse;
  }
}

class StandaloneBoppViewer {
  private _root: HTMLElement;
  private _currentAnnotation: BoppAnnotation | null = null;
  private _tabularData: TabularRecord[] = [];

  private _activeTab: 'visualizer' | 'table' | 'raw' | 'validation' = 'visualizer';
  private _isDark: boolean = false;
  private _filename: string = 'annotation.bopp';
  private _filePath: string = '';
  private _tableFilterText: string = '';

  constructor(root: HTMLElement) {
    this._root = root;
    this._initTheme();
  }

  private _initTheme(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    const storedTheme = localStorage.getItem('boppview_theme');

    if (themeParam === 'dark' || (!themeParam && storedTheme === 'dark')) {
      this._isDark = true;
    } else if (themeParam === 'light' || (!themeParam && storedTheme === 'light')) {
      this._isDark = false;
    } else {
      // Default to prefers-color-scheme
      this._isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  private _toggleTheme(): void {
    this._isDark = !this._isDark;
    localStorage.setItem('boppview_theme', this._isDark ? 'dark' : 'light');
    this.render();
  }

  public async start(): Promise<void> {
    this._renderLoading();

    try {
      let data: ServerDataResponse;
      if (window.__BOPP_DATA__) {
        data = window.__BOPP_DATA__;
      } else {
        const resp = await fetch('/api/data');
        if (!resp.ok) {
          throw new Error(`Server returned HTTP ${resp.status} ${resp.statusText}`);
        }
        data = await resp.json();
      }

      if (data.error) {
        throw new Error(data.error);
      }

      this._filename = data.filename || 'annotation.bopp';
      this._filePath = data.path || '';

      if (data.theme && !localStorage.getItem('boppview_theme')) {
        this._isDark = data.theme === 'dark';
      }

      if (data.annotation && typeof data.annotation === 'object') {
        this._currentAnnotation = data.annotation;
      } else if (data.raw_base64) {
        const binaryStr = atob(data.raw_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        this._currentAnnotation = parseBoppMsgpack(bytes);
      } else {
        throw new Error('No annotation data found in server response.');
      }

      document.title = `${this._filename} — BOPP Visualizer`;
      this._tabularData = annotationToTabular(this._currentAnnotation);
      this.render();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._renderError(msg);
    }
  }

  private _renderLoading(): void {
    const bg = this._isDark ? '#0f172a' : '#f8fafc';
    const fg = this._isDark ? '#94a3b8' : '#64748b';
    this._root.innerHTML = `
      <div style="display: flex; height: 100vh; width: 100vw; align-items: center; justify-content: center; background: ${bg}; color: ${fg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="text-align: center;">
          <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid rgba(59, 130, 246, 0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div style="margin-top: 12px; font-size: 14px; font-weight: 500;">Loading BOPP Annotation...</div>
        </div>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
  }

  private _renderError(message: string): void {
    const bg = this._isDark ? '#0f172a' : '#f8fafc';
    const cardBg = this._isDark ? '#1e293b' : '#ffffff';
    const border = this._isDark ? '#334155' : '#e2e8f0';
    const fg = this._isDark ? '#f1f5f9' : '#0f172a';

    this._root.innerHTML = `
      <div style="display: flex; height: 100vh; width: 100vw; align-items: center; justify-content: center; background: ${bg}; padding: 20px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; width: 100%; background: ${cardBg}; border: 1px solid ${border}; border-radius: 12px; padding: 28px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(239, 68, 68, 0.15); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 20px;">⚠️</div>
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: ${fg};">Error Loading BOPP Document</h2>
              <div style="font-size: 13px; color: #ef4444; margin-top: 2px;">${this._filename}</div>
            </div>
          </div>
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 14px; font-size: 13px; color: #b91c1c; font-family: monospace; white-space: pre-wrap; word-break: break-all; margin-bottom: 20px;">${message}</div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="retry-btn" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">Retry</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('retry-btn')?.addEventListener('click', () => {
      void this.start();
    });
  }

  public render(): void {
    if (!this._currentAnnotation) return;
    const annotation = this._currentAnnotation;
    const tabular = this._tabularData;
    const validation = validateBoppAnnotation(annotation);

    const extentType = annotation.extent?.extent_type ?? 'none';
    const payloadType = annotation.payload?.payload_type ?? 'unknown';
    const confidenceType = annotation.confidence?.confidence_type ?? 'none';

    const bg = this._isDark ? '#09090b' : '#f8fafc';
    const surfaceBg = this._isDark ? '#141416' : '#ffffff';
    const fg = this._isDark ? '#f4f4f5' : '#0f172a';
    const textMuted = this._isDark ? '#a1a1aa' : '#64748b';
    const border = this._isDark ? '#27272a' : '#e2e8f0';
    const activeTabBg = this._isDark ? '#27272a' : '#f1f5f9';

    this._root.innerHTML = '';
    this._root.style.margin = '0';
    this._root.style.padding = '0';
    this._root.style.background = bg;
    this._root.style.color = fg;
    this._root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    this._root.style.minHeight = '100vh';
    this._root.style.display = 'flex';
    this._root.style.flexDirection = 'column';

    // 1. Standalone Header Toolbar (Zero dressings, clean document focus)
    const toolbar = document.createElement('header');
    toolbar.style.background = surfaceBg;
    toolbar.style.borderBottom = `1px solid ${border}`;
    toolbar.style.padding = '10px 20px';
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.flexWrap = 'wrap';
    toolbar.style.gap = '12px';
    toolbar.style.position = 'sticky';
    toolbar.style.top = '0';
    toolbar.style.zIndex = '50';

    // Left info
    const leftInfo = document.createElement('div');
    leftInfo.style.display = 'flex';
    leftInfo.style.alignItems = 'center';
    leftInfo.style.gap = '10px';
    leftInfo.style.flexWrap = 'wrap';

    const titleEl = document.createElement('div');
    titleEl.style.display = 'flex';
    titleEl.style.alignItems = 'center';
    titleEl.style.gap = '8px';
    titleEl.innerHTML = `
      <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-size: 15px;">📊</span>
      <span style="font-weight: 700; font-size: 14px; letter-spacing: -0.01em;">${this._filename}</span>
      <span style="font-size: 12px; color: ${textMuted}; font-weight: 400;">${annotation.media_id ? `(${annotation.media_id})` : ''}</span>
    `;
    leftInfo.appendChild(titleEl);

    // Badges
    const badgesContainer = document.createElement('div');
    badgesContainer.style.display = 'flex';
    badgesContainer.style.alignItems = 'center';
    badgesContainer.style.gap = '6px';
    badgesContainer.style.flexWrap = 'wrap';
    badgesContainer.innerHTML = `
      <span style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">v${annotation.bopp_version || '1.0'}</span>
      <span style="background: rgba(16, 185, 129, 0.12); color: #10b981; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">ext: ${extentType}</span>
      <span style="background: rgba(139, 92, 246, 0.12); color: #8b5cf6; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">load: ${payloadType}</span>
      ${confidenceType !== 'none' ? `<span style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">conf: ${confidenceType}</span>` : ''}
    `;
    leftInfo.appendChild(badgesContainer);

    // Center Navigation Tabs
    const tabsContainer = document.createElement('nav');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.alignItems = 'center';
    tabsContainer.style.background = this._isDark ? '#1a1a1e' : '#f1f5f9';
    tabsContainer.style.padding = '3px';
    tabsContainer.style.borderRadius = '8px';
    tabsContainer.style.gap = '2px';

    const tabs: Array<{ id: 'visualizer' | 'table' | 'raw' | 'validation'; label: string }> = [
      { id: 'visualizer', label: '📊 Plot' },
      { id: 'table', label: `📋 Table (${tabular.length})` },
      { id: 'raw', label: '📝 JSON' },
      { id: 'validation', label: `🛡️ Validation (${validation.score}%)` }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.innerText = tab.label;
      btn.style.fontSize = '12px';
      btn.style.fontWeight = '500';
      btn.style.padding = '5px 12px';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 0.15s ease';
      const isActive = this._activeTab === tab.id;
      btn.style.background = isActive ? (this._isDark ? '#27272a' : '#ffffff') : 'transparent';
      btn.style.color = isActive ? fg : textMuted;
      btn.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
      btn.onclick = () => {
        this._activeTab = tab.id;
        this.render();
      };
      tabsContainer.appendChild(btn);
    });

    // Right Actions
    const rightActions = document.createElement('div');
    rightActions.style.display = 'flex';
    rightActions.style.alignItems = 'center';
    rightActions.style.gap = '8px';

    // Theme Toggle
    const themeBtn = document.createElement('button');
    themeBtn.title = `Switch to ${this._isDark ? 'Light' : 'Dark'} mode`;
    themeBtn.innerHTML = this._isDark ? '☀️ Light' : '🌙 Dark';
    themeBtn.style.fontSize = '11px';
    themeBtn.style.fontWeight = '500';
    themeBtn.style.padding = '6px 10px';
    themeBtn.style.borderRadius = '6px';
    themeBtn.style.border = `1px solid ${border}`;
    themeBtn.style.background = surfaceBg;
    themeBtn.style.color = fg;
    themeBtn.style.cursor = 'pointer';
    themeBtn.onclick = () => this._toggleTheme();
    rightActions.appendChild(themeBtn);

    // Export CSV
    const exportBtn = document.createElement('button');
    exportBtn.title = 'Export annotation as CSV';
    exportBtn.innerHTML = '⬇️ CSV';
    exportBtn.style.fontSize = '11px';
    exportBtn.style.fontWeight = '500';
    exportBtn.style.padding = '6px 10px';
    exportBtn.style.borderRadius = '6px';
    exportBtn.style.border = `1px solid ${border}`;
    exportBtn.style.background = surfaceBg;
    exportBtn.style.color = fg;
    exportBtn.style.cursor = 'pointer';
    exportBtn.onclick = () => {
      const csv = exportToBoppCsv(annotation, tabular);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(annotation.media_id || this._filename.replace(/\.bopp(\.json)?$/, '')).replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    rightActions.appendChild(exportBtn);

    // Refresh button
    const reloadBtn = document.createElement('button');
    reloadBtn.title = 'Reload file from server';
    reloadBtn.innerHTML = '🔄 Reload';
    reloadBtn.style.fontSize = '11px';
    reloadBtn.style.fontWeight = '500';
    reloadBtn.style.padding = '6px 10px';
    reloadBtn.style.borderRadius = '6px';
    reloadBtn.style.border = `1px solid ${border}`;
    reloadBtn.style.background = surfaceBg;
    reloadBtn.style.color = fg;
    reloadBtn.style.cursor = 'pointer';
    reloadBtn.onclick = () => {
      void this.start();
    };
    rightActions.appendChild(reloadBtn);

    toolbar.appendChild(leftInfo);
    toolbar.appendChild(tabsContainer);
    toolbar.appendChild(rightActions);
    this._root.appendChild(toolbar);

    // 2. Main Content Container
    const mainContent = document.createElement('main');
    mainContent.style.flex = '1';
    mainContent.style.maxWidth = '1400px';
    mainContent.style.width = '100%';
    mainContent.style.margin = '0 auto';
    mainContent.style.padding = '20px';
    mainContent.style.boxSizing = 'border-box';
    this._root.appendChild(mainContent);

    if (this._activeTab === 'visualizer') {
      this._renderVisualizerView(mainContent, annotation, tabular);
    } else if (this._activeTab === 'table') {
      this._renderTableView(mainContent, tabular);
    } else if (this._activeTab === 'raw') {
      this._renderRawView(mainContent, annotation);
    } else if (this._activeTab === 'validation') {
      this._renderValidationView(mainContent, validation);
    }
  }

  private _renderVisualizerView(
    container: HTMLElement,
    annotation: BoppAnnotation,
    tabular: TabularRecord[]
  ): void {
    const isDark = this._isDark;
    const border = isDark ? '#27272a' : '#e2e8f0';
    const surfaceBg = isDark ? '#141416' : '#ffffff';

    // Metadata card
    const metadataCard = createAnnotationMetadataCardDOM(annotation, isDark, { defaultExpanded: false });
    metadataCard.style.marginBottom = '20px';
    container.appendChild(metadataCard);

    // Compute optimal height
    const payloadType = annotation.payload?.payload_type as string | undefined;
    const extentType = annotation.extent?.extent_type as string | undefined;
    let optimalHeight = 440;

    if (payloadType === 'key_mode') {
      optimalHeight = extentType?.includes('interval') ? 240 : 540;
    } else if (payloadType === 'note_midi' || payloadType === 'piano_roll') {
      optimalHeight = 500;
    } else if (payloadType === 'chord') {
      optimalHeight = 400;
    } else if (payloadType === 'multi_segment' || payloadType === 'segment_open' || payloadType === 'tag_open') {
      if (!extentType || extentType === 'none') {
        const hasConf = Boolean(annotation.confidence?.confidence_type) && tabular.some((d: any) => typeof d.confidence === 'number');
        if (!hasConf) {
          const numCols = Math.max(1, Math.min(tabular.length, Math.floor(640 / 194)));
          const numRows = Math.ceil(tabular.length / numCols);
          optimalHeight = Math.max(140, numRows * 50 + 70);
        } else {
          optimalHeight = Math.max(200, Math.min(460, tabular.length * 44 + 80));
        }
      } else {
        optimalHeight = 280;
      }
    } else if (payloadType === 'pitch_contour' || payloadType === 'note_hz') {
      optimalHeight = 440;
    }

    // Chart Card Container
    const chartCard = document.createElement('div');
    chartCard.style.background = surfaceBg;
    chartCard.style.border = `1px solid ${border}`;
    chartCard.style.borderRadius = '12px';
    chartCard.style.padding = '20px';
    chartCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    chartCard.style.boxSizing = 'border-box';
    chartCard.style.overflowX = 'auto';

    const chartDiv = document.createElement('div');
    chartDiv.style.width = '100%';
    chartDiv.style.minHeight = `${optimalHeight + 60}px`;
    chartCard.appendChild(chartDiv);
    container.appendChild(chartCard);

    try {
      const spec = buildBoppVegaLiteSpec(annotation, tabular as any, {
        theme: isDark ? 'dark' : 'light',
        chartHeight: optimalHeight,
        enableOverviewBrush: true,
        enableZoomPan: true,
      });

      void embed(chartDiv, spec as any, {
        actions: { export: true, source: false, compiled: false, editor: false },
        renderer: 'canvas'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      chartDiv.innerHTML = `
        <div style="padding: 24px; color: #ef4444; background: rgba(239, 68, 68, 0.08); border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">Vega-Lite Visualization Error</div>
          <div style="font-size: 13px; font-family: monospace;">${msg}</div>
        </div>
      `;
    }
  }

  private _renderTableView(
    container: HTMLElement,
    tabular: TabularRecord[]
  ): void {
    const isDark = this._isDark;
    const border = isDark ? '#27272a' : '#e2e8f0';
    const surfaceBg = isDark ? '#141416' : '#ffffff';
    const textMuted = isDark ? '#a1a1aa' : '#64748b';
    const headerBg = isDark ? '#1c1c20' : '#f8fafc';

    const card = document.createElement('div');
    card.style.background = surfaceBg;
    card.style.border = `1px solid ${border}`;
    card.style.borderRadius = '12px';
    card.style.padding = '20px';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    // Search and toolbar
    const tableHeader = document.createElement('div');
    tableHeader.style.display = 'flex';
    tableHeader.style.justifyContent = 'space-between';
    tableHeader.style.alignItems = 'center';
    tableHeader.style.marginBottom = '16px';
    tableHeader.style.gap = '12px';
    tableHeader.style.flexWrap = 'wrap';

    const countInfo = document.createElement('div');
    countInfo.style.fontSize = '13px';
    countInfo.style.fontWeight = '600';
    countInfo.innerText = `Total Observations: ${tabular.length}`;
    tableHeader.appendChild(countInfo);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Filter table records...';
    searchInput.value = this._tableFilterText;
    searchInput.style.padding = '6px 12px';
    searchInput.style.fontSize = '12px';
    searchInput.style.borderRadius = '6px';
    searchInput.style.border = `1px solid ${border}`;
    searchInput.style.background = isDark ? '#1c1c20' : '#ffffff';
    searchInput.style.color = isDark ? '#f4f4f5' : '#0f172a';
    searchInput.style.outline = 'none';
    searchInput.style.minWidth = '220px';
    searchInput.oninput = (e) => {
      this._tableFilterText = (e.target as HTMLInputElement).value.toLowerCase();
      this._refreshTableContent(tbody, tabular, border, isDark);
    };
    tableHeader.appendChild(searchInput);
    card.appendChild(tableHeader);

    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';
    tableWrapper.style.maxHeight = '650px';
    tableWrapper.style.border = `1px solid ${border}`;
    tableWrapper.style.borderRadius = '8px';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    table.style.textAlign = 'left';

    const thead = document.createElement('thead');
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.background = headerBg;
    thead.style.borderBottom = `1px solid ${border}`;
    thead.innerHTML = `
      <tr>
        <th style="padding: 10px 14px; font-weight: 600; width: 50px;">#</th>
        <th style="padding: 10px 14px; font-weight: 600;">Time / Onset</th>
        <th style="padding: 10px 14px; font-weight: 600;">Offset</th>
        <th style="padding: 10px 14px; font-weight: 600;">Duration</th>
        <th style="padding: 10px 14px; font-weight: 600;">Value / Label</th>
        <th style="padding: 10px 14px; font-weight: 600;">Confidence</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);
    container.appendChild(card);

    this._refreshTableContent(tbody, tabular, border, isDark);
  }

  private _refreshTableContent(
    tbody: HTMLTableSectionElement,
    tabular: TabularRecord[],
    border: string,
    isDark: boolean
  ): void {
    tbody.innerHTML = '';
    const filter = this._tableFilterText;

    const filtered = tabular.filter((row) => {
      if (!filter) return true;
      const str = JSON.stringify(row).toLowerCase();
      return str.includes(filter);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 30px; text-align: center; color: #71717a;">
            ${tabular.length === 0 ? 'No tabular records found in this annotation.' : 'No records match filter query.'}
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = `1px solid ${border}`;
      tr.style.background = idx % 2 === 0 ? (isDark ? '#141416' : '#ffffff') : (isDark ? '#18181b' : '#f8fafc');

      const onset = row.time ?? row.onset ?? row.start ?? '-';
      const offset = row.offset ?? row.end ?? '-';
      const duration = (typeof onset === 'number' && typeof offset === 'number')
        ? (offset - onset).toFixed(3) + 's'
        : (row.duration != null ? `${row.duration}s` : '-');

      const val = row.value ?? row.label ?? row.key ?? row.chord ?? row.note ?? '-';
      const conf = row.confidence != null ? Number(row.confidence).toFixed(3) : '-';

      tr.innerHTML = `
        <td style="padding: 8px 14px; color: #71717a;">${idx + 1}</td>
        <td style="padding: 8px 14px; font-family: monospace;">${typeof onset === 'number' ? onset.toFixed(3) + 's' : onset}</td>
        <td style="padding: 8px 14px; font-family: monospace;">${typeof offset === 'number' ? offset.toFixed(3) + 's' : offset}</td>
        <td style="padding: 8px 14px; font-family: monospace;">${duration}</td>
        <td style="padding: 8px 14px; font-weight: 600;">${String(val)}</td>
        <td style="padding: 8px 14px;">${conf !== '-' ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${conf}</span>` : '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  private _renderRawView(container: HTMLElement, annotation: BoppAnnotation): void {
    const isDark = this._isDark;
    const border = isDark ? '#27272a' : '#e2e8f0';
    const surfaceBg = isDark ? '#141416' : '#ffffff';

    const card = document.createElement('div');
    card.style.background = surfaceBg;
    card.style.border = `1px solid ${border}`;
    card.style.borderRadius = '12px';
    card.style.padding = '20px';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.alignItems = 'center';
    topBar.style.marginBottom = '12px';

    const label = document.createElement('div');
    label.style.fontSize = '13px';
    label.style.fontWeight = '600';
    label.innerText = 'BOPP Document JSON Representation';
    topBar.appendChild(label);

    const jsonStr = JSON.stringify(annotation, null, 2);

    const copyBtn = document.createElement('button');
    copyBtn.innerText = '📋 Copy JSON';
    copyBtn.style.fontSize = '12px';
    copyBtn.style.padding = '5px 12px';
    copyBtn.style.borderRadius = '6px';
    copyBtn.style.border = `1px solid ${border}`;
    copyBtn.style.background = isDark ? '#27272a' : '#f1f5f9';
    copyBtn.style.color = isDark ? '#f4f4f5' : '#0f172a';
    copyBtn.style.cursor = 'pointer';
    copyBtn.onclick = () => {
      void navigator.clipboard.writeText(jsonStr);
      copyBtn.innerText = '✅ Copied!';
      setTimeout(() => {
        copyBtn.innerText = '📋 Copy JSON';
      }, 2000);
    };
    topBar.appendChild(copyBtn);
    card.appendChild(topBar);

    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.padding = '16px';
    pre.style.borderRadius = '8px';
    pre.style.background = isDark ? '#09090b' : '#f8fafc';
    pre.style.border = `1px solid ${border}`;
    pre.style.fontSize = '12px';
    pre.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    pre.style.overflowX = 'auto';
    pre.style.maxHeight = '650px';
    pre.style.color = isDark ? '#38bdf8' : '#0369a1';
    pre.innerText = jsonStr;
    card.appendChild(pre);

    container.appendChild(card);
  }

  private _renderValidationView(container: HTMLElement, validation: ReturnType<typeof validateBoppAnnotation>): void {
    const isDark = this._isDark;
    const border = isDark ? '#27272a' : '#e2e8f0';
    const surfaceBg = isDark ? '#141416' : '#ffffff';

    const card = document.createElement('div');
    card.style.background = surfaceBg;
    card.style.border = `1px solid ${border}`;
    card.style.borderRadius = '12px';
    card.style.padding = '24px';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

    const is100 = validation.score === 100 && validation.isValid;
    const scoreColor = is100 ? '#10b981' : (validation.score >= 80 ? '#f59e0b' : '#ef4444');

    const scoreCard = document.createElement('div');
    scoreCard.style.display = 'flex';
    scoreCard.style.alignItems = 'center';
    scoreCard.style.gap = '20px';
    scoreCard.style.padding = '16px 20px';
    scoreCard.style.background = isDark ? '#1a1a1e' : '#f8fafc';
    scoreCard.style.border = `1px solid ${border}`;
    scoreCard.style.borderRadius = '8px';
    scoreCard.style.marginBottom = '24px';

    scoreCard.innerHTML = `
      <div style="font-size: 36px; font-weight: 800; color: ${scoreColor};">${validation.score}%</div>
      <div>
        <div style="font-size: 15px; font-weight: 700; color: ${isDark ? '#f4f4f5' : '#0f172a'};">${is100 ? 'Fully Compliant BOPP Document' : 'Document Has Validation Issues'}</div>
        <div style="font-size: 13px; color: ${isDark ? '#a1a1aa' : '#64748b'}; margin-top: 2px;">
          Schema: BOPP v${validation.schemaVersion || '1.0'} (Draft 2020-12) &bull; Passed: ${validation.checksSummary.passed} &bull; Warnings: ${validation.checksSummary.warnings} &bull; Errors: ${validation.checksSummary.errors}
        </div>
      </div>
    `;
    card.appendChild(scoreCard);

    const issuesHeader = document.createElement('h3');
    issuesHeader.innerText = validation.issues.length === 0 ? 'Validation Checks (All Passed)' : 'Validation Issues & Warnings';
    issuesHeader.style.fontSize = '14px';
    issuesHeader.style.margin = '0 0 12px 0';
    card.appendChild(issuesHeader);

    if (validation.issues.length === 0) {
      const allPassed = document.createElement('div');
      allPassed.style.padding = '16px';
      allPassed.style.borderRadius = '8px';
      allPassed.style.background = 'rgba(16, 185, 129, 0.1)';
      allPassed.style.color = '#10b981';
      allPassed.style.fontSize = '13px';
      allPassed.style.fontWeight = '500';
      allPassed.innerText = '✓ All extent, payload, confidence, and metadata structure checks passed standard schema validation.';
      card.appendChild(allPassed);
    } else {
      const issueList = document.createElement('div');
      issueList.style.display = 'flex';
      issueList.style.flexDirection = 'column';
      issueList.style.gap = '8px';

      validation.issues.forEach(issue => {
        const item = document.createElement('div');
        const color = issue.severity === 'error' ? '#ef4444' : (issue.severity === 'warning' ? '#f59e0b' : '#3b82f6');
        item.style.padding = '12px 16px';
        item.style.borderRadius = '8px';
        item.style.border = `1px solid ${color}30`;
        item.style.background = `${color}10`;
        item.style.fontSize = '13px';
        item.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 700; color: ${color}; text-transform: uppercase; font-size: 11px;">[${issue.severity}] ${issue.path}</span>
          </div>
          <div style="color: ${isDark ? '#f4f4f5' : '#0f172a'};">${issue.message}</div>
          ${issue.details ? `<div style="font-size: 11px; color: ${isDark ? '#a1a1aa' : '#64748b'}; margin-top: 4px; font-family: monospace;">${issue.details}</div>` : ''}
        `;
        issueList.appendChild(item);
      });
      card.appendChild(issueList);
    }

    container.appendChild(card);
  }
}

// Automatically bootstrap on window DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app') || document.body;
  const viewer = new StandaloneBoppViewer(container);
  void viewer.start();
});
