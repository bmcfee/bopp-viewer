# BOPP Interactive Visualizer & JupyterLab Extension

An interactive browser visualizer and JupyterLab extension for **BOPP** ([Bounded Observation Payload Protocol](https://github.com/bmcfee/bopp)) music and audio annotation data.

This project renders BOPP JSON (`.bopp`, `.bopp.json`) and MessagePack (`.bopp.msgpack`, `.msgpack`) files dynamically using **Vega-Lite**, without requiring an active Python kernel. It also provides Web Audio API sonification, synchronized playhead scrubbing, audio spectrogram overlays, and metadata validation.

---

## 1. Web Application Quickstart

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

### Install Dependencies
Dependencies have been updated and pinned to ensure clean peer dependency resolution without requiring `--legacy-peer-deps`:
```bash
npm install
```

### Run Locally (Dev Server)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build Production Bundle
```bash
npm run build
```
The compiled SPA output will be in `dist/`.

---

## 2. Building, Packaging & Installing as a JupyterLab Extension

The extension package (`jupyterlab-bopp`) registers a custom `DocumentWidgetFactory` in JupyterLab. When users double-click any `.bopp` or `.bopp.msgpack` file in the JupyterLab file browser, it opens and renders client-side with interactive Vega-Lite graphics and synchronized audio playback.

The package uses modern PEP 517/621 packaging via `pyproject.toml` with `hatchling` and `hatch-jupyter-builder`, maintaining full compatibility with `setup.cfg`/`setup.py`.

### Prerequisites
- Python ≥ 3.8
- JupyterLab ≥ 4.0.0
- Node.js ≥ 18.0.0 & `jlpm` (or `npm`)
- Modern packaging tools:
```bash
pip install "jupyterlab>=4.0.0" build hatchling "hatch-jupyter-builder>=0.5"
```

---

### Step A: Modern Local Development Installation (Editable)

In JupyterLab 4+, the legacy command `jupyter labextension develop` is deprecated in favor of **`jupyter-builder develop`** or a direct editable pip install with `hatch-jupyter-builder`:

```bash
# 1. Install frontend dependencies (provides @jupyter/builder and @jupyterlab/builder)
jlpm install # or npm install

# 2. Install package in editable mode (automatically builds extension assets via hatch-jupyter-builder)
pip install -e .

# 3. Symlink/develop extension in your JupyterLab environment using modern jupyter-builder:
jupyter-builder develop . --overwrite

# (Alternative if jupyter-builder CLI is not installed separately)
# pip install -e . automatically links labextension assets into share/jupyter/labextensions
```

Verify that the extension is detected and enabled:
```bash
jupyter labextension list
```
You should see:
```text
jupyterlab-bopp v1.0.0 enabled OK (python, jupyterlab_bopp)
```

Launch JupyterLab:
```bash
jupyter lab
```

---

### Step B: Building & Packaging a Standalone Wheel (`.whl`)

To package `jupyterlab_bopp` for distribution or installation on other machines without needing Node.js:

```bash
# 1. Clean previous build artifacts
npm run clean

# 2. Build Python source distribution (sdist) and prebuilt wheel (.whl)
# This automatically executes the frontend build via hatch-jupyter-builder
python -m build
```

This generates distribution packages in the `dist/` directory:
- `dist/jupyterlab_bopp-1.0.0-py3-none-any.whl` (Python Wheel containing prebuilt assets)
- `dist/jupyterlab_bopp-1.0.0.tar.gz` (Source Archive)

---

### Step C: Installing the Packaged Wheel Locally

Once the `.whl` is built, you can install it into any Python environment without Node.js or jlpm:

```bash
# Install the built wheel via pip
pip install dist/jupyterlab_bopp-1.0.0-py3-none-any.whl

# Confirm installation
jupyter labextension list
```

Now launch JupyterLab and open any BOPP file:
```bash
jupyter lab
```

---

### Step D: Live Development Watch Mode

When actively modifying extension source code:

```bash
# In terminal 1: Watch TypeScript and recompile on file save
npm run watch

# In terminal 2: Run JupyterLab in watch mode
jupyter lab --watch
```
Changes to `src/*.ts` will automatically trigger rebuilds and reload the browser tab.

---

### Step E: Uninstallation

To remove the extension from your local environment:

```bash
pip uninstall jupyterlab_bopp
```

---

## Supported BOPP Encodings & Features

| Extent Type | Payload Type | Vega-Lite Visualization | Sonification Support |
| :--- | :--- | :--- | :--- |
| `time_interval` | `chord` | Mir_eval Circle-of-Fifths timeline | Synthesized root triads / 7ths |
| `time` / `interval` | `key_mode` | 24-tonic pitch axis (C at bottom) | Circle-of-fifths colormaps |
| `none` (global) | `key_mode` | Radial Circle-of-Fifths clock (C at 12 o'clock) | Tonal center inspection |
| `none` (global) | `tempo` | KPI callout gauge with reference track | Metronome pulse click |
| `none` (global) | `tag_open` | Ranked horizontal frequency bar chart | Metadata analysis |
| `time` | `beat` | Metric downbeat / upbeat bar chart | Audio click synthesizer |
| `time` / `midi_interval`| `note_midi` | Opaque piano roll with mir_eval pitch class | Polyphonic synth notes |
| `time` | `pitch_contour` | Continuous F0 trajectory with voiced state | Pure sine F0 synth (voiced only) |
| `time_frequency_box` | `tag_open` | Spectrogram-aligned TF bounding boxes | STFT spectrogram overlay |
| `pixel_box` | `tag_open` | Document image bounding boxes | Visual sheet music overlay |

---

## License

BSD-3-Clause License. See [LICENSE](LICENSE) for details.
