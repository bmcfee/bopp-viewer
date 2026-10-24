# BOPP Interactive Visualizer, JupyterLab Extension & CLI

An interactive browser visualizer, JupyterLab 4 extension, and standalone command-line viewer for **BOPP** ([Bounded Observation Payload Protocol](https://github.com/bmcfee/bopp)) music and audio annotation data.

This project renders BOPP JSON (`.bopp`, `.bopp.json`) and binary MessagePack (`.bopp.msgpack`, `.msgpack`) files dynamically using **Vega-Lite v6** without requiring an active Python kernel. It also provides Web Audio API sonification, synchronized playhead scrubbing, audio spectrogram overlays, optical sheet music overlays, and schema validation.

---

## Overview of Components

| Component | Description | Prerequisites |
| :--- | :--- | :--- |
| **1. Web Demo App** | Interactive SPA with 24 built-in sample datasets, live Vega-Lite spec editor, schema validator, and audio/image media linking. | Node.js ≥ 20, npm ≥ 9 |
| **2. JupyterLab 4 Extension (`jupyterlab-bopp`)** | Kernel-free file viewer for `.bopp` / `.msgpack` files and notebook cell MIME renderer (`application/vnd.bopp+json`, `application/vnd.bopp+msgpack`). | Python ≥ 3.8, JupyterLab ≥ 4.0 *(+ Node.js ≥ 20 & npm ≥ 9 if building from source)* |
| **3. Standalone CLI (`boppview`)** | Zero-configuration terminal utility that serves any local BOPP file in the browser without launching JupyterLab. | Python ≥ 3.8 *(installed automatically with `jupyterlab-bopp`)* |

---

## 1. Interactive Web Demo App

### Install Dependencies
```bash
npm install
```

### Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build & Preview Production SPA Bundle
```bash
npm run build
npm run preview
```
The static SPA output is written to `dist/`.

---

## 2. JupyterLab 4 Extension & Python Package (`jupyterlab-bopp`)

Installing the Python package provides **both** the prebuilt JupyterLab 4 extension (`jupyterlab-bopp`) and the standalone `boppview` CLI tool.

### Option A: Install from Source (Local Use or Development)

Requires Python ≥ 3.8, `jupyterlab>=4.0.0`, `hatch-jupyter-builder>=0.5`, Node.js ≥ 20, and `npm`:

```bash
# 1. Install frontend dependencies and build extension & standalone bundles
npm install
npm run build

# 2. Install the Python package (and register the prebuilt labextension)
pip install -e .

# 3. Verify the extension is enabled in JupyterLab
jupyter labextension list
```

You should see:
```text
jupyterlab-bopp v1.0.0 enabled OK (python, jupyterlab_bopp)
```

> **Note:** Running `pip install .` or `pip install -e .` on a clean checkout will automatically run `npm install` and `npm run build` via `hatch-jupyter-builder` if `jupyterlab_bopp/labextension/package.json` does not yet exist, and will skip rebuilding if prebuilt assets are already present.

### Option B: Build & Install a Standalone Python Wheel (`.whl`)

To build a self-contained `.whl` that can be installed on machines **without** Node.js or `npm`:

```bash
# Build sdist and prebuilt wheel in dist/
python -m build

# Install the wheel into any Python >= 3.8 environment
pip install dist/jupyterlab_bopp-1.0.0-py3-none-any.whl
```

### Using in JupyterLab

Launch JupyterLab and double-click any `.bopp`, `.bopp.json`, `.bopp.msgpack`, or `.msgpack` file in the file browser:
```bash
jupyter lab
```

Python objects in notebooks can also render inline by implementing `_repr_mimebundle_()` returning `"application/vnd.bopp+json"` or `"application/vnd.bopp+msgpack"`.

### Uninstalling
```bash
pip uninstall jupyterlab_bopp
```

---

## 3. Standalone Command-Line Viewer (`boppview`)

Once `jupyterlab-bopp` is installed via `pip`, the `boppview` command is available directly in your terminal—no JupyterLab server or notebook kernel required.

### Usage
```bash
# Open a BOPP file in your default browser (auto-selects free port starting at 8000)
boppview path/to/annotations.bopp

# Specify port, bind address, or theme, or run headless without opening a browser
boppview beats.bopp.json --port 8080 --theme dark
boppview melody.msgpack --host 0.0.0.0 --port 9000 --no-browser

# Or invoke as a Python module
python -m jupyterlab_bopp path/to/annotations.bopp
```

### CLI Options
- `file`: Path to `.bopp`, `.bopp.json`, `.bopp.msgpack`, or `.msgpack` file.
- `-p, --port PORT`: Port to listen on (default: `8000`, or first available port).
- `-b, --host, --bind HOST`: Host/IP address to bind (default: `127.0.0.1`).
- `--no-browser`: Start the server without opening a browser tab automatically.
- `--theme {light,dark,system}`: Initial UI theme (default: `system`).
- `-v, --version`: Show package version and exit.

*(Optional)* Install `msgpack` (`pip install msgpack`) to enable server-side MessagePack inspection; binary `.msgpack` files are also decoded client-side in the browser automatically.

---

## 4. Development, Type Generation & Testing

```bash
# Regenerate TypeScript types from BOPP JSON schemas in schemas/
npm run generate:types

# Typecheck with TypeScript
npm run lint

# Run the automated test suite
npm test

# Watch and rebuild bundles during active development
npm run watch

# Clean all generated build artifacts and caches
npm run clean
```

---

## Supported BOPP Encodings & Features

| Extent Type | Payload Type | Vega-Lite Visualization | Sonification Support |
| :--- | :--- | :--- | :--- |
| `time_interval` / `score_interval` | `chord` | `mir_eval` Circle-of-Fifths timeline | Synthesized root triads / 7ths |
| `time` / `interval` | `key_mode` | 24-tonic pitch axis (C at bottom) | Circle-of-fifths colormaps |
| `none` (global) | `key_mode` | Two concentric donut plots (Outer: Major, Inner: Minor) | Harmonic mode inspection |
| `none` (global) | `tempo` | KPI callout gauge with reference track | Metronome pulse click |
| `none` (global) | `tag_open` | Labeled confidence bars or alphabetized badge grid | Metadata analysis |
| `none` (global) | `mood_thayer` | Russell-Thayer 2D circumplex: 2D Gaussian density heatmap with 1σ/2σ uncertainty bounds (variance) or scatter plot (discrete) | Affective inspection |
| `time` | `mood_thayer` | Dynamic 2D circumplex trajectory & V/A timeline | Continuous affect tracking |
| `time` | `beat` / `onset` | Metric downbeat / upbeat bar chart & transient rules | Audio click synthesizer |
| `time` / `midi_interval` / `score_interval` | `note_midi` / `note_hz` | Opaque piano roll with `mir_eval` pitch class | Polyphonic synth notes |
| `time` | `pitch_contour` | Continuous F0 trajectory with voiced state & ±1.96σ whiskers | Pure sine F0 synth (voiced only) |
| `time_frequency_box` | `tag_open` | Spectrogram-aligned TF bounding boxes | STFT spectrogram overlay & synth |
| `pixel_box` | `tag_open` | Document image bounding boxes | Visual sheet music overlay |

---

## License

BSD-3-Clause License. See [LICENSE](file:///home/bmcfee/git/bopp-viewer/LICENSE) for details.
