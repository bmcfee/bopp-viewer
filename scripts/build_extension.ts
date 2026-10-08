/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab Extension Bundler Script
 * Prepares jupyterlab_bopp/labextension assets and manifests
 * for `pip install -e .` and `jupyter-builder develop .`
 */

import fs from 'node:fs';
import path from 'node:path';

function prepareLabExtension() {
  const rootDir = process.cwd();
  const distDir = path.resolve(rootDir, 'dist');
  const pyPkgDir = path.resolve(rootDir, 'jupyterlab_bopp');
  const labextDir = path.resolve(pyPkgDir, 'labextension');
  const staticDir = path.resolve(labextDir, 'static');

  console.log('[JupyterLab Bundler] Setting up jupyterlab_bopp/labextension...');

  fs.mkdirSync(staticDir, { recursive: true });

  // 1. Copy built dist assets into labextension/static if dist exists
  if (fs.existsSync(distDir)) {
    const copyRecursive = (src: string, dest: string) => {
      for (const item of fs.readdirSync(src)) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    copyRecursive(distDir, staticDir);
    console.log('[JupyterLab Bundler] Copied compiled bundle assets to labextension/static/');
  }

  // 2. Create jupyterlab_bopp/package.json with @jupyter/builder devDependency
  // This ensures that if jupyter-builder inspects the Python package directory directly,
  // it finds the declared @jupyter/builder devDependency and never raises ValueError.
  const pyPkgPackageJson = {
    name: 'jupyterlab-bopp',
    version: '1.0.0',
    description: 'JupyterLab extension and interactive Vega-Lite visualizer for BOPP annotations',
    keywords: ['jupyter', 'jupyterlab', 'jupyterlab-extension'],
    devDependencies: {
      '@jupyter/builder': '^1.2.3',
      '@jupyterlab/builder': '^4.5.11',
    },
    jupyterlab: {
      extension: true,
      outputDir: 'labextension',
    },
  };
  fs.writeFileSync(
    path.join(pyPkgDir, 'package.json'),
    JSON.stringify(pyPkgPackageJson, null, 2) + '\n',
    'utf-8'
  );

  // 3. Create jupyterlab_bopp/labextension/package.json
  const labextPackageJson = {
    name: 'jupyterlab-bopp',
    version: '1.0.0',
    description: 'JupyterLab extension and interactive Vega-Lite visualizer for BOPP annotations',
    jupyterlab: {
      extension: true,
      outputDir: 'labextension',
      _build: {
        load: 'static/index.html',
      },
    },
  };
  fs.writeFileSync(
    path.join(labextDir, 'package.json'),
    JSON.stringify(labextPackageJson, null, 2) + '\n',
    'utf-8'
  );

  // 4. Create jupyterlab_bopp/labextension/install.json
  const installJson = {
    packageManager: 'python',
    packageName: 'jupyterlab_bopp',
    uninstallInstructions: 'Use your Python package manager (pip, conda, etc.) to uninstall jupyterlab_bopp',
  };
  fs.writeFileSync(
    path.join(labextDir, 'install.json'),
    JSON.stringify(installJson, null, 2) + '\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(rootDir, 'install.json'),
    JSON.stringify(installJson, null, 2) + '\n',
    'utf-8'
  );

  console.log('[JupyterLab Bundler] Successfully generated jupyterlab_bopp/labextension manifests.');
}

prepareLabExtension();
