/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab extension entry point for jupyterlab-bopp
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { BOPPWidgetFactory } from './widget';
import { createBOPPRendererFactory, BOPP_MIME_TYPES } from './mimeRenderer';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-bopp:plugin',
  description: 'Interactive Vega-Lite visualizer and MIME renderer for BOPP JSON & MessagePack files',
  autoStart: true,
  optional: [IThemeManager, IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    themeManager: IThemeManager | null,
    rendermime: IRenderMimeRegistry | null
  ) => {
    console.log('[jupyterlab-bopp] Extension activated! Registering BOPP file types, widget factory, and MIME renderers...');

    // 1. Register .bopp and .bopp.json file types
    app.docRegistry.addFileType({
      name: 'bopp',
      displayName: 'BOPP Annotation',
      extensions: ['.bopp', '.bopp.json'],
      mimeTypes: ['application/vnd.bopp+json', 'application/json'],
      fileFormat: 'text',
      iconClass: 'jp-MaterialIcon jp-AnalyticsIcon'
    });

    // 2. Register .bopp.msgpack and .msgpack file types
    app.docRegistry.addFileType({
      name: 'bopp-msgpack',
      displayName: 'BOPP MessagePack',
      extensions: ['.bopp.msgpack', '.msgpack'],
      mimeTypes: ['application/vnd.bopp+msgpack', 'application/x-msgpack'],
      fileFormat: 'base64',
      iconClass: 'jp-MaterialIcon jp-FileIcon'
    });

    // 3. Document Widget Factory (for opening standalone files from file browser)
    const factory = new BOPPWidgetFactory({
      name: 'BOPP Visualizer',
      fileTypes: ['bopp', 'bopp-msgpack'],
      defaultFor: ['bopp', 'bopp-msgpack'],
      defaultRendered: ['bopp', 'bopp-msgpack'],
      themeManager
    });

    app.docRegistry.addWidgetFactory(factory);

    // 4. MIME Renderer Factory for Notebook cell outputs (_repr_mimebundle_)
    if (rendermime) {
      console.log('[jupyterlab-bopp] Registering MIME renderer factory for:', BOPP_MIME_TYPES.join(', '));
      const mimeFactory = createBOPPRendererFactory(themeManager);
      rendermime.addFactory(mimeFactory, 0);
    }
  }
};

export default plugin;
export { createBOPPRendererFactory, BOPP_MIME_TYPES } from './mimeRenderer';
