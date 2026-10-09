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
import { createRequire } from 'node:module';

async function prepareLabExtension() {
  const rootDir = process.cwd();
  const pyPkgDir = path.resolve(rootDir, 'jupyterlab_bopp');
  const labextDir = path.resolve(pyPkgDir, 'labextension');
  const libDir = path.resolve(rootDir, 'lib');
  const coreMetaDir = path.resolve(rootDir, '.core-meta');

  console.log('[JupyterLab Bundler] 1. Bundling TypeScript extension to lib/index.js...');
  fs.mkdirSync(libDir, { recursive: true });

  const extensionEntry = path.resolve(rootDir, 'src/extension/index.ts');
  const libOutput = path.resolve(libDir, 'index.js');

  // Use esbuild programmatic API directly so PATH and .bin inconsistencies across jlpm/yarn/npm never fail
  let bundled = false;
  try {
    const esbuild = await import('esbuild');
    await esbuild.build({
      entryPoints: [extensionEntry],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      external: ['@jupyterlab/*', '@lumino/*'],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      outfile: libOutput,
    });
    bundled = true;
  } catch (err) {
    console.warn('[JupyterLab Bundler] Programmatic esbuild failed, trying module-resolved binary:', err?.message || err);
  }

  if (!bundled) {
    // Attempt resolving esbuild executable through node module resolution
    const req = createRequire(path.resolve(rootDir, 'package.json'));
    try {
      const esbuildPkg = req.resolve('esbuild/package.json');
      const esbuildDir = path.dirname(esbuildPkg);
      const esbuildBin = path.join(esbuildDir, 'bin/esbuild');
      const binToUse = fs.existsSync(esbuildBin) ? esbuildBin : path.resolve(rootDir, 'node_modules/.bin/esbuild');
      const esbuildCmd = `"${binToUse}" "${extensionEntry}" --bundle --platform=browser --format=esm --define:process.env.NODE_ENV=\\"production\\" --external:@jupyterlab/* --external:@lumino/* --outfile="${libOutput}"`;
      execSync(esbuildCmd, { stdio: 'inherit', cwd: rootDir });
      bundled = true;
    } catch (fallbackErr) {
      console.error('[JupyterLab Bundler] Fatal: Could not bundle extension via esbuild:', fallbackErr);
      throw fallbackErr;
    }
  }

  console.log('[JupyterLab Bundler] 2. Preparing core-meta configuration...');
  fs.mkdirSync(coreMetaDir, { recursive: true });
  const corePkgJson = path.resolve(rootDir, 'node_modules/@jupyterlab/core-meta/core.package.json');
  if (fs.existsSync(corePkgJson)) {
    fs.copyFileSync(corePkgJson, path.join(coreMetaDir, 'package.json'));
  }

  console.log('[JupyterLab Bundler] 3. Running build-labextension webpack compiler...');
  const req = createRequire(path.resolve(rootDir, 'package.json'));
  let buildLabExtScript;
  try {
    buildLabExtScript = req.resolve('@jupyterlab/builder/lib/build-labextension.js');
  } catch {
    buildLabExtScript = path.resolve(rootDir, 'node_modules/@jupyterlab/builder/lib/build-labextension.js');
  }

  if (fs.existsSync(buildLabExtScript)) {
    const webpackCmd = `"${process.execPath}" "${buildLabExtScript}" --core-path "${coreMetaDir}" "${rootDir}"`;
    execSync(webpackCmd, { stdio: 'inherit', cwd: rootDir });
  } else {
    console.warn(`[JupyterLab Bundler] Warning: build-labextension.js not found at ${buildLabExtScript}, trying npx build-labextension`);
    execSync(`npx build-labextension --core-path "${coreMetaDir}" "${rootDir}"`, { stdio: 'inherit', cwd: rootDir });
  }

  console.log('[JupyterLab Bundler] 4. Writing install.json and Python package metadata...');
  fs.mkdirSync(labextDir, { recursive: true });
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

  const pyPkgPackageJson = {
    name: 'jupyterlab-bopp',
    version: '1.0.0',
    description: 'JupyterLab extension and interactive Vega-Lite visualizer for BOPP annotations',
    keywords: ['jupyter', 'jupyterlab', 'jupyterlab-extension'],
    main: 'lib/index.js',
    dependencies: {
      'process': '^0.11.10',
      'path-browserify': '^1.0.1'
    },
    devDependencies: {
      '@jupyter/builder': '^1.2.3',
      '@jupyterlab/builder': '^4.5.11',
    },
    jupyterlab: {
      extension: true,
      outputDir: 'labextension',
      webpackConfig: 'webpack.config.cjs'
    },
  };
  fs.writeFileSync(
    path.join(pyPkgDir, 'package.json'),
    JSON.stringify(pyPkgPackageJson, null, 2) + '\n',
    'utf-8'
  );

  console.log('[JupyterLab Bundler] Build complete! Extension ready in jupyterlab_bopp/labextension');
}

prepareLabExtension().catch(err => {
  console.error('[JupyterLab Bundler] Build failed:', err);
  process.exit(1);
});
