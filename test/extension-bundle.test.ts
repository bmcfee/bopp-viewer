import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('JupyterLab Extension Bundle & Manifest Verification', async (t) => {
  const rootDir = process.cwd();

  await t.test('1. package.json contains valid JupyterLab extension metadata', () => {
    const pkgPath = path.resolve(rootDir, 'package.json');
    assert.ok(fs.existsSync(pkgPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.strictEqual(pkg.name, 'jupyterlab-bopp');
    assert.ok(pkg.jupyterlab, 'package.json must have jupyterlab config');
    assert.strictEqual(pkg.jupyterlab.extension, true, 'jupyterlab.extension must be true');
    assert.strictEqual(pkg.jupyterlab.outputDir, 'jupyterlab_bopp/labextension');
    assert.strictEqual(pkg.main, 'lib/index.js');
    assert.strictEqual(pkg.types, 'src/extension/index.ts');
  });

  await t.test('2. Python package structure contains required Jupyter extension hooks', () => {
    const pyInitPath = path.resolve(rootDir, 'jupyterlab_bopp/__init__.py');
    assert.ok(fs.existsSync(pyInitPath), 'jupyterlab_bopp/__init__.py must exist');
    const pyInitContent = fs.readFileSync(pyInitPath, 'utf8');

    assert.ok(
      pyInitContent.includes('def _jupyter_labextension_paths():'),
      '__init__.py must define _jupyter_labextension_paths()'
    );
    assert.ok(
      pyInitContent.includes('"dest": "jupyterlab-bopp"'),
      'Destination must be jupyterlab-bopp'
    );
  });

  await t.test('3. pyproject.toml defines standard hatchling and hatch-jupyter-builder targets', () => {
    const pyprojectPath = path.resolve(rootDir, 'pyproject.toml');
    assert.ok(fs.existsSync(pyprojectPath), 'pyproject.toml must exist');
    const pyproject = fs.readFileSync(pyprojectPath, 'utf8');

    assert.ok(pyproject.includes('build-backend = "hatchling.build"'));
    assert.ok(pyproject.includes('"jupyterlab_bopp/labextension" = "share/jupyter/labextensions/jupyterlab-bopp"'));
    assert.ok(pyproject.includes('ensured-targets = [\n    "jupyterlab_bopp/labextension/package.json"'));
  });

  await t.test('4. lib/index.js bundled extension exists and contains extension identifier', () => {
    const libIndexPath = path.resolve(rootDir, 'lib/index.js');
    assert.ok(fs.existsSync(libIndexPath), 'lib/index.js must exist after build');
    const libContent = fs.readFileSync(libIndexPath, 'utf8');

    assert.ok(
      libContent.includes('jupyterlab-bopp:plugin'),
      'Bundled extension must contain plugin id jupyterlab-bopp:plugin'
    );
    assert.ok(
      libContent.includes('application/vnd.bopp+json'),
      'Bundled extension must register application/vnd.bopp+json'
    );
    assert.ok(
      libContent.includes('application/vnd.bopp+msgpack'),
      'Bundled extension must register application/vnd.bopp+msgpack'
    );
    assert.ok(
      libContent.includes('.bopp') && libContent.includes('.msgpack'),
      'Bundled extension must register .bopp and .msgpack file extensions'
    );
  });

  await t.test('5. jupyterlab_bopp/labextension prebuilt webpack assets and install.json exist', () => {
    const labextDir = path.resolve(rootDir, 'jupyterlab_bopp/labextension');
    assert.ok(fs.existsSync(labextDir), 'jupyterlab_bopp/labextension directory must exist');

    const labextPkg = path.resolve(labextDir, 'package.json');
    assert.ok(fs.existsSync(labextPkg), 'labextension package.json must exist');
    const pkgData = JSON.parse(fs.readFileSync(labextPkg, 'utf8'));
    assert.strictEqual(pkgData.name, 'jupyterlab-bopp');

    const installJsonPath = path.resolve(labextDir, 'install.json');
    assert.ok(fs.existsSync(installJsonPath), 'labextension install.json must exist');
    const installData = JSON.parse(fs.readFileSync(installJsonPath, 'utf8'));
    assert.strictEqual(installData.packageManager, 'python');
    assert.strictEqual(installData.packageName, 'jupyterlab_bopp');

    const staticDir = path.resolve(labextDir, 'static');
    assert.ok(fs.existsSync(staticDir), 'labextension static directory must exist');
    const staticFiles = fs.readdirSync(staticDir);
    const remoteEntry = staticFiles.find(f => f.startsWith('remoteEntry') && f.endsWith('.js'));
    assert.ok(remoteEntry, 'Webpack Module Federation remoteEntry.*.js must be present in labextension/static');
  });
});
