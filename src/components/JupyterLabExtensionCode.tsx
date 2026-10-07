/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab Extension Package & Architecture Component
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode2, Package, Layers, ExternalLink } from 'lucide-react';

export const JupyterLabExtensionCode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'index' | 'widget' | 'package' | 'readme'>('index');
  const [copied, setCopied] = useState<boolean>(false);

  const files = {
    index: {
      filename: 'src/index.ts',
      desc: 'JupyterLab extension entry point registering the custom Document Widget Factory for .bopp and .msgpack files.',
      code: `import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { IThemeManager } from '@jupyterlab/apputils';
import { BOPPWidgetFactory } from './widget';

/**
 * Initialization data for the jupyterlab-bopp extension.
 * This plugin allows users to double-click .bopp, .bopp.msgpack, or .bopp.json files
 * in JupyterLab and render them immediately in the browser using Vega-Lite,
 * without requiring any active Python kernel.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-bopp:plugin',
  description: 'Interactive Vega-Lite visualizer for BOPP JSON & MessagePack files',
  autoStart: true,
  optional: [IThemeManager],
  activate: (app: JupyterFrontEnd, themeManager: IThemeManager | null) => {
    console.log('JupyterLab extension jupyterlab-bopp is activated!');

    const factory = new BOPPWidgetFactory({
      name: 'BOPP Visualizer',
      fileTypes: ['bopp', 'bopp-msgpack'],
      defaultFor: ['bopp', 'bopp-msgpack'],
      themeManager
    });

    app.docRegistry.addWidgetFactory(factory);

    // Register .bopp and .bopp.msgpack file types
    app.docRegistry.addFileType({
      name: 'bopp',
      displayName: 'BOPP Annotation',
      extensions: ['.bopp', '.bopp.json'],
      mimeTypes: ['application/vnd.bopp+json', 'application/json'],
      iconClass: 'jp-MaterialIcon jp-AnalyticsIcon'
    });

    app.docRegistry.addFileType({
      name: 'bopp-msgpack',
      displayName: 'BOPP MessagePack',
      extensions: ['.bopp.msgpack', '.msgpack'],
      mimeTypes: ['application/vnd.bopp+msgpack', 'application/x-msgpack'],
      iconClass: 'jp-MaterialIcon jp-FileIcon'
    });
  }
};

export default plugin;
`,
    },
    widget: {
      filename: 'src/widget.ts',
      desc: 'Lumino DocumentWidget that decodes JSON/MessagePack client-side and renders Vega-Lite graphics into the DOM.',
      code: `import { DocumentWidget, DocumentRegistry } from '@jupyterlab/docregistry';
import { IThemeManager } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { decode as decodeMsgpack } from '@msgpack/msgpack';
import vegaEmbed from 'vega-embed';
import { buildBoppVegaLiteSpec, annotationToTabular } from './boppEngine';

export class BOPPWidget extends DocumentWidget<Widget> {
  private _themeManager: IThemeManager | null;

  constructor(context: DocumentRegistry.Context, themeManager: IThemeManager | null) {
    const content = new Widget();
    content.addClass('jp-BOPPViewer');
    super({ context, content });

    this._themeManager = themeManager;
    context.ready.then(() => {
      this.render();
    });

    // Re-render if model contents or JupyterLab theme changes
    context.model.contentChanged.connect(this.render, this);
    if (this._themeManager) {
      this._themeManager.themeChanged.connect(this.render, this);
    }
  }

  async render(): Promise<void> {
    const node = this.content.node;
    node.innerHTML = '<div class="jp-BOPP-loading">Loading BOPP annotation...</div>';

    try {
      const model = this.context.model;
      let annotation: any;

      if (this.context.path.endsWith('.msgpack')) {
        // Read raw bytes using base64 or arraybuffer
        const rawBase64 = (model as any).toBase64 ? (model as any).toBase64() : '';
        const binaryStr = atob(rawBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        annotation = decodeMsgpack(bytes);
      } else {
        annotation = JSON.parse(model.toString());
      }

      // Convert to tabular representation
      const tabular = annotationToTabular(annotation);

      // Determine JupyterLab dark or light mode
      const isDark = this._themeManager ? this._themeManager.isLight(this._themeManager.theme) === false : false;

      // Build Vega-Lite specification tailored to Extent + Payload + Confidence
      const spec = buildBoppVegaLiteSpec(annotation, tabular, {
        theme: isDark ? 'dark' : 'light',
        enableOverviewBrush: true,
        enableZoomPan: true
      });

      node.innerHTML = '';
      const chartContainer = document.createElement('div');
      chartContainer.style.width = '100%';
      chartContainer.style.height = '100%';
      node.appendChild(chartContainer);

      await vegaEmbed(chartContainer, spec as any, {
        actions: { export: true, source: false, compiled: false, editor: false },
        renderer: 'canvas'
      });
    } catch (err: any) {
      node.innerHTML = \`<div class="jp-BOPP-error">
        <h4>Failed to render BOPP file</h4>
        <pre>\${err.message}</pre>
      </div>\`;
    }
  }
}

export class BOPPWidgetFactory extends DocumentRegistry.ABCWidgetFactory<BOPPWidget> {
  private _themeManager: IThemeManager | null;

  constructor(options: DocumentRegistry.IWidgetFactoryOptions & { themeManager: IThemeManager | null }) {
    super(options);
    this._themeManager = options.themeManager;
  }

  protected createNewWidget(context: DocumentRegistry.Context): BOPPWidget {
    return new BOPPWidget(context, this._themeManager);
  }
}
`,
    },
    package: {
      filename: 'package.json',
      desc: 'npm package manifest defining JupyterLab 4 / 3 extension metadata, scripts, and dependencies.',
      code: `{
  "name": "jupyterlab-bopp",
  "version": "1.0.0",
  "description": "JupyterLab plugin to visualize BOPP JSON & MessagePack files via Vega-Lite without a kernel",
  "keywords": [
    "jupyter",
    "jupyterlab",
    "jupyterlab-extension",
    "bopp",
    "audio-annotation",
    "vega-lite",
    "music-information-retrieval"
  ],
  "author": "Brian McFee / BOPP Community",
  "license": "BSD-3-Clause",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "style": "style/index.css",
  "files": [
    "lib/**/*.{d.ts,eot,gif,html,jpg,js,js.map,json,png,svg,woff2,ttf}",
    "style/**/*.{css,js,eot,gif,html,jpg,json,png,svg,woff2,ttf}"
  ],
  "jupyterlab": {
    "extension": true,
    "outputDir": "jupyterlab_bopp/labextension"
  },
  "scripts": {
    "build": "jlpm build:lib && jlpm build:labextension:dev",
    "build:prod": "jlpm clean && jlpm build:lib:prod && jlpm build:labextension",
    "build:labextension": "jupyter labextension build .",
    "build:labextension:dev": "jupyter labextension build --development True .",
    "build:lib": "tsc --sourceMap",
    "build:lib:prod": "tsc",
    "clean": "jlpm clean:lib && jlpm clean:labextension",
    "clean:lib": "rimraf lib tsconfig.tsbuildinfo",
    "clean:labextension": "rimraf jupyterlab_bopp/labextension",
    "watch": "run-p watch:src watch:labextension",
    "watch:src": "tsc -w --sourceMap",
    "watch:labextension": "jupyter labextension watch ."
  },
  "dependencies": {
    "@jupyterlab/application": "^4.0.0",
    "@jupyterlab/apputils": "^4.0.0",
    "@jupyterlab/docregistry": "^4.0.0",
    "@lumino/widgets": "^2.0.0",
    "@msgpack/msgpack": "^3.1.0",
    "vega": "^5.25.0",
    "vega-lite": "^5.16.0",
    "vega-embed": "^6.22.0"
  },
  "devDependencies": {
    "@jupyterlab/builder": "^4.0.0",
    "rimraf": "^5.0.0",
    "npm-run-all": "^4.1.5",
    "typescript": "~5.2.0"
  }
}
`,
    },
    readme: {
      filename: 'README.md',
      desc: 'Building, packaging, local installation, and usage instructions for JupyterLab.',
      code: `# jupyterlab-bopp

An interactive file viewer plugin for **BOPP** ([Bounded Observation Payload Protocol](https://github.com/bmcfee/bopp)) data in **JupyterLab**.

## Features

- **No Backend Kernel Required**: Double-click any \`.bopp\`, \`.bopp.msgpack\`, or \`.bopp.json\` file directly in JupyterLab. Renders client-side via Vega-Lite without a Python kernel.
- **MessagePack & JSON Support**: High-performance client-side decoding of MessagePack binary and JSON structures.
- **Vega-Lite Compositions**: Maps extents (intervals, time-frequency boxes, score quarters, global) with payloads (chords, 24-tonic key modulations, radial circle-of-fifths, MIDI piano roll, F0 contours).
- **Interactive Audio Sonification**: Preview chord progressions, beats, and pitch contours with the Web Audio API.

## Building & Installing Locally

### Prerequisites
- Python >= 3.8
- JupyterLab >= 4.0.0
- Node.js >= 18.0.0 and jlpm

\`\`\`bash
pip install "jupyterlab>=4.0.0" build hatchling
\`\`\`

### Option 1: Local Development Installation (Editable)
\`\`\`bash
# Install package in editable mode
pip install -e .

# Symlink labextension assets into JupyterLab environment
jupyter labextension develop . --overwrite

# Build the extension TypeScript library
jlpm run build

# Verify installation
jupyter labextension list
\`\`\`

### Option 2: Build & Package Standalone Python Wheel (.whl)
\`\`\`bash
# 1. Clean previous build output
jlpm clean

# 2. Build production assets
jlpm build:prod

# 3. Build Python distribution packages (wheel and tar.gz)
python -m build

# 4. Install the packaged wheel locally
pip install dist/jupyterlab_bopp-1.0.0-py3-none-any.whl

# 5. Verify the extension is active
jupyter labextension list
\`\`\`

### Live Development Watch Mode
\`\`\`bash
# In terminal 1: Watch TypeScript source files
jlpm watch

# In terminal 2: Run JupyterLab in watch mode
jupyter lab --watch
\`\`\`

### Launch JupyterLab
\`\`\`bash
jupyter lab
\`\`\`
Double-click any \`.bopp\` or \`.bopp.msgpack\` file to launch the interactive viewer!
`,
    },
  };

  const currentFile = files[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900 overflow-y-auto p-6 space-y-6 text-xs">
      {/* Extension Overview Hero */}
      <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900 rounded space-y-2">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            JupyterLab Plugin Architecture: Kernel-Free Browser Rendering
          </h3>
        </div>
        <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
          In JupyterLab, rendering specialized file formats like BOPP without launching a heavy Python backend kernel is achieved via the <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">DocumentRegistry.IWidgetFactory</code> system.
          When a user double-clicks a <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded">.bopp</code> or <code className="bg-white/80 dark:bg-neutral-800 px-1 py-0.5 rounded">.bopp.msgpack</code> file in the JupyterLab file tree, the factory instantiates a Lumino Widget, unpacks the JSON or MessagePack payload directly in client JavaScript/WASM, and compiles the Vega-Lite specification onto the browser canvas.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3 text-neutral-700 dark:text-neutral-300">
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white/70 dark:bg-neutral-900/70 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800">
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span>pip install jupyterlab-bopp</span>
          </div>
          <a
            href="https://github.com/bmcfee/bopp"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
          >
            <span>BOPP GitHub Repository</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Code Browser */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded overflow-hidden flex flex-col">
        {/* Tab selection */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(['index', 'widget', 'package', 'readme'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                {files[tab].filename}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy File'}</span>
          </button>
        </div>

        {/* File Description */}
        <div className="px-4 py-2 bg-neutral-50/70 dark:bg-neutral-850/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-[11px]">
          {currentFile.desc}
        </div>

        {/* Code Content */}
        <pre className="p-4 bg-neutral-900 text-neutral-100 font-mono text-[11px] overflow-auto max-h-[460px] leading-relaxed">
          {currentFile.code}
        </pre>
      </div>
    </div>
  );
};
