# BOPP Interactive Visualizer, JupyterLab Extension & CLI

An interactive browser visualizer, JupyterLab 4 extension, and standalone command-line viewer for **BOPP** ([Bounded Observation Payload Protocol](https://github.com/bmcfee/bopp)) music and audio annotation data.

This project renders BOPP JSON (`.bopp`, `.bopp.json`) and binary MessagePack (`.bopp.msgpack`, `.msgpack`) files dynamically using **Vega-Lite v6** without requiring an active Python kernel. It also provides Web Audio API sonification, synchronized playhead scrubbing, audio spectrogram overlays, optical sheet music overlays, and schema validation.

---

## Overview of Components

| Component | Description | Prerequisites |
| :--- | :--- | :--- |
| **1. Web Demo App** | Interactive SPA with 24 built-in sample datasets, live Vega-Lite spec editor, schema validator, and audio/image media linking. | Node.js ≥ 20, npm ≥ 9 |
| **2. JupyterLab 4 Extension (`jupyterlab-bopp`)** | Kernel-free file viewer for `.bopp` / `.msgpack` files and notebook cell MIME renderer (`application/vnd.bopp+json`, `application/vnd.bopp+msgpack`). | Python ≥ 3.13, JupyterLab ≥ 4.0 *(+ Node.js ≥ 20 & npm ≥ 9 if building from source)* |
| **3. Standalone CLI (`boppview`)** | Zero-configuration terminal utility that serves any local BOPP file in the browser without launching JupyterLab. | Python ≥ 3.13 *(installed automatically with `jupyterlab-bopp`)* |

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

Requires Python ≥ 3.13, `jupyterlab>=4.0.0`, `hatch-jupyter-builder>=0.5`, Node.js ≥ 20, and `npm`:

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

# Install the wheel into any Python >= 3.13 environment
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

## Supported BOPP Encodings & Matrices

### 1. Extent–Payload Support Matrix

The table below delineates supported visualization and interactive visual encodings across all 20 BOPP extents and payload schemas.

| Extent Family | Extent Types | `marker` / `beat` | `chord` | `key_mode` | `tempo` | `note` / `note_midi` | `frequency_hz` | `tag` | `lyrics` | `mood_thayer` | `object` / `relation` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Temporal Points** | `time`, `time_uniform` | Transient pulse & rules | Circle of Fifths ticks | 24-tonic mode ticks | Continuous step line | Ticks & SPN pitch marks | Continuous F0 trajectory | Event tag pins | Token timestamps | 2D circumplex trajectory | Event object markers |
| **Temporal Intervals** | `time_interval` | — | Overlapping Circle of 5ths bands | Split-color tonic/mode shelf | Horizontal tempo shelves | Polyphonic piano roll | Log-Hz piano roll | Disjoint / stacked intervals | Word span ribbon | Interval affect blocks | Interval entity spans |
| **Musical Metric Points** | `score_quarter`, `score_quarter_float`, `midi_tick` | Metric downbeat / beat bars | Beat chord events | Key change markers | Metric tempo markers | Metric score note marks | Metric pitch ticks | Metric tag ticks | Syllable metric offsets | Metric affect ticks | Metric score symbols |
| **Musical Metric Intervals** | `score_interval`, `score_interval_float`, `midi_interval` | — | Measure/beat chord blocks | Structural key regions | Metric tempo rubato shelves | Score / MIDI piano roll | MIDI pitch bands | Measure structural spans | Lyric score note spans | Section affect intervals | Measure grouping spans |
| **2D Spatial Coordinates** | `pixel`, `pixel_box` | Coordinate needles | Document chord stamps | Key signature boxes | — | Notehead centers / boxes | Stave pitch boxes | Document label bounding boxes | Text transcript word bounding boxes | Affective image regions | Spatial object detections |
| **3D Cartesian** | `cartesian`, `cartesian_time`, `cartesian_time_interval` | 3D transducer markers | Spatial acoustic chords | Harmonic acoustic modes | Velocity / tempo vectors | 3D pitch points | 3D acoustic pitch trajectories | 3D multi-view orthogonal projections (Top XY, Front XZ, Side YZ) | Spatial subtitle positions | Spatial emotion coordinates | 3D spatial entity clusters |
| **3D Spherical** | `spherical`, `spherical_time`, `spherical_time_interval` | Polar pulse markers | Ambisonic spatial chords | Polar modal zones | Polar speed trajectories | Ambisonic pitch points | Ambisonic pitch trajectories | Simultaneous 2D projections (Horizontal Polar Plan, DoA Map, Elevation Profile) | Directional speaker lyrics | Polar affect spheres | Spatial directional objects |
| **Time-Frequency** | `time_frequency_box` | — | Harmonic spectral bins | Key salience regions | Spectral periodicity | Polyphonic pitch boxes | Spectrogram frequency bounds | Bioacoustic bounding boxes | Formant word regions | Affective soundscape boxes | Spectrogram object masks |
| **Textual Offsets** | `text`, `text_interval` | Token start carets | Syllable chord tags | Modal section headings | Text tempo directives | SPN lyrics pitch labels | Pitch-accent text tags | Character boundary markers | Sequential reading spans & BCP 47 transcript reader | Textual affect spans | Named entity text spans |
| **Global / File-Level** | `none` (Omitted extent) | Downbeat summary | Global harmonic profile | Concentric tonic / relative donut | KPI gauge with audio pulse | Pitch histogram / ambitus | Pitch range summary | Badge cloud & confidence bars | Document language card | 2D Gaussian circumplex heatmap | Media metadata card |

---

### 2. Payload–Confidence Support Matrix

The table below summarizes supported uncertainty presentation channels for each payload type.

| Payload Type | `likelihood` (Activation $[0, 1]$) | `variance` (Gaussian $\sigma^2$) | `agreement` (Consensus Count $N$) | `none` (Deterministic) |
| :--- | :--- | :--- | :--- | :--- |
| **`marker`** | Bar height & point opacity | — | Rater count badge & agreement glyph | Crisp event needle |
| **`beat`** | Beat bar height & pulse opacity | — | Downbeat rater vote meter | Standard metric pulse |
| **`chord`** | Embedded top-edge meter / alpha fill | — | Annotator consensus badge & agreement meter | Solid chord band |
| **`key_mode`** | Embedded meter & outer ring opacity | — | Multi-annotator agreement badge | Solid modal split band |
| **`tempo`** | Meter gauge & level bar | Shaded $\pm 1.96\sigma$ CI band & whiskers | Rater estimate consensus | Clean step trajectory |
| **`note` / `note_midi`** | Embedded notehead meter & opacity | Pitch uncertainty whiskers | Transcription consensus vote | Opaque piano roll block |
| **`frequency_hz`** | Activation envelope ribbon & opacity | Shaded $\pm 1.96\sigma$ CI band & whiskers | Rater consensus F0 bounds | Voiced / unvoiced continuous line |
| **`tag`** | Embedded meter & bar length | — | Annotator count meter $[n / N]$ & Fleiss $\kappa$ | Solid categorical pill |
| **`lyrics`** | Word score meter & underline | — | Transcription crowd agreement | Solid transcript span pill |
| **`mood_thayer`** | Rater scatter opacity & radius | 2D bivariate Gaussian ellipses ($1\sigma, 2\sigma$) | Inter-rater valence/arousal agreement | Discrete trajectory line |
| **`object`** | Bounding box border opacity | Spatial covariance whiskers | Multi-annotator object consensus | Crisp vector box |
| **`relation`** | Edge weight & stroke opacity | — | Inter-rater graph consensus | Directed relational arc |

> [!NOTE]
> **Modulation via Groupings (Future Work)**
> The combinations detailed above represent direct first-order extent and payload bindings. In future work, BOPP groupings (`groupings` schema) will modulate these pairings—allowing hierarchical nesting (e.g. multi-level musical form), multi-voice polyphony, and multi-track entity alignments to be rendered as coordinated layered visualizers without altering the underlying extent-payload schemas.

---

## License

BSD-3-Clause License. See [LICENSE](file:///home/bmcfee/git/bopp-viewer/LICENSE) for details.
