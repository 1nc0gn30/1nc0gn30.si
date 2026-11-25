// 1nc0gn30.si — Deterministic U+2800 Braille & Ordered Bayer 4x4 / 8x8 Dither Engine
// Zero runtime dependencies. Works in browser (window.BrailleBayerEngine) and Node.js (CommonJS).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BrailleBayerEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Unicode U+2800 Braille 2x4 sub-pixel bitmask mapping:
  // Col 0: dot1=0x01, dot2=0x02, dot3=0x04, dot7=0x40
  // Col 1: dot4=0x08, dot5=0x10, dot6=0x20, dot8=0x80
  const BRAILLE_BITS = [
    [0x01, 0x08],
    [0x02, 0x10],
    [0x04, 0x20],
    [0x40, 0x80]
  ];

  const ASCII_RAMP = ' .:-=+*#%@';
  const BAYER_BLOCKS = [' ', '░', '▒', '▓', '█'];

  function generateBayerMatrix2D(size) {
    if (size === 2) {
      return [
        [0, 2],
        [3, 1]
      ];
    }
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error('Bayer matrix size must be a power of 2 >= 2');
    }
    const half = size >> 1;
    const prev = generateBayerMatrix2D(half);
    const out = Array.from({ length: size }, () => new Array(size));
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const v = prev[y][x] * 4;
        out[y][x] = v;
        out[y][x + half] = v + 2;
        out[y + half][x] = v + 3;
        out[y + half][x + half] = v + 1;
      }
    }
    return out;
  }

  function flattenMatrix(mat2d) {
    const size = mat2d.length;
    const flat = new Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        flat[y * size + x] = mat2d[y][x];
      }
    }
    return flat;
  }

  const BAYER_4X4_RAW = flattenMatrix(generateBayerMatrix2D(4));
  const BAYER_8X8_RAW = flattenMatrix(generateBayerMatrix2D(8));
  const BAYER_4X4 = BAYER_4X4_RAW.map(v => (v + 0.5) / 16);
  const BAYER_8X8 = BAYER_8X8_RAW.map(v => (v + 0.5) / 64);

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function sampleLuminance(rgba, width, height, x, y) {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    const idx = (cy * width + cx) * 4;
    const a = rgba[idx + 3] === undefined ? 1 : rgba[idx + 3] / 255;
    const lum = (rgba[idx] * 0.2126 + rgba[idx + 1] * 0.7152 + rgba[idx + 2] * 0.0722) / 255;
    return clamp01(lum * a);
  }

  function applyTone(lum, opts) {
    const contrast = opts && typeof opts.contrast === 'number' ? opts.contrast : 1.0;
    const threshold = opts && typeof opts.threshold === 'number' ? opts.threshold : 0.5;
    const invert = Boolean(opts && opts.invert);
    let v = (lum - 0.5) * contrast + 0.5 + (0.5 - threshold);
    if (invert) v = 1 - v;
    return clamp01(v);
  }

  function bayerThresholdAt(x, y, matrixKind) {
    if (matrixKind === 'bayer8') {
      return BAYER_8X8[(y & 7) * 8 + (x & 7)];
    }
    if (matrixKind === 'threshold') {
      return 0.5;
    }
    return BAYER_4X4[(y & 3) * 4 + (x & 3)];
  }

  function packBrailleBuffer(buf, cols, rows, opts) {
    const useEmptyBraille = opts && opts.blankChar === 'braille';
    const emptyCh = useEmptyBraille ? '\u2800' : ' ';
    const lines = new Array(rows);
    const pw = cols * 2;
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let mask = 0;
        for (let dy = 0; dy < 4; dy++) {
          const rowOff = (r * 4 + dy) * pw + c * 2;
          for (let dx = 0; dx < 2; dx++) {
            if (buf[rowOff + dx]) {
              mask |= BRAILLE_BITS[dy][dx];
            }
          }
        }
        line += mask ? String.fromCharCode(0x2800 + mask) : emptyCh;
      }
      lines[r] = line;
    }
    return lines.join('\n');
  }

  function rasterizeToBraille(rgba, width, height, opts) {
    const options = opts || {};
    const cols = Math.max(1, Math.floor(width / 2));
    const rows = Math.max(1, Math.floor(height / 4));
    const pw = cols * 2;
    const ph = rows * 4;
    const matrixKind = options.matrix || 'bayer4';
    const waveField = Boolean(options.waveField);
    const blankChar = options.blankChar || 'braille';
    const binary = new Uint8Array(pw * ph);

    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const rawLum = sampleLuminance(rgba, width, height, x, y);
        const wave = waveField
          ? 0.2 * Math.exp(-Math.abs((y / ph) * 2 - 1) * 2.1) * (0.5 + 0.5 * Math.sin(x * 0.28 + y * 0.35))
          : 0;
        const tone = applyTone(clamp01(rawLum + wave), options);
        const thr = bayerThresholdAt(x, y, matrixKind);
        if (tone > thr) {
          binary[y * pw + x] = 1;
        }
      }
    }

    const text = packBrailleBuffer(binary, cols, rows, { blankChar });
    return { text, cols, rows, pixelWidth: pw, pixelHeight: ph };
  }

  function rasterizeToBayerBlocks(rgba, width, height, opts) {
    const options = opts || {};
    const cols = Math.max(1, Math.floor(width / 2));
    const rows = Math.max(1, Math.floor(height / 4));
    const matrixKind = options.matrix === 'bayer8' ? 'bayer8' : 'bayer4';
    const waveField = Boolean(options.waveField);
    const lines = new Array(rows);

    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            sum += sampleLuminance(rgba, width, height, c * 2 + dx, r * 4 + dy);
          }
        }
        let avg = sum / 8;
        if (waveField) {
          avg = clamp01(avg + 0.16 * (0.5 + 0.5 * Math.sin(c * 0.45 + r * 0.8)));
        }
        const tone = applyTone(avg, options);
        const ditherOffset = (bayerThresholdAt(c, r, matrixKind) - 0.5) * 0.35;
        const idx = Math.min(4, Math.max(0, Math.round(clamp01(tone + ditherOffset) * 4)));
        line += BAYER_BLOCKS[idx];
      }
      lines[r] = line;
    }

    return { text: lines.join('\n'), cols, rows, pixelWidth: cols * 2, pixelHeight: rows * 4 };
  }

  function rasterizeToEdgeAscii(rgba, width, height, opts) {
    const options = opts || {};
    const cols = Math.max(1, Math.floor(width / 2));
    const rows = Math.max(1, Math.floor(height / 4));
    const waveField = Boolean(options.waveField);
    const lines = new Array(rows);

    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const x = c * 2 + 1;
        const y = r * 4 + 2;
        const lum = applyTone(sampleLuminance(rgba, width, height, x, y), options);
        const lumL = applyTone(sampleLuminance(rgba, width, height, x - 2, y), options);
        const lumR = applyTone(sampleLuminance(rgba, width, height, x + 2, y), options);
        const lumU = applyTone(sampleLuminance(rgba, width, height, x, y - 4), options);
        const lumD = applyTone(sampleLuminance(rgba, width, height, x, y + 4), options);
        const gx = lumR - lumL;
        const gy = lumD - lumU;
        const edge = Math.hypot(gx, gy);

        if (edge > 0.52) {
          const ax = Math.abs(gx);
          const ay = Math.abs(gy);
          if (ax > ay * 1.4) {
            line += '|';
          } else if (ay > ax * 1.4) {
            line += '=';
          } else {
            line += gx * gy > 0 ? '\\' : '/';
          }
        } else {
          const wave = waveField ? 0.14 * (0.5 + 0.5 * Math.cos(c * 0.4 - r * 0.7)) : 0;
          const v = clamp01(lum + wave);
          line += ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(v * (ASCII_RAMP.length - 1)))];
        }
      }
      lines[r] = line;
    }

    return { text: lines.join('\n'), cols, rows, pixelWidth: cols * 2, pixelHeight: rows * 4 };
  }

  function generateProceduralRGBA(preset, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    const cx = width * 0.5;
    const cy = height * 0.5;
    const minDim = Math.min(width, height) * 0.5;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = (x - cx) / Math.max(1, minDim);
        const ny = (y - cy) / Math.max(1, minDim);
        const r = Math.hypot(nx, ny);
        const ang = Math.atan2(ny, nx);
        let lum = 0;

        if (preset === 'rings') {
          const wave = 0.5 + 0.5 * Math.cos(r * 13.5 - Math.cos(ang * 3) * 0.9);
          const env = Math.exp(-r * r * 0.42);
          lum = wave * env;
        } else if (preset === 'cymatic') {
          const petals = 0.5 + 0.5 * Math.cos(ang * 6) * Math.sin(r * 9.5);
          const core = Math.exp(-Math.abs(r - 0.68) * 5.2) * 0.75;
          const center = Math.exp(-r * r * 3.8) * 0.95;
          lum = clamp01(petals * Math.exp(-r * 0.75) * 0.78 + core + center);
        } else {
          // Default 'torus': shaded 3D torus surface with directional specular light
          const major = 0.58;
          const minor = 0.29;
          const dRing = Math.abs(r - major);
          if (dRing <= minor) {
            const z = Math.sqrt(Math.max(0, minor * minor - dRing * dRing)) / minor;
            const nrx = (r - major) / minor;
            const nx3 = nrx * Math.cos(ang);
            const ny3 = nrx * Math.sin(ang);
            const nz3 = z;
            const diff = Math.max(0, nx3 * -0.45 + ny3 * -0.55 + nz3 * 0.70);
            const rim = Math.pow(1 - nz3, 2.2) * 0.42;
            const spec = Math.pow(Math.max(0, nz3 * 0.88 - ny3 * 0.46), 8) * 0.6;
            lum = clamp01(0.12 + diff * 0.78 + rim + spec);
          } else {
            lum = Math.exp(-Math.pow(dRing - minor, 2) * 28) * 0.16;
          }
        }

        const c = Math.round(clamp01(lum) * 255);
        const idx = (y * width + x) * 4;
        data[idx] = c;
        data[idx + 1] = c;
        data[idx + 2] = c;
        data[idx + 3] = 255;
      }
    }

    return data;
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSvgExport(text, opts) {
    const options = opts || {};
    const rows = String(text || '').split('\n');
    const maxCols = rows.reduce((m, line) => Math.max(m, line.length), 1);
    const fontSize = options.fontSize || 12;
    const charW = options.charW || 7.6;
    const lineH = options.lineH || 15;
    const padX = 18;
    const padY = 18;
    const bg = options.bg || '#050401';
    const fg = options.fg || '#f5b82e';
    const w = Math.max(240, Math.ceil(maxCols * charW + padX * 2));
    const h = Math.max(96, Math.ceil(rows.length * lineH + padY * 2));

    const nodes = rows
      .map(
        (row, idx) =>
          `  <text x="${padX}" y="${padY + fontSize + idx * lineH}" fill="${escapeXml(fg)}" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="${fontSize}px" xml:space="preserve">${escapeXml(row)}</text>`
      )
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="1nc0gn30 Unicode Braille and Bayer dither output">\n  <rect width="100%" height="100%" rx="8" fill="${escapeXml(bg)}"/>\n${nodes}\n</svg>`;
  }

  return {
    BRAILLE_BITS,
    BAYER_4X4_RAW,
    BAYER_8X8_RAW,
    BAYER_4X4,
    BAYER_8X8,
    ASCII_RAMP,
    BAYER_BLOCKS,
    generateBayerMatrix2D,
    sampleLuminance,
    applyTone,
    bayerThresholdAt,
    packBrailleBuffer,
    rasterizeToBraille,
    rasterizeToBayerBlocks,
    rasterizeToEdgeAscii,
    generateProceduralRGBA,
    escapeXml,
    buildSvgExport
  };
});
