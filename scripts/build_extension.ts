/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * JupyterLab Extension Bundler Script
 * 1. Bundles TypeScript extension into lib/index.js with esbuild
 * 2. Compiles Webpack Module Federation bundle into jupyterlab_bopp/labextension
 * 3. Generates install.json and Python package manifests
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function prepareLabExtension() {
  const rootDir = process.cwd();
  const pyPkgDir = path.resolve(rootDir, 'jupyterlab_bopp');
  const labextDir = path.resolve(pyPkgDir, 'labextension');
  const libDir = path.resolve(rootDir, 'lib');
  const coreMetaDir = path.resolve(rootDir, '.core-meta');

  console.log('[JupyterLab Bundler] 1. Bundling TypeScript extension to lib/index.js...');
  fs.mkdirSync(libDir, { recursive: true });

  // Use local esbuild binary
  const esbuildBin = path.resolve(rootDir, 'node_modules/.bin/esbuild');
  const extensionEntry = path.resolve(rootDir, 'src/extension/index.ts');
  const libOutput = path.resolve(libDir, 'index.js');

  const esbuildCmd = `"${esbuildBin}" "${extensionEntry}" --bundle --platform=browser --format=esm --external:@jupyterlab/* --external:@lumino/* --outfile="${libOutput}"`;
  execSync(esbuildCmd, { stdio: 'inherit', cwd: rootDir });

  console.log('[JupyterLab Bundler] 2. Preparing core-meta configuration...');
  fs.mkdirSync(coreMetaDir, { recursive: true });
  const corePkgJson = path.resolve(rootDir, 'node_modules/@jupyterlab/core-meta/core.package.json');
  if (fs.existsSync(corePkgJson)) {
    fs.copyFileSync(corePkgJson, path.join(coreMetaDir, 'package.json'));
  }

  console.log('[JupyterLab Bundler] 3. Running build-labextension webpack compiler...');
  const buildLabExtBin = path.resolve(rootDir, 'node_modules/.bin/build-labextension');
  const webpackCmd = `"${buildLabExtBin}" --core-path "${coreMetaDir}" "${rootDir}"`;
  execSync(webpackCmd, { stdio: 'inherit', cwd: rootDir });

  console.log('[JupyterLab Bundler] 4. Writing install.json and Python package metadata...');
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

  // Write jupyterlab_bopp/package.json with @jupyter/builder devDependency
  const pyPkgPackageJson = {
    name: 'jupyterlab-bopp',
    version: '1.0.0',
    description: 'JupyterLab extension and interactive Vega-Lite visualizer for BOPP annotations',
    keywords: ['jupyter', 'jupyterlab', 'jupyterlab-extension'],
    main: 'lib/index.js',
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

  console.log('[JupyterLab Bundler] Build complete! Extension ready in jupyterlab_bopp/labextension');
}

prepareLabExtension();
