/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * High-Precision Spectrogram Generator Engine
 * Computes Short-Time Fourier Transform (STFT) from AudioBuffer and renders to HTML5 Canvas or PNG Data URL.
 * Designed to overlay directly underneath time-frequency annotations and pitch curves in Vega-Lite charts.
 */

// Simple in-place radix-2 Cooley-Tukey FFT
function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey butterfly computations
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepReal = Math.cos(angle);
    const wStepImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wReal = 1.0;
      let wImag = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const uReal = real[i + k];
        const uImag = imag[i + k];
        const vReal = real[i + k + halfLen] * wReal - imag[i + k + halfLen] * wImag;
        const vImag = real[i + k + halfLen] * wImag + imag[i + k + halfLen] * wReal;

        real[i + k] = uReal + vReal;
        imag[i + k] = uImag + vImag;
        real[i + k + halfLen] = uReal - vReal;
        imag[i + k + halfLen] = uImag - vImag;

        const nextWReal = wReal * wStepReal - wImag * wStepImag;
        wImag = wReal * wStepImag + wImag * wStepReal;
        wReal = nextWReal;
      }
    }
  }
}

export type SpectrogramColormap = 'magma' | 'viridis' | 'plasma' | 'inferno' | 'cividis';

/**
 * High-quality colormap lookups for spectrogram values [0..1]
 */
function interpolateColor(val: number, cmap: SpectrogramColormap): [number, number, number] {
  const t = Math.max(0, Math.min(1, val));

  if (cmap === 'viridis') {
    if (t < 0.25) {
      const u = t / 0.25;
      return [Math.floor(68 + u * (49 - 68)), Math.floor(1 + u * (104 - 1)), Math.floor(84 + u * (142 - 84))];
    } else if (t < 0.5) {
      const u = (t - 0.25) / 0.25;
      return [Math.floor(49 + u * (53 - 49)), Math.floor(104 + u * (183 - 104)), Math.floor(142 + u * (121 - 142))];
    } else if (t < 0.75) {
      const u = (t - 0.5) / 0.25;
      return [Math.floor(53 + u * (181 - 53)), Math.floor(183 + u * (222 - 183)), Math.floor(121 + u * (43 - 121))];
    } else {
      const u = (t - 0.75) / 0.25;
      return [Math.floor(181 + u * (253 - 181)), Math.floor(222 + u * (231 - 222)), Math.floor(43 + u * (37 - 43))];
    }
  }

  if (cmap === 'plasma') {
    if (t < 0.25) {
      const u = t / 0.25;
      return [Math.floor(13 + u * (106 - 13)), Math.floor(8 + u * (0 - 8)), Math.floor(135 + u * (168 - 135))];
    } else if (t < 0.5) {
      const u = (t - 0.25) / 0.25;
      return [Math.floor(106 + u * (204 - 106)), Math.floor(0 + u * (71 - 0)), Math.floor(168 + u * (120 - 168))];
    } else if (t < 0.75) {
      const u = (t - 0.5) / 0.25;
      return [Math.floor(204 + u * (240 - 204)), Math.floor(71 + u * (142 - 71)), Math.floor(120 + u * (75 - 120))];
    } else {
      const u = (t - 0.75) / 0.25;
      return [Math.floor(240 + u * (240 - 240)), Math.floor(142 + u * (249 - 142)), Math.floor(75 + u * (33 - 75))];
    }
  }

  if (cmap === 'inferno') {
    if (t < 0.25) {
      const u = t / 0.25;
      return [Math.floor(0 + u * (87 - 0)), Math.floor(0 + u * (16 - 0)), Math.floor(4 + u * (110 - 4))];
    } else if (t < 0.5) {
      const u = (t - 0.25) / 0.25;
      return [Math.floor(87 + u * (187 - 87)), Math.floor(16 + u * (55 - 16)), Math.floor(110 + u * (84 - 110))];
    } else if (t < 0.75) {
      const u = (t - 0.5) / 0.25;
      return [Math.floor(187 + u * (249 - 187)), Math.floor(55 + u * (142 - 55)), Math.floor(84 + u * (9 - 84))];
    } else {
      const u = (t - 0.75) / 0.25;
      return [Math.floor(249 + u * (252 - 249)), Math.floor(142 + u * (255 - 142)), Math.floor(9 + u * (164 - 9))];
    }
  }

  // Default: Magma (optimal dark mode scientific colormap)
  if (t < 0.25) {
    const u = t / 0.25;
    return [Math.floor(12 + u * 45), Math.floor(8 + u * 20), Math.floor(24 + u * 70)];
  } else if (t < 0.5) {
    const u = (t - 0.25) / 0.25;
    return [Math.floor(57 + u * 128), Math.floor(28 + u * 20), Math.floor(94 + u * 45)];
  } else if (t < 0.75) {
    const u = (t - 0.5) / 0.25;
    return [Math.floor(185 + u * 65), Math.floor(48 + u * 92), Math.floor(139 - u * 45)];
  } else {
    const u = (t - 0.75) / 0.25;
    return [Math.floor(250 + u * 5), Math.floor(140 + u * 112), Math.floor(94 + u * 155)];
  }
}

export interface SpectrogramRenderOptions {
  maxFreqHz?: number;
  minFreqHz?: number;
  width?: number;
  height?: number;
  fftSize?: number;
  hopSize?: number;
  colormap?: SpectrogramColormap;
}

/**
 * Computes STFT spectrogram and renders it directly onto an HTML5 Canvas
 */
export function renderAudioSpectrogram(
  audioBuffer: AudioBuffer,
  canvas: HTMLCanvasElement,
  options: SpectrogramRenderOptions = {}
) {
  const sampleRate = audioBuffer.sampleRate;
  const pcm = audioBuffer.getChannelData(0);
  const fftSize = options.fftSize || 512;
  const hopSize = options.hopSize || 256;
  const maxFreq = options.maxFreqHz || Math.min(8000, sampleRate / 2);
  const minFreq = Math.max(0, options.minFreqHz || 0);
  const colormap = options.colormap || 'magma';

  const numFrames = Math.floor((pcm.length - fftSize) / hopSize);
  if (numFrames <= 0) return;

  const numBins = fftSize / 2;
  const binFreqStep = sampleRate / fftSize;
  const minBin = Math.max(0, Math.floor(minFreq / binFreqStep));
  const maxBin = Math.min(numBins - 1, Math.max(minBin + 1, Math.ceil(maxFreq / binFreqStep)));
  const activeBins = Math.max(1, maxBin - minBin);

  // Set canvas dimensions
  const targetWidth = options.width || Math.min(1600, Math.max(400, numFrames));
  const targetHeight = options.height || 320;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Pre-calculate Hanning window
  const windowWeights = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    windowWeights[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Compute magnitudes and track peak dB
  const magnitudes = new Float32Array(numFrames * activeBins);
  let peakDb = -Infinity;

  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      real[i] = pcm[startIdx + i] * windowWeights[i];
      imag[i] = 0;
    }

    fft(real, imag);

    for (let b = 0; b < activeBins; b++) {
      const binIdx = minBin + b;
      const mag = Math.sqrt(real[binIdx] * real[binIdx] + imag[binIdx] * imag[binIdx]) + 1e-9;
      const db = 20 * Math.log10(mag);
      magnitudes[f * activeBins + b] = db;
      if (db > peakDb) peakDb = db;
    }
  }

  if (!isFinite(peakDb)) peakDb = 0;
  // Adaptive dynamic range: 65 dB below peak ensures crisp visibility without washed out background
  const dynamicRangeDb = 65;
  const floorDb = peakDb - dynamicRangeDb;

  // Create image data buffer
  const offscreen = document.createElement('canvas');
  offscreen.width = numFrames;
  offscreen.height = activeBins;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;

  const imgData = offCtx.createImageData(numFrames, activeBins);
  const data = imgData.data;

  // Fill image data (Y is inverted: lowest frequency at bottom, highest frequency at top)
  for (let f = 0; f < numFrames; f++) {
    for (let b = 0; b < activeBins; b++) {
      const y = activeBins - 1 - b; // invert Y
      const pixelIdx = (y * numFrames + f) * 4;
      const db = magnitudes[f * activeBins + b];
      const norm = Math.max(0, Math.min(1, (db - floorDb) / dynamicRangeDb));

      const [r, g, blue] = interpolateColor(norm, colormap);
      data[pixelIdx] = r;
      data[pixelIdx + 1] = g;
      data[pixelIdx + 2] = blue;
      data[pixelIdx + 3] = 255;
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Scale smoothly to target canvas dimensions
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen, 0, 0, targetWidth, targetHeight);
}

/**
 * Computes STFT spectrogram and returns a base64 PNG data URL
 * Suitable for direct embedding as a background image layer in Vega-Lite
 */
export function generateAudioSpectrogramDataUrl(
  audioBuffer: AudioBuffer,
  options: SpectrogramRenderOptions = {}
): string {
  const canvas = document.createElement('canvas');
  renderAudioSpectrogram(audioBuffer, canvas, options);
  return canvas.toDataURL('image/png');
}
