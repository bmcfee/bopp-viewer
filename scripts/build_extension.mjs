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
  const coreMetaPackageJsonPath = path.join(coreMetaDir, 'package.json');
  const req = createRequire(path.resolve(rootDir, 'package.json'));

  let coreMetaContent = null;

  // 1. Try resolving via node module resolution (works across npm, yarn classic, and yarn PnP)
  try {
    const resolvedCoreMeta = req.resolve('@jupyterlab/core-meta/core.package.json');
    coreMetaContent = fs.readFileSync(resolvedCoreMeta, 'utf-8');
  } catch {
    try {
      const data = req('@jupyterlab/core-meta/core.package.json');
      coreMetaContent = JSON.stringify(data, null, 2);
    } catch {}
  }

  // 2. Direct filesystem lookup fallback
  if (!coreMetaContent) {
    const directPath = path.resolve(rootDir, 'node_modules/@jupyterlab/core-meta/core.package.json');
    if (fs.existsSync(directPath)) {
      coreMetaContent = fs.readFileSync(directPath, 'utf-8');
    }
  }

  // 3. Guaranteed valid fallback metadata with standard JupyterLab 4 singleton & shared packages
  if (!coreMetaContent) {
    const fallbackCoreMeta = {
      name: "@jupyterlab/application-top",
      version: "4.5.0",
      dependencies: {
        "@jupyterlab/application": "^4.0.0",
        "@jupyterlab/apputils": "^4.0.0",
        "@jupyterlab/docregistry": "^4.0.0",
        "@jupyterlab/rendermime": "^4.0.0",
        "@jupyterlab/rendermime-interfaces": "^3.0.0",
        "@lumino/widgets": "^2.0.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      resolutions: {},
      jupyterlab: {
        singletonPackages: [
          "@jupyterlab/application",
          "@jupyterlab/apputils",
          "@jupyterlab/docregistry",
          "@jupyterlab/rendermime",
          "@jupyterlab/rendermime-interfaces",
          "@lumino/algorithm",
          "@lumino/application",
          "@lumino/commands",
          "@lumino/coreutils",
          "@lumino/disposable",
          "@lumino/messaging",
          "@lumino/properties",
          "@lumino/signaling",
          "@lumino/virtualdom",
          "@lumino/widgets",
          "react",
          "react-dom"
        ],
        linkedPackages: {},
        staticDir: "../static"
      }
    };
    coreMetaContent = JSON.stringify(fallbackCoreMeta, null, 2);
  }

  // Always write the core package.json so --core-path resolution never fails
  fs.writeFileSync(coreMetaPackageJsonPath, coreMetaContent, 'utf-8');

  console.log('[JupyterLab Bundler] 3. Running build-labextension webpack compiler...');
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
  fs.writeFileSync(
    path.join(pyPkgDir, 'install.json'),
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

  console.log('[JupyterLab Bundler] 5. Bundling standalone boppview CLI viewer to jupyterlab_bopp/standalone/standalone.js...');
  const standaloneDir = path.resolve(pyPkgDir, 'standalone');
  fs.mkdirSync(standaloneDir, { recursive: true });
  const standaloneEntry = path.resolve(rootDir, 'src/standalone/index.ts');
  const standaloneOutput = path.resolve(standaloneDir, 'standalone.js');

  try {
    const esbuild = await import('esbuild');
    await esbuild.build({
      entryPoints: [standaloneEntry],
      bundle: true,
      minify: true,
      platform: 'browser',
      format: 'iife',
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      outfile: standaloneOutput,
    });
    console.log('[JupyterLab Bundler] Standalone boppview bundle created successfully');
  } catch (err) {
    console.error('[JupyterLab Bundler] Warning: Failed to bundle standalone script via esbuild import:', err?.message || err);
  }

  console.log('[JupyterLab Bundler] Build complete! Extension ready in jupyterlab_bopp/labextension');
}

prepareLabExtension().catch(err => {
  console.error('[JupyterLab Bundler] Build failed:', err);
  process.exit(1);
});

