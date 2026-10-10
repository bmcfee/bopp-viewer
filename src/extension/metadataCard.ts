/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Expandable Annotation Metadata and Sandbox DOM Card for JupyterLab Extension
 * Displays BOPP document metadata, media identifiers, annotator info, and sandbox data
 * in both BOPPWidget and BOPPMimeRenderer.
 */

import type { BoppAnnotation } from '../types/bopp';

export interface MetadataCardOptions {
  defaultExpanded?: boolean;
  compact?: boolean;
}

/**
 * Creates an interactive DOM card component matching the demo site's AnnotationMetadataCard.
 */
export function createAnnotationMetadataCardDOM(
  annotation: BoppAnnotation,
  isDark: boolean,
  options: MetadataCardOptions = {}
): HTMLElement {
  const { defaultExpanded = false, compact = false } = options;

  let isExpanded = defaultExpanded;
  let showRawMetadata = false;
  let showRawSandbox = false;

  const metadata = (annotation.metadata || {}) as Record<string, unknown>;
  const hasMetadata = Object.keys(metadata).length > 0;
  const sandbox = (annotation.sandbox || {}) as Record<string, unknown>;
  const hasSandbox = Object.keys(sandbox).length > 0;
  const parents = annotation.parents || [];
  const hasParents = parents.length > 0;

  // Theming colors
  const border = isDark ? '#27272a' : '#e2e8f0';
  const cardBg = isDark ? '#141416' : '#f8fafc';
  const headerHoverBg = isDark ? '#1f1f23' : '#f1f5f9';
  const textPrimary = isDark ? '#f4f4f5' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const pillBg = isDark ? '#1e1e24' : '#ffffff';
  const badgeBorder = isDark ? '#33333b' : '#cbd5e1';

  const container = document.createElement('div');
  container.className = 'jp-BOPP-metadata-card';
  container.style.margin = compact ? '4px 0 8px 0' : '10px 14px';
  container.style.border = `1px solid ${border}`;
  container.style.borderRadius = '8px';
  container.style.backgroundColor = cardBg;
  container.style.overflow = 'hidden';
  container.style.fontSize = '12px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  container.style.transition = 'all 0.2s ease';

  // Format dates/timestamps
  const formatDate = (val: unknown): string => {
    if (!val) return '';
    try {
      const d = new Date(String(val));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch {}
    return String(val);
  };

  // Safe copy to clipboard
  const copyText = (text: string, button: HTMLButtonElement) => {
    const originalText = button.innerHTML;
    const onSuccess = () => {
      button.innerHTML = '✓ Copied';
      button.style.color = '#06b6d4';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.color = '';
      }, 2000);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        fallbackCopy(text);
        onSuccess();
      });
    } else {
      fallbackCopy(text);
      onSuccess();
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(textArea);
  };

  // 1. Collapsed Header / Summary Bar
  const header = document.createElement('div');
  header.className = 'jp-BOPP-metadata-header';
  header.style.display = 'flex';
  header.style.flexWrap = 'wrap';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = compact ? '6px 10px' : '8px 14px';
  header.style.cursor = 'pointer';
  header.style.userSelect = 'none';
  header.style.gap = '8px';
  header.style.transition = 'background-color 0.15s ease';

  header.onmouseenter = () => {
    header.style.backgroundColor = headerHoverBg;
  };
  header.onmouseleave = () => {
    header.style.backgroundColor = 'transparent';
  };

  // Left Section
  const leftSection = document.createElement('div');
  leftSection.style.display = 'flex';
  leftSection.style.alignItems = 'center';
  leftSection.style.gap = '8px';
  leftSection.style.flexWrap = 'wrap';

  // Info Icon Badge
  const iconBadge = document.createElement('div');
  iconBadge.style.display = 'flex';
  iconBadge.style.alignItems = 'center';
  iconBadge.style.justifyContent = 'center';
  iconBadge.style.width = '20px';
  iconBadge.style.height = '20px';
  iconBadge.style.borderRadius = '4px';
  iconBadge.style.backgroundColor = '#2563eb';
  iconBadge.style.color = '#ffffff';
  iconBadge.style.fontSize = '11px';
  iconBadge.style.fontWeight = 'bold';
  iconBadge.innerText = 'i';
  leftSection.appendChild(iconBadge);

  // Title
  const title = document.createElement('span');
  title.style.fontWeight = '600';
  title.style.color = textPrimary;
  title.innerText = 'Annotation Metadata';
  leftSection.appendChild(title);

  // Media ID Pill with copy button
  const mediaPill = document.createElement('div');
  mediaPill.style.display = 'flex';
  mediaPill.style.alignItems = 'center';
  mediaPill.style.gap = '4px';
  mediaPill.style.fontFamily = 'monospace';
  mediaPill.style.fontSize = '11px';
  mediaPill.style.backgroundColor = pillBg;
  mediaPill.style.border = `1px solid ${border}`;
  mediaPill.style.padding = '2px 6px';
  mediaPill.style.borderRadius = '4px';
  mediaPill.style.maxWidth = '260px';

  const mediaLabel = document.createElement('span');
  mediaLabel.style.color = textSecondary;
  mediaLabel.innerText = 'media:';
  mediaPill.appendChild(mediaLabel);

  const mediaVal = document.createElement('span');
  mediaVal.style.fontWeight = '600';
  mediaVal.style.color = textPrimary;
  mediaVal.style.overflow = 'hidden';
  mediaVal.style.textOverflow = 'ellipsis';
  mediaVal.style.whiteSpace = 'nowrap';
  mediaVal.title = annotation.media_id;
  mediaVal.innerText = annotation.media_id;
  mediaPill.appendChild(mediaVal);

  const copyMediaBtn = document.createElement('button');
  copyMediaBtn.innerText = '📋';
  copyMediaBtn.title = 'Copy media_id';
  copyMediaBtn.style.background = 'none';
  copyMediaBtn.style.border = 'none';
  copyMediaBtn.style.cursor = 'pointer';
  copyMediaBtn.style.padding = '0 2px';
  copyMediaBtn.style.fontSize = '10px';
  copyMediaBtn.onclick = e => {
    e.stopPropagation();
    copyText(annotation.media_id, copyMediaBtn);
  };
  mediaPill.appendChild(copyMediaBtn);
  leftSection.appendChild(mediaPill);

  header.appendChild(leftSection);

  // Right Badges & Expand Indicator
  const rightSection = document.createElement('div');
  rightSection.style.display = 'flex';
  rightSection.style.alignItems = 'center';
  rightSection.style.gap = '6px';
  rightSection.style.flexWrap = 'wrap';

  // BOPP Version Badge
  const versionBadge = document.createElement('span');
  versionBadge.style.fontSize = '10px';
  versionBadge.style.fontFamily = 'monospace';
  versionBadge.style.padding = '2px 6px';
  versionBadge.style.borderRadius = '999px';
  versionBadge.style.backgroundColor = isDark ? '#1e1e24' : '#e2e8f0';
  versionBadge.style.color = textPrimary;
  versionBadge.style.border = `1px solid ${badgeBorder}`;
  versionBadge.innerText = `BOPP v${annotation.bopp_version || '1.0'}`;
  rightSection.appendChild(versionBadge);

  // Extent Badge
  const extentBadge = document.createElement('span');
  extentBadge.style.fontSize = '10px';
  extentBadge.style.fontFamily = 'monospace';
  extentBadge.style.padding = '2px 6px';
  extentBadge.style.borderRadius = '999px';
  extentBadge.style.backgroundColor = isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7';
  extentBadge.style.color = isDark ? '#fcd34d' : '#92400e';
  extentBadge.style.border = `1px solid ${isDark ? '#78350f' : '#fde68a'}`;
  extentBadge.innerText = `extent: ${annotation.extent?.extent_type || 'none (global)'}`;
  rightSection.appendChild(extentBadge);

  // Annotator or Metadata Type Badge
  if (metadata.metadata_type) {
    const metaTypeBadge = document.createElement('span');
    metaTypeBadge.style.fontSize = '10px';
    metaTypeBadge.style.padding = '2px 6px';
    metaTypeBadge.style.borderRadius = '999px';
    metaTypeBadge.style.backgroundColor = isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7';
    metaTypeBadge.style.color = isDark ? '#6ee7b7' : '#166534';
    metaTypeBadge.style.border = `1px solid ${isDark ? '#065f46' : '#bbf7d0'}`;
    const descId = (metadata.annotator_id || metadata.algorithm_id || metadata.platform || metadata.device || metadata.metadata_type) as string;
    metaTypeBadge.innerText = `${metadata.metadata_type}: ${String(descId).slice(0, 16)}`;
    rightSection.appendChild(metaTypeBadge);
  }

  // Confidence Badge (Achromatic / No Hue)
  if (annotation.confidence?.confidence_type) {
    const confBadge = document.createElement('span');
    confBadge.style.fontSize = '10px';
    confBadge.style.padding = '2px 6px';
    confBadge.style.borderRadius = '999px';
    confBadge.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#f1f5f9';
    confBadge.style.color = isDark ? '#ffffff' : '#0f172a';
    confBadge.style.border = isDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #cbd5e1';
    const confRecord = annotation.confidence as unknown as Record<string, unknown>;
    const nTotal = confRecord?.n_annotators_common;
    const cType = annotation.confidence.confidence_type;
    confBadge.innerText = cType === 'agreement'
      ? (typeof nTotal === 'number' ? `👥 agreement (${nTotal})` : '👥 agreement')
      : cType === 'variance'
      ? '📊 variance (σ²)'
      : '🎯 likelihood';
    rightSection.appendChild(confBadge);
  }

  // Sandbox Badge (if present)
  if (hasSandbox) {
    const sandboxBadge = document.createElement('span');
    sandboxBadge.style.fontSize = '10px';
    sandboxBadge.style.padding = '2px 7px';
    sandboxBadge.style.borderRadius = '999px';
    sandboxBadge.style.backgroundColor = isDark ? 'rgba(217, 119, 6, 0.2)' : '#fef3c7';
    sandboxBadge.style.color = isDark ? '#fbbf24' : '#b45309';
    sandboxBadge.style.border = `1px solid ${isDark ? '#92400e' : '#fcd34d'}`;
    sandboxBadge.style.fontWeight = '600';
    sandboxBadge.innerText = `✨ sandbox (${Object.keys(sandbox).length})`;
    sandboxBadge.title = 'User-defined arbitrary sandbox storage present';
    rightSection.appendChild(sandboxBadge);
  }

  // Expand Toggle Chevron
  const expandToggle = document.createElement('div');
  expandToggle.style.display = 'flex';
  expandToggle.style.alignItems = 'center';
  expandToggle.style.gap = '3px';
  expandToggle.style.fontWeight = '600';
  expandToggle.style.color = '#2563eb';
  expandToggle.style.fontSize = '11px';
  expandToggle.style.marginLeft = '4px';

  const updateExpandText = () => {
    expandToggle.innerHTML = isExpanded ? '<span>Hide</span> <span>▲</span>' : '<span>Expand</span> <span>▼</span>';
  };
  updateExpandText();
  rightSection.appendChild(expandToggle);

  header.appendChild(rightSection);
  container.appendChild(header);

  // 2. Expanded Details Section
  const details = document.createElement('div');
  details.style.display = isExpanded ? 'block' : 'none';
  details.style.padding = '12px 14px';
  details.style.borderTop = `1px solid ${border}`;
  details.style.backgroundColor = isDark ? '#111113' : '#ffffff';

  const renderDetailsContent = () => {
    details.innerHTML = '';

    // A. Identifiers & Provenance Bar
    const idBar = document.createElement('div');
    idBar.style.display = 'grid';
    idBar.style.gridTemplateColumns = 'repeat(auto-fit, minmax(240px, 1fr))';
    idBar.style.gap = '8px';
    idBar.style.marginBottom = '12px';

    // Full Media ID Box
    const mediaBox = document.createElement('div');
    mediaBox.style.padding = '8px 10px';
    mediaBox.style.borderRadius = '6px';
    mediaBox.style.backgroundColor = cardBg;
    mediaBox.style.border = `1px solid ${border}`;

    mediaBox.innerHTML = `
      <div style="font-size: 10px; font-weight: 600; color: ${textSecondary}; margin-bottom: 2px;">
        FULL MEDIA IDENTIFIER (media_id)
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-family: monospace; font-size: 11px; word-break: break-all;">
        <span style="color: ${textPrimary};">${annotation.media_id}</span>
      </div>
    `;
    const copyFullMediaBtn = document.createElement('button');
    copyFullMediaBtn.innerText = 'Copy';
    copyFullMediaBtn.style.padding = '2px 8px';
    copyFullMediaBtn.style.fontSize = '10px';
    copyFullMediaBtn.style.borderRadius = '4px';
    copyFullMediaBtn.style.border = `1px solid ${border}`;
    copyFullMediaBtn.style.backgroundColor = pillBg;
    copyFullMediaBtn.style.color = textPrimary;
    copyFullMediaBtn.style.cursor = 'pointer';
    copyFullMediaBtn.style.marginTop = '4px';
    copyFullMediaBtn.onclick = () => copyText(annotation.media_id, copyFullMediaBtn);
    mediaBox.appendChild(copyFullMediaBtn);
    idBar.appendChild(mediaBox);

    // Annotation UUID Box
    const uuidBox = document.createElement('div');
    uuidBox.style.padding = '8px 10px';
    uuidBox.style.borderRadius = '6px';
    uuidBox.style.backgroundColor = cardBg;
    uuidBox.style.border = `1px solid ${border}`;
    uuidBox.innerHTML = `
      <div style="font-size: 10px; font-weight: 600; color: ${textSecondary}; margin-bottom: 2px;">
        ANNOTATION UUID (id)
      </div>
      <div style="font-family: monospace; font-size: 11px; color: ${textPrimary}; word-break: break-all;">
        ${annotation.id || '<span style="color: ' + textSecondary + '; font-style: italic;">Auto-generated content hash</span>'}
      </div>
    `;
    idBar.appendChild(uuidBox);
    details.appendChild(idBar);

    // B. Parents Provenance (if present)
    if (hasParents) {
      const parentsBox = document.createElement('div');
      parentsBox.style.padding = '8px 10px';
      parentsBox.style.borderRadius = '6px';
      parentsBox.style.backgroundColor = cardBg;
      parentsBox.style.border = `1px solid ${border}`;
      parentsBox.style.marginBottom = '12px';

      const parentsTitle = document.createElement('div');
      parentsTitle.style.fontSize = '10px';
      parentsTitle.style.fontWeight = '600';
      parentsTitle.style.color = textSecondary;
      parentsTitle.style.marginBottom = '4px';
      parentsTitle.innerText = 'PARENT ANNOTATION IDS (Derived from)';
      parentsBox.appendChild(parentsTitle);

      const parentsList = document.createElement('div');
      parentsList.style.display = 'flex';
      parentsList.style.flexWrap = 'wrap';
      parentsList.style.gap = '4px';
      parents.forEach(p => {
        const pPill = document.createElement('span');
        pPill.style.fontFamily = 'monospace';
        pPill.style.fontSize = '10px';
        pPill.style.padding = '2px 6px';
        pPill.style.borderRadius = '4px';
        pPill.style.border = `1px solid ${border}`;
        pPill.style.backgroundColor = pillBg;
        pPill.style.color = textPrimary;
        pPill.innerText = p;
        parentsList.appendChild(pPill);
      });
      parentsBox.appendChild(parentsList);
      details.appendChild(parentsBox);
    }

    // C. Structured Metadata Attributes
    const metaContainer = document.createElement('div');
    metaContainer.style.marginBottom = '12px';

    const metaHeader = document.createElement('div');
    metaHeader.style.display = 'flex';
    metaHeader.style.alignItems = 'center';
    metaHeader.style.justifyContent = 'space-between';
    metaHeader.style.marginBottom = '6px';

    const metaLabel = document.createElement('span');
    metaLabel.style.fontWeight = '700';
    metaLabel.style.fontSize = '12px';
    metaLabel.style.color = textPrimary;
    metaLabel.innerText = 'Metadata Attributes';
    metaHeader.appendChild(metaLabel);

    if (hasMetadata) {
      const toggleMetaBtn = document.createElement('button');
      toggleMetaBtn.style.background = 'none';
      toggleMetaBtn.style.border = 'none';
      toggleMetaBtn.style.color = '#2563eb';
      toggleMetaBtn.style.fontSize = '11px';
      toggleMetaBtn.style.cursor = 'pointer';
      toggleMetaBtn.style.textDecoration = 'underline';
      toggleMetaBtn.innerText = showRawMetadata ? 'View Structured' : 'View Raw JSON';
      toggleMetaBtn.onclick = () => {
        showRawMetadata = !showRawMetadata;
        renderDetailsContent();
      };
      metaHeader.appendChild(toggleMetaBtn);
    }
    metaContainer.appendChild(metaHeader);

    if (!hasMetadata) {
      const noMeta = document.createElement('div');
      noMeta.style.padding = '8px 12px';
      noMeta.style.borderRadius = '6px';
      noMeta.style.backgroundColor = cardBg;
      noMeta.style.border = `1px solid ${border}`;
      noMeta.style.color = textSecondary;
      noMeta.style.fontStyle = 'italic';
      noMeta.innerText = 'No metadata block provided in this annotation.';
      metaContainer.appendChild(noMeta);
    } else if (showRawMetadata) {
      const pre = document.createElement('pre');
      pre.style.margin = '0';
      pre.style.padding = '10px';
      pre.style.borderRadius = '6px';
      pre.style.backgroundColor = isDark ? '#09090b' : '#f1f5f9';
      pre.style.border = `1px solid ${border}`;
      pre.style.fontFamily = 'monospace';
      pre.style.fontSize = '11px';
      pre.style.overflowX = 'auto';
      pre.innerText = JSON.stringify(metadata, null, 2);
      metaContainer.appendChild(pre);
    } else {
      // Structured Grid
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
      grid.style.gap = '6px';

      for (const [key, val] of Object.entries(metadata)) {
        if (val === null || val === undefined) continue;
        const attrCard = document.createElement('div');
        attrCard.style.padding = '6px 8px';
        attrCard.style.borderRadius = '6px';
        attrCard.style.backgroundColor = cardBg;
        attrCard.style.border = `1px solid ${border}`;
        attrCard.style.display = 'flex';
        attrCard.style.flexDirection = 'column';

        const kSpan = document.createElement('span');
        kSpan.style.fontSize = '10px';
        kSpan.style.fontWeight = '700';
        kSpan.style.color = textSecondary;
        kSpan.style.textTransform = 'uppercase';
        kSpan.style.letterSpacing = '0.05em';
        kSpan.style.marginBottom = '2px';
        kSpan.innerText = key.replace(/_/g, ' ');
        attrCard.appendChild(kSpan);

        const vSpan = document.createElement('span');
        vSpan.style.fontSize = '11px';
        vSpan.style.fontWeight = '600';
        vSpan.style.color = textPrimary;
        vSpan.style.wordBreak = 'break-word';

        if (typeof val === 'object') {
          vSpan.style.fontFamily = 'monospace';
          vSpan.style.fontSize = '10px';
          vSpan.innerText = JSON.stringify(val);
        } else if (key.includes('time') || key.includes('date') || key.includes('created')) {
          vSpan.innerText = formatDate(val);
        } else {
          vSpan.innerText = String(val);
        }
        attrCard.appendChild(vSpan);
        grid.appendChild(attrCard);
      }
      metaContainer.appendChild(grid);
    }
    details.appendChild(metaContainer);

    // D. Sandbox (User-defined Storage)
    if (hasSandbox) {
      const sandboxContainer = document.createElement('div');
      sandboxContainer.style.padding = '10px 12px';
      sandboxContainer.style.borderRadius = '8px';
      sandboxContainer.style.backgroundColor = isDark ? 'rgba(217, 119, 6, 0.12)' : '#fffbeb';
      sandboxContainer.style.border = `1px solid ${isDark ? '#92400e' : '#fcd34d'}`;

      const sandboxHeader = document.createElement('div');
      sandboxHeader.style.display = 'flex';
      sandboxHeader.style.alignItems = 'center';
      sandboxHeader.style.justifyContent = 'space-between';
      sandboxHeader.style.marginBottom = '8px';

      const sLabel = document.createElement('div');
      sLabel.style.display = 'flex';
      sLabel.style.alignItems = 'center';
      sLabel.style.gap = '6px';
      sLabel.style.fontWeight = '700';
      sLabel.style.fontSize = '12px';
      sLabel.style.color = isDark ? '#fbbf24' : '#92400e';
      sLabel.innerHTML = '<span>✨ Sandbox</span> <span style="font-size: 11px; font-weight: normal; color: ' + (isDark ? '#fcd34d' : '#b45309') + ';">(User-defined Storage)</span>';
      sandboxHeader.appendChild(sLabel);

      const toggleSandboxBtn = document.createElement('button');
      toggleSandboxBtn.style.background = 'none';
      toggleSandboxBtn.style.border = 'none';
      toggleSandboxBtn.style.color = isDark ? '#fbbf24' : '#b45309';
      toggleSandboxBtn.style.fontSize = '11px';
      toggleSandboxBtn.style.cursor = 'pointer';
      toggleSandboxBtn.style.textDecoration = 'underline';
      toggleSandboxBtn.innerText = showRawSandbox ? 'View Structured' : 'View Raw JSON';
      toggleSandboxBtn.onclick = () => {
        showRawSandbox = !showRawSandbox;
        renderDetailsContent();
      };
      sandboxHeader.appendChild(toggleSandboxBtn);
      sandboxContainer.appendChild(sandboxHeader);

      if (showRawSandbox) {
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.padding = '8px 10px';
        pre.style.borderRadius = '6px';
        pre.style.backgroundColor = isDark ? '#141416' : '#ffffff';
        pre.style.border = `1px solid ${isDark ? '#78350f' : '#fde68a'}`;
        pre.style.fontFamily = 'monospace';
        pre.style.fontSize = '11px';
        pre.style.color = isDark ? '#fef3c7' : '#78350f';
        pre.style.overflowX = 'auto';
        pre.innerText = JSON.stringify(sandbox, null, 2);
        sandboxContainer.appendChild(pre);
      } else {
        const sGrid = document.createElement('div');
        sGrid.style.display = 'grid';
        sGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        sGrid.style.gap = '6px';

        for (const [key, val] of Object.entries(sandbox)) {
          const sCard = document.createElement('div');
          sCard.style.padding = '6px 8px';
          sCard.style.borderRadius = '6px';
          sCard.style.backgroundColor = isDark ? 'rgba(0,0,0,0.3)' : '#ffffff';
          sCard.style.border = `1px solid ${isDark ? '#78350f' : '#fde68a'}`;
          sCard.style.display = 'flex';
          sCard.style.flexDirection = 'column';

          const kSpan = document.createElement('span');
          kSpan.style.fontSize = '10px';
          kSpan.style.fontWeight = '700';
          kSpan.style.color = isDark ? '#fcd34d' : '#b45309';
          kSpan.style.textTransform = 'uppercase';
          kSpan.style.letterSpacing = '0.05em';
          kSpan.style.marginBottom = '2px';
          kSpan.innerText = key.replace(/_/g, ' ');
          sCard.appendChild(kSpan);

          const vSpan = document.createElement('span');
          vSpan.style.fontSize = '11px';
          vSpan.style.fontWeight = '600';
          vSpan.style.color = textPrimary;
          vSpan.style.wordBreak = 'break-word';

          if (typeof val === 'object') {
            vSpan.style.fontFamily = 'monospace';
            vSpan.style.fontSize = '10px';
            vSpan.innerText = JSON.stringify(val);
          } else {
            vSpan.innerText = String(val);
          }
          sCard.appendChild(vSpan);
          sGrid.appendChild(sCard);
        }
        sandboxContainer.appendChild(sGrid);
      }
      details.appendChild(sandboxContainer);
    }
  };

  renderDetailsContent();
  container.appendChild(details);

  // Toggle behavior
  header.onclick = () => {
    isExpanded = !isExpanded;
    details.style.display = isExpanded ? 'block' : 'none';
    updateExpandText();
  };

  return container;
}
