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
import { BOPPWidgetFactory } from './widget';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-bopp:plugin',
  description: 'Interactive Vega-Lite visualizer for BOPP JSON & MessagePack files',
  autoStart: true,
  optional: [IThemeManager],
  activate: (app: JupyterFrontEnd, themeManager: IThemeManager | null) => {
    console.log('[jupyterlab-bopp] Extension activated! Registering BOPP file types and widget factory...');

    // Register .bopp and .bopp.json file types first
    app.docRegistry.addFileType({
      name: 'bopp',
      displayName: 'BOPP Annotation',
      extensions: ['.bopp', '.bopp.json'],
      mimeTypes: ['application/vnd.bopp+json', 'application/json'],
      fileFormat: 'text',
      iconClass: 'jp-MaterialIcon jp-AnalyticsIcon'
    });

    // Register .bopp.msgpack and .msgpack file types
    app.docRegistry.addFileType({
      name: 'bopp-msgpack',
      displayName: 'BOPP MessagePack',
      extensions: ['.bopp.msgpack', '.msgpack'],
      mimeTypes: ['application/vnd.bopp+msgpack', 'application/x-msgpack'],
      fileFormat: 'base64',
      iconClass: 'jp-MaterialIcon jp-FileIcon'
    });

    const factory = new BOPPWidgetFactory({
      name: 'BOPP Visualizer',
      fileTypes: ['bopp', 'bopp-msgpack'],
      defaultFor: ['bopp', 'bopp-msgpack'],
      defaultRendered: ['bopp', 'bopp-msgpack'],
      themeManager
    });

    app.docRegistry.addWidgetFactory(factory);
  }
};

export default plugin;
