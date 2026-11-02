// 1nc0gn30.si — vanilla JS, zero deps.
// 3D perspective Braille lattice + Infinite Animated 9-Pose 1nc0gn30 Character Loop + Digestible Tool Picker.
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduced');

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const BIT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
  const ASCII_CHARS = ' .:-=+*#%@⣿';

  const mouse = { x: 0.5, y: 0.5 };
  addEventListener('pointermove', e => {
    mouse.x = e.clientX / innerWidth;
    mouse.y = e.clientY / innerHeight;
  }, { passive: true });

  // ---- 1. Background 3D Perspective Braille Lattice ----
  function pack(buf, cols, rows) {
    let out = '';
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let b = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (buf[(r * 4 + dy) * cols * 2 + c * 2 + dx]) b |= BIT[dy][dx];
          }
        }
        line += b ? String.fromCharCode(0x2800 + b) : ' ';
      }
      out += line + '\n';
    }
    return out;
  }

  function cellSize(el) {
    const s = document.createElement('span');
    s.textContent = '⣿'.repeat(20);
    el.appendChild(s);
    const r = s.getBoundingClientRect();
    s.remove();
    return { w: r.width / 20 || 7, h: parseFloat(getComputedStyle(el).lineHeight) || 12 };
  }

  const lat = document.getElementById('lattice');
  let L = null;
  function setupLattice() {
    if (!lat) return;
    const cs = cellSize(lat), rect = lat.getBoundingClientRect();
    const cols = Math.max(10, Math.ceil(rect.width / cs.w));
    const rows = Math.max(10, Math.ceil(rect.height / cs.h));
    L = { cols, rows, W: cols * 2, H: rows * 4, buf: new Uint8Array(cols * 2 * rows * 4) };
  }

  const P = [], E = [], N = 3;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++)
      for (let k = 0; k <= N; k++)
        P.push([i / N * 2 - 1, j / N * 2 - 1, k / N * 2 - 1]);
  const id = (i, j, k) => (i * (N + 1) + j) * (N + 1) + k;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++)
      for (let k = 0; k <= N; k++) {
        if (i < N) E.push([id(i, j, k), id(i + 1, j, k)]);
        if (j < N) E.push([id(i, j, k), id(i, j + 1, k)]);
        if (k < N) E.push([id(i, j, k), id(i, j, k + 1)]);
      }

  function drawLattice(t) {
    if (!L) return;
    const { W, H, buf } = L;
    buf.fill(0);
    const ay = t * 0.00025 + (mouse.x - 0.5) * 1.2;
    const ax = 0.5 + (mouse.y - 0.5) * 0.8 + Math.sin(t * 0.0002) * 0.2;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const sc = Math.min(W, H) * 0.42, ox = W * 0.68, oy = H * 0.5;
    const pr = P.map(([x, y, z]) => {
      let X = x * cy - z * sy, Z = x * sy + z * cy, Y = y * cx - Z * sx;
      Z = y * sx + Z * cx;
      const f = 2.6 / (3.2 + Z);
      return [ox + X * sc * f, oy + Y * sc * f, (1.6 - Z) / 3.2];
    });
    for (const [a, b] of E) {
      const A = pr[a], B = pr[b], n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]));
      for (let s = 0; s <= n; s++) {
        const u = s / (n || 1), x = (A[0] + (B[0] - A[0]) * u) | 0, y = (A[1] + (B[1] - A[1]) * u) | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const I = A[2] + (B[2] - A[2]) * u;
        if (I > BAYER[(y & 3) * 4 + (x & 3)] * 0.9) buf[y * W + x] = 1;
      }
    }
    lat.textContent = pack(buf, L.cols, L.rows);
  }

  // ---- 2. Infinite Animated 1nc0gn30 Character Engine ----
  const canvas = document.getElementById('charCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const poseBtnLabel = document.getElementById('poseBtnLabel');

  const POSE_NAMES = ['hero', 'idle', 'front', 'three-quarter', 'side', 'back', 'walk', 'type', 'dissolve'];
  const LOOP_STEPS = [
    { pose: 'hero', flip: false, hold: 2200, label: 'hero' },
    { pose: 'type', flip: false, hold: 2100, label: 'type' },
    { pose: 'walk', flip: false, hold: 1900, label: 'walk' },
    { pose: 'dissolve', flip: false, hold: 2100, label: 'dissolve' },
    { pose: 'front', flip: false, hold: 1200, label: 'front' },
    { pose: 'three-quarter', flip: false, hold: 1100, label: '3/4' },
    { pose: 'side', flip: false, hold: 1100, label: 'side' },
    { pose: 'back', flip: false, hold: 1200, label: 'back' },
    { pose: 'side', flip: true, hold: 1100, label: 'side L' },
    { pose: 'three-quarter', flip: true, hold: 1100, label: '3/4 L' },
    { pose: 'idle', flip: false, hold: 1800, label: 'idle' }
  ];

  // Mode options when clicking "↻ auto loop": auto -> 360 spin -> hero -> type -> walk -> dissolve -> idle
  const POSE_MODES = [
    { id: 'auto', label: 'auto loop', steps: LOOP_STEPS },
    {
      id: 'spin',
      label: '360° spin',
      steps: [
        { pose: 'front', flip: false, hold: 900 },
        { pose: 'three-quarter', flip: false, hold: 900 },
        { pose: 'side', flip: false, hold: 900 },
        { pose: 'back', flip: false, hold: 900 },
        { pose: 'side', flip: true, hold: 900 },
        { pose: 'three-quarter', flip: true, hold: 900 }
      ]
    },
    { id: 'hero', label: 'pose: hero', steps: [{ pose: 'hero', flip: false, hold: 999999 }] },
    { id: 'type', label: 'pose: type', steps: [{ pose: 'type', flip: false, hold: 999999 }] },
    { id: 'walk', label: 'pose: walk', steps: [{ pose: 'walk', flip: false, hold: 999999 }] },
    { id: 'dissolve', label: 'pose: dissolve', steps: [{ pose: 'dissolve', flip: false, hold: 999999 }] },
    { id: 'idle', label: 'pose: idle', steps: [{ pose: 'idle', flip: false, hold: 999999 }] }
  ];

  let activeFx = 'hybrid'; // 'hybrid' | 'braille' | 'dither' | 'ascii' | 'lattice'
  let poseModeIdx = 0;
  let seqIndex = 0;
  let seqSwitchTime = performance.now();
  const TRANSITION_MS = 460;

  const poseBank = new Map();
  const CW = 760, CH = 720;
  const CELL_W = 6, CELL_H = 9;
  const GCOLS = Math.floor(CW / CELL_W);
  const GROWS = Math.floor(CH / CELL_H);

  function buildPoseEntry(name, img) {
    const off = document.createElement('canvas');
    off.width = CW;
    off.height = CH;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.imageSmoothingEnabled = false;

    const maxH = name === 'dissolve' ? 500 : 600;
    const maxW = name === 'dissolve' ? 670 : 520;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const dw = Math.round(img.naturalWidth * scale);
    const dh = Math.round(img.naturalHeight * scale);
    const dx = name === 'dissolve' ? Math.round((CW - dw) * 0.42) : Math.round((CW - dw) * 0.36);
    const dy = Math.round((CH - dh) * 0.48);

    octx.drawImage(img, dx, dy, dw, dh);
    const raw = octx.getImageData(0, 0, CW, CH);
    const d = raw.data;

    const ditherOff = document.createElement('canvas');
    ditherOff.width = CW;
    ditherOff.height = CH;
    const dctx = ditherOff.getContext('2d');
    const dImg = dctx.createImageData(CW, CH);
    const dd = dImg.data;

    const brailleOff = document.createElement('canvas');
    brailleOff.width = CW;
    brailleOff.height = CH;
    const bctx = brailleOff.getContext('2d');

    const PIX = 3;
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const i = (y * CW + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        if (lum < 0.042) {
          d[i + 3] = 0;
          continue;
        }
        d[i + 3] = Math.min(255, Math.round(lum * 1400));

        const bx = ((x / PIX) | 0) & 3;
        const by = ((y / PIX) | 0) & 3;
        const thr = BAYER[by * 4 + bx];
        const v = lum * 2.25 + (thr - 0.5) * 0.32;
        if (v < 0.15) {
          dd[i + 3] = 0;
        } else if (v < 0.42) {
          dd[i] = 138; dd[i + 1] = 101; dd[i + 2] = 20; dd[i + 3] = 255;
        } else if (v < 0.78) {
          dd[i] = 245; dd[i + 1] = 184; dd[i + 2] = 46; dd[i + 3] = 255;
        } else {
          dd[i] = 242; dd[i + 1] = 234; dd[i + 2] = 214; dd[i + 3] = 255;
        }
      }
    }
    octx.putImageData(raw, 0, 0);
    dctx.putImageData(dImg, 0, 0);

    const DOT_STEP = 3;
    for (let y = 0; y < CH; y += DOT_STEP) {
      for (let x = 0; x < CW; x += DOT_STEP) {
        const i = (y * CW + x) * 4;
        if (d[i + 3] < 20) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        const thr = BAYER[((y / DOT_STEP) & 3) * 4 + ((x / DOT_STEP) & 3)];
        const v = lum * 2.7;
        if (v <= thr * 0.75 + 0.04) continue;
        bctx.fillStyle = v > 0.95 ? '#f2ead6' : v > 0.42 ? '#f5b82e' : '#8a6514';
        bctx.fillRect(x, y, 2, 2);
      }
    }

    const asciiOff = document.createElement('canvas');
    asciiOff.width = CW;
    asciiOff.height = CH;
    const actx = asciiOff.getContext('2d');
    actx.font = 'bold 9px ui-monospace, "JetBrains Mono", monospace';

    const latticeOff = document.createElement('canvas');
    latticeOff.width = CW;
    latticeOff.height = CH;
    const lctx = latticeOff.getContext('2d');

    const cells = [];
    for (let gr = 0; gr < GROWS; gr++) {
      for (let gc = 0; gc < GCOLS; gc++) {
        let bits = 0, lumSum = 0, goldSum = 0;
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const px = gc * CELL_W + sx * 3 + 1;
            const py = gr * CELL_H + sy * 2 + 1;
            if (px >= CW || py >= CH) continue;
            const idx = (py * CW + px) * 4;
            if (d[idx + 3] < 20) continue;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2];
            const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
            lumSum += lum;
            goldSum += (r - b) / 255;
            if (Math.min(1, lum * 3.1) > BAYER[((gr * 4 + sy) & 3) * 4 + ((gc * 2 + sx) & 3)] + 0.07) {
              bits |= BIT[sy][sx];
            }
          }
        }
        if (bits > 0 || lumSum > 0.18) {
          const avgLum = lumSum / 8;
          const ch = String.fromCharCode(0x2800 + (bits || 0x24));
          const asciiIdx = Math.min(ASCII_CHARS.length - 1, Math.max(1, Math.floor(avgLum * 2.8 * (ASCII_CHARS.length - 1))));
          const asciiCh = ASCII_CHARS[asciiIdx];
          const tone = avgLum > 0.40 ? 2 : (avgLum > 0.16 || goldSum > 0.45 ? 1 : 0);
          const color = tone === 2 ? '#f2ead6' : tone === 1 ? '#f5b82e' : '#8a6514';

          actx.fillStyle = color;
          actx.fillText(asciiCh, gc * CELL_W, gr * CELL_H);

          if ((gr % 2 === 0 || gc % 2 === 0) && avgLum > 0.08) {
            lctx.fillStyle = color;
            lctx.fillRect(gc * CELL_W, gr * CELL_H, avgLum > 0.32 ? 3 : 2, avgLum > 0.32 ? 3 : 2);
            if (gr % 2 === 0) {
              lctx.fillStyle = 'rgba(245, 184, 46, 0.28)';
              lctx.fillRect(gc * CELL_W, gr * CELL_H, CELL_W, 1);
            }
            if (gc % 2 === 0) {
              lctx.fillStyle = 'rgba(245, 184, 46, 0.22)';
              lctx.fillRect(gc * CELL_W, gr * CELL_H, 1, CELL_H);
            }
          }

          if ((gc + gr) % 2 === 0) {
            cells.push({
              gc,
              gr,
              x: gc * CELL_W,
              y: gr * CELL_H,
              nx: (gc * CELL_W - dx) / Math.max(1, dw),
              ny: (gr * CELL_H - dy) / Math.max(1, dh),
              ch,
              asciiCh,
              tone,
              lum: avgLum,
              seed: ((gc * 73 + gr * 151) & 255) / 255
            });
          }
        }
      }
    }

    return { off, ditherOff, brailleOff, asciiOff, latticeOff, dx, dy, dw, dh, cells };
  }

  POSE_NAMES.forEach(name => {
    const im = new Image();
    im.onload = () => poseBank.set(name, buildPoseEntry(name, im));
    im.src = `assets/${name}.jpg`;
  });

  function renderPoseLayer(entry, flip, alpha, t, morphAmt) {
    if (!entry || !ctx) return;
    const bobY = Math.sin(t * 0.0032) * 4;
    const tiltX = (mouse.x - 0.5) * 14;
    const tiltY = (mouse.y - 0.5) * 8;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (activeFx === 'hybrid') {
      const dissolveFront = 0.56 + 0.16 * Math.sin(t * 0.0016) - morphAmt * 0.35;

      ctx.save();
      if (flip) {
        ctx.translate(CW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(entry.off, tiltX * 0.5, bobY + tiltY * 0.5);

      ctx.globalCompositeOperation = 'destination-in';
      const gradX0 = entry.dx + entry.dw * (dissolveFront - 0.12);
      const gradX1 = entry.dx + entry.dw * (dissolveFront + 0.22);
      const g = ctx.createLinearGradient(gradX0, 0, gradX1, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();

      ctx.font = 'bold 13px ui-monospace, "JetBrains Mono", monospace';
      for (let i = 0; i < entry.cells.length; i++) {
        const c = entry.cells[i];
        const nx = flip ? 1 - c.nx : c.nx;
        if (nx < dissolveFront - 0.18 && c.seed > 0.18 && morphAmt < 0.1) continue;

        const k = Math.max(0, nx - (dissolveFront - 0.1)) + morphAmt * 0.7;
        if (c.seed < k * 0.42) continue;

        const baseX = flip ? CW - c.x - CELL_W : c.x;
        const driftX = k * (48 + c.seed * 130) + Math.sin(t * 0.004 + c.gr * 0.3 + c.seed * 6) * (3 + k * 8);
        const driftY = bobY + Math.sin(t * 0.003 + c.seed * 9) * k * 14;

        ctx.fillStyle = c.tone === 2 ? '#f2ead6' : c.tone === 1 ? '#f5b82e' : '#8a6514';
        ctx.fillText(c.ch, baseX + driftX + tiltX * 0.5, c.y + driftY + tiltY * 0.5);
      }
    } else if (activeFx === 'braille') {
      ctx.save();
      if (flip) {
        ctx.translate(CW, 0);
        ctx.scale(-1, 1);
      }
      ctx.shadowColor = 'rgba(245, 184, 46, 0.45)';
      ctx.shadowBlur = 5;
      ctx.drawImage(entry.brailleOff, tiltX * 0.5, bobY + tiltY * 0.5);
      ctx.restore();

      ctx.font = 'bold 12px ui-monospace, "JetBrains Mono", monospace';
      for (let i = 0; i < entry.cells.length; i++) {
        const c = entry.cells[i];
        const nx = flip ? 1 - c.nx : c.nx;
        if (nx < 0.58 && morphAmt < 0.08) continue;
        const k = Math.max(0, nx - 0.58) + morphAmt * 0.6;
        if (c.seed < k * 0.35) continue;
        const baseX = flip ? CW - c.x - CELL_W : c.x;
        const dx = k * (45 + c.seed * 115) + Math.sin(t * 0.004 + c.gr * 0.25) * 4;
        const dy = bobY + Math.sin(t * 0.003 + c.seed * 10) * k * 12;
        ctx.fillStyle = c.tone === 2 ? '#f2ead6' : c.tone === 1 ? '#f5b82e' : '#8a6514';
        ctx.fillText(c.ch, baseX + dx + tiltX * 0.5, c.y + dy + tiltY * 0.5);
      }
    } else if (activeFx === 'dither') {
      ctx.save();
      if (flip) {
        ctx.translate(CW, 0);
        ctx.scale(-1, 1);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(entry.ditherOff, tiltX * 0.5, bobY + tiltY * 0.5);
      ctx.restore();

      for (let i = 0; i < entry.cells.length; i++) {
        const c = entry.cells[i];
        const nx = flip ? 1 - c.nx : c.nx;
        if (nx < 0.60 && morphAmt < 0.08) continue;
        const k = Math.max(0, nx - 0.60) + morphAmt * 0.6;
        const baseX = flip ? CW - c.x - CELL_W : c.x;
        const vx = baseX + k * (40 + c.seed * 120) + (((t * 0.06 + c.seed * 40) | 0) % 24);
        const vy = c.y + bobY + Math.sin(t * 0.003 + c.seed * 8) * k * 10;
        ctx.fillStyle = c.tone === 2 ? '#f2ead6' : c.tone === 1 ? '#f5b82e' : '#8a6514';
        ctx.fillRect(vx | 0, vy | 0, 4, 4);
      }
    } else if (activeFx === 'ascii') {
      ctx.save();
      if (flip) {
        ctx.translate(CW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(entry.asciiOff, tiltX * 0.5, bobY + tiltY * 0.5);
      ctx.restore();

      ctx.font = 'bold 11px ui-monospace, "JetBrains Mono", monospace';
      for (let i = 0; i < entry.cells.length; i++) {
        const c = entry.cells[i];
        const nx = flip ? 1 - c.nx : c.nx;
        if (nx < 0.56 && morphAmt < 0.08) continue;
        const k = Math.max(0, nx - 0.56) + morphAmt * 0.6;
        const baseX = flip ? CW - c.x - CELL_W : c.x;
        const dx = k * (42 + c.seed * 110) + (((t * 0.05 + c.seed * 30) | 0) % 18);
        const dy = bobY + Math.sin(t * 0.003 + c.seed * 9) * k * 10;
        const glyph = '01/>_#*@%'[(i + ((t * 0.008) | 0)) % 9];
        ctx.fillStyle = c.tone === 2 ? '#f2ead6' : c.tone === 1 ? '#f5b82e' : '#8a6514';
        ctx.fillText(glyph, baseX + dx + tiltX * 0.5, c.y + dy + tiltY * 0.5);
      }
    } else if (activeFx === 'lattice') {
      ctx.save();
      if (flip) {
        ctx.translate(CW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(entry.latticeOff, tiltX * 0.7, bobY + tiltY * 0.7);
      ctx.restore();

      const yaw = Math.sin(t * 0.002) * 0.32 + (mouse.x - 0.5) * 0.6;
      const sy = Math.sin(yaw);
      for (let i = 0; i < entry.cells.length; i++) {
        const c = entry.cells[i];
        const nx = flip ? 1 - c.nx : c.nx;
        const baseX = flip ? CW - c.x - CELL_W : c.x;
        const zShift = (c.lum - 0.2) * 90 * sy + (nx > 0.6 ? (nx - 0.6) * (35 + c.seed * 95) : 0);
        const px = baseX + zShift + tiltX * 0.7;
        const py = c.y + bobY + tiltY * 0.7;
        ctx.fillStyle = c.tone === 2 ? '#f2ead6' : c.tone === 1 ? '#f5b82e' : '#8a6514';
        ctx.fillRect(px | 0, py | 0, 3, 3);
      }
    }

    ctx.restore();
  }

  function drawCharacterStage(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, CW, CH);

    const mode = POSE_MODES[poseModeIdx];
    const seq = mode.steps;
    const step = seq[seqIndex % seq.length];
    const elapsed = t - seqSwitchTime;

    if (seq.length > 1 && elapsed >= step.hold) {
      seqIndex = (seqIndex + 1) % seq.length;
      seqSwitchTime = t;
    }

    const curStep = seq[seqIndex % seq.length];
    const curEntry = poseBank.get(curStep.pose);
    if (!curEntry) return;

    const curElapsed = t - seqSwitchTime;
    if (seq.length > 1 && curElapsed < TRANSITION_MS) {
      const prevStep = seq[(seqIndex - 1 + seq.length) % seq.length];
      const prevEntry = poseBank.get(prevStep.pose);
      const u = curElapsed / TRANSITION_MS;
      const ease = u * u * (3 - 2 * u);
      if (prevEntry) renderPoseLayer(prevEntry, prevStep.flip, 1 - ease, t, ease);
      renderPoseLayer(curEntry, curStep.flip, ease, t, 1 - ease);
    } else {
      renderPoseLayer(curEntry, curStep.flip, 1, t, 0);
    }
  }

  document.querySelectorAll('[data-fx]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-fx]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFx = btn.dataset.fx;
    });
  });

  function cyclePoseMode() {
    poseModeIdx = (poseModeIdx + 1) % POSE_MODES.length;
    seqIndex = 0;
    seqSwitchTime = performance.now();
    if (poseBtnLabel) poseBtnLabel.textContent = POSE_MODES[poseModeIdx].label;
  }

  const stepPoseBtn = document.getElementById('stepPoseBtn');
  const spriteStage = document.getElementById('spriteStage');
  if (stepPoseBtn) stepPoseBtn.addEventListener('click', cyclePoseMode);
  if (spriteStage) spriteStage.addEventListener('click', cyclePoseMode);

  // ---- 3. Digestible 8-Tool Picker (Real Tools from Zoth Studio) ----
  const TOOLS_BY_CAT = {
    popular: [
      ['Zoth ASCII Magic', 'image / video → braille & ascii', 'Convert images, video, or 3D models into sub-pixel Unicode Braille and 24-bit ANSI/HTML/SVG.', 'zoth-ascii-magic', 'zoth-ascii-magic'],
      ['JWT Inspector Guard', 'auth & crypto', 'Decode JWTs client-side, verify signatures, test HS256 weak secrets, and inspect DPoP claims.', 'jwt-inspector-guard', 'jwt-inspector-guard'],
      ['MCP Lens', 'mcp debugger', 'Inspect Model Context Protocol JSON-RPC traffic, validate tool schemas, and measure token weight.', 'mcp-lens', 'mcp-lens'],
      ['YARA-X & Sigma Forge', 'threat rules', 'Write and test YARA-X & Sigma detection rules with a byte-offset entropy radar and ATT&CK mapping.', 'yara-sigma-forge', 'yara-sigma-forge'],
      ['Nexus 3D Scene Studio', 'webgl & stl/obj', 'Generate mathematical 3D meshes, 4D tesseracts, and parametric surfaces with OBJ/STL export.', 'nexus-3d-scene-studio', 'nexus-3d-scene-studio'],
      ['Agent Prompt Firewall', 'llm defense', 'Test system prompts against prompt injection, jailbreaks, and PII leakage in the browser.', 'agent-prompt-firewall', 'agent-prompt-firewall'],
      ['Regex Droid', 'ast & redos check', 'Build regular expressions visually with railroad diagrams, multi-language codegen, and ReDoS checks.', 'regex-droid-builder', 'regex-droid-builder'],
      ['AudioCipher Stego', 'audio steganography', 'Hide encrypted payloads in WAV PCM LSB audio, decode DTMF tones, and synthesize Morse.', 'audiocipher-stego-engine', 'audiocipher-stego-engine']
    ],
    security: [
      ['Web Security Guard', 'headers & csp', 'Audit HTTP security headers, build strict CSP Level 3 policies, and compute SHA-384 SRI hashes.', 'web-security-guard', 'web-security-guard'],
      ['Payload Entropy Studio', 'binary analysis', 'Visualize 32-byte sliding-window Shannon entropy to spot packed, encrypted, or obfuscated sections.', 'payload-entropy-studio', 'payload-entropy-studio'],
      ['EnvGuard Secrets Vault', 'aes-256-gcm', 'Encrypt .env files in-browser with Argon2id + AES-256-GCM and split keys with Shamir quorum.', 'envguard-secrets-vault', 'envguard-secrets-vault'],
      ['Domain Intel OSINT Scout', 'dns & ct logs', 'Check Certificate Transparency logs, DoH DNS records, and SPF/DMARC posture for any domain.', 'osint-scout-skill', 'osint-scout-skill'],
      ['Agent Egress Sentinel', 'network policy', 'Design outbound firewall rules, SSRF guards, and TLS SNI allowlists for autonomous agents.', 'agent-egress-sentinel', 'agent-egress-sentinel'],
      ['Agent Capsule Jail', 'sandbox policy', 'Generate seccomp syscall filters, cgroup quotas, and sandbox profiles for local AI agents.', 'agent-capsule-jail', 'agent-capsule-jail'],
      ['Agent Policy Auditor', 'least privilege', 'Audit MCP tool permissions and generate least-privilege capability manifests.', 'agent-policy-auditor', 'agent-policy-auditor'],
      ['SubSweep Lead Scanner', 'passive recon', 'Run passive DNS discovery and tech-stack fingerprinting in the browser with zero cloud storage.', 'subsweep-lead-scanner', 'subsweep-lead-scanner']
    ],
    ai: [
      ['Vector Search Studio', 'hnsw + bm25', 'Run HNSW skip-graph vector search, IVF clustering, and BM25 + RRF hybrid ranking in your browser.', 'vector-search-engine', 'vector-search-engine'],
      ['PromptMaster Studio', 'prompt linter', 'Lint, structure, and compare prompts across Claude, GPT, and Gemini with token cost breakdowns.', 'promptmaster-studio', 'promptmaster-studio'],
      ['DeepSearch Agent', 'cited research', 'Run multi-source research workflows with inline citations and consensus matrices.', 'deepsearch-research-agent', 'deepsearch-research-agent'],
      ['Agent Flight Recorder', 'trace forensics', 'Scrub through hash-chained agent execution logs, tool calls, and memory state changes.', 'agent-flight-recorder', 'agent-flight-recorder'],
      ['Agent Budget Sentinel', 'token circuit breaker', 'Simulate multi-agent token spend and set hard circuit-breaker limits to stop runaway loops.', 'agent-budget-sentinel', 'agent-budget-sentinel'],
      ['Agent Mock Twin', 'offline ci mock', 'Replay deterministic LLM and OpenAPI tool responses offline so CI tests cost $0 in tokens.', 'agent-mock-twin', 'agent-mock-twin'],
      ['Agent Gods Eye', 'dag topology', 'Visualize multi-agent DAG dependencies, message bottlenecks, and cyclic deadlocks.', 'agent-gods-eye', 'agent-gods-eye'],
      ['WebMCP Protocol Suite', 'json-rpc 2.0', 'Test MCP server tool calls, prompts, and resources directly from a browser workbench.', 'webmcp-protocol-inspector', 'webmcp-protocol-inspector']
    ],
    creative: [
      ['Datamosh Glitch Studio', 'h.264 & crt fx', 'Corrupt video I-frames, apply chromatic aberration and Bayer dither, and export glitch clips.', 'datamosh-glitch-studio', 'datamosh-glitch-studio'],
      ['Cyber Turtle Studio', 'l-systems & g-code', 'Generate L-system fractals and vector turtle plots with SVG and CNC G-code export.', 'cyber-turtle-studio', 'cyber-turtle-studio'],
      ['UFO Sacred Geometry', 'parametric cad', 'Synthesize cymatic patterns and Metatron geometry with clean SVG, DXF, and OBJ exports.', 'ufo-sacred-geometry', 'ufo-sacred-geometry'],
      ['Reality Shader Forge', 'glsl & kde themes', 'Customize 60fps WebGL shaders and export matching KDE Plasma .colors, Alacritty, and CSS themes.', 'reality-shader-forge', 'reality-shader-forge'],
      ['Badge3D Coin Forge', '3d relief stl', 'Turn 2D SVG/PNG logos into watertight 3D relief coins and medallions ready for 3D printing.', 'badge3d-coin-generator', 'badge3d-coin-generator'],
      ['Vision Gesture Control', '21-joint hand track', 'Track 3D hand joints via webcam in the browser for touchless drawing and MIDI/MCP triggers.', 'vision-gesture-control', 'vision-gesture-control'],
      ['Zoth Scene Foundry', 'bayer pixel scenes', 'Browse and customize 1,000 deterministic ASCII and Bayer-dithered pixel-art scenes.', 'zoth-scene-foundry', 'zoth-scene-foundry'],
      ['Digital Asset Forge', '300 dpi print packs', 'Resize and package artwork into 300 DPI multi-ratio print ZIPs (2:3, 3:4, 4:5, ISO) in-browser.', 'digital-asset-forge', 'digital-asset-forge']
    ],
    dev: [
      ['Schema Illustrator', 'sql / prisma / ts', 'Draw database ER diagrams and transpile between SQL DDL, Prisma, TypeScript, Pydantic, and GraphQL.', 'schema-illustrator-studio', 'schema-illustrator-studio'],
      ['CronRhythm Studio', 'cron transpiler', 'Parse cron expressions, view a 24×7 run heatmap, and convert between systemd, K8s, and GitHub Actions.', 'cron-rhythm-studio', 'cron-rhythm-studio'],
      ['Polyglot Scaffolder', '13 frameworks', 'Convert UI components across React, Vue, Svelte, Astro, and Solid and download a ready ZIP.', 'polyglot-framework-exporter', 'polyglot-framework-exporter'],
      ['AEO Graph Engine', 'schema.org json-ld', 'Build and validate Schema.org @graph JSON-LD for WebApplication, FAQPage, and LocalBusiness.', 'aeo-graph-engine', 'aeo-graph-engine'],
      ['Robots.txt Auditor', 'rfc 9309 & ai bots', 'Test robots.txt rules against Googlebot, GPTBot, ClaudeBot, and PerplexityBot.', 'robots-txt-auditor', 'robots-txt-auditor'],
      ['CWV Speed Engine', 'core web vitals', 'Analyze DOM layout shifts, render-blocking assets, and generate optimized resource hints.', 'cwv-speed-engine', 'cwv-speed-engine'],
      ['PWA Manifest Studio', 'service worker zip', 'Generate manifest.json, offline ServiceWorker scripts, and app icon bundles in one click.', 'pwa-manifest-builder', 'pwa-manifest-builder'],
      ['Zoth WebGen', 'local site foundry', 'Scaffold static sites locally and deploy straight to Netlify from the command line or browser.', 'zoth-webgen', 'zoth-webgen']
    ]
  };

  const toolGrid = document.getElementById('toolGrid');
  function renderTools(cat) {
    if (!toolGrid) return;
    const list = TOOLS_BY_CAT[cat] || TOOLS_BY_CAT.popular;
    toolGrid.innerHTML = list.map(([name, tag, desc, id, repo]) => `
      <article class="tool-item">
        <div>
          <div class="tool-top">
            <h3>${name}</h3>
            <span class="tool-tag">${tag}</span>
          </div>
          <p>${desc}</p>
        </div>
        <div class="tool-foot">
          <a href="https://zoth.nullai.tech/tools/${id}">open in browser →</a>
          <a class="repo-link" href="https://github.com/1nc0gn30/${repo}">github ↗</a>
        </div>
      </article>
    `).join('');
  }

  document.querySelectorAll('.cat-tabs [data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tabs [data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTools(btn.dataset.cat);
    });
  });
  renderTools('popular');

  // Copy install command buttons
  document.querySelectorAll('.copy-cmd[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ copied command';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      }).catch(() => {});
    });
  });

  // ---- 4. Animation Loop (~30fps, paused when hidden) ----
  let visible = true, last = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  function frame(t) {
    if (visible && t - last > 33) {
      last = t;
      drawLattice(t);
      if (scrollY < innerHeight * 1.2) drawCharacterStage(t);
    }
    requestAnimationFrame(frame);
  }

  setupLattice();
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      setupLattice();
      if (reduced) drawLattice(0);
    }, 150);
  });
  requestAnimationFrame(frame);

  // ---- 5. Solana Tip Copy & Shell (`>_` / backtick) ----
  const copySolBtn = document.getElementById('copySolBtn');
  if (copySolBtn) {
    copySolBtn.addEventListener('click', () => {
      const addr = copySolBtn.dataset.sol;
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(addr).then(() => {
        const orig = copySolBtn.textContent;
        copySolBtn.textContent = '✓ copied ' + addr.slice(0, 8) + '...' + addr.slice(-4);
        setTimeout(() => { copySolBtn.textContent = orig; }, 1600);
      }).catch(() => {});
    });
  }

  const dlg = document.getElementById('term'), out = document.getElementById('termOut'), inp = document.getElementById('termIn');
  const say = s => { out.textContent += s + '\n'; out.scrollTop = out.scrollHeight; };
  const CMD = {
    help: () => 'cmds: whoami ls fx <hybrid|braille|dither|ascii|lattice> zoth zothos hermes nullai links tip clear exit',
    whoami: () => '1nc0gn30 · free tools for ai, security & the web.',
    ls: () => 'zoth-studio/ (72 tools)  zothos/ (43 stations)  hermes-zoth/  nullai/',
    fx: arg => {
      if (['hybrid', 'braille', 'dither', 'ascii', 'lattice'].includes(arg)) {
        activeFx = arg;
        document.querySelectorAll('[data-fx]').forEach(b => b.classList.toggle('active', b.dataset.fx === arg));
        return 'fx switched to ' + arg;
      }
      return 'usage: fx <hybrid|braille|dither|ascii|lattice>';
    },
    zoth: () => 'zoth studio: 72 tools (53 in-browser, 19 cli) → https://zoth.nullai.tech',
    zothos: () => 'zothos: debian 13 live iso · 43 workstations · 23 local daemons → https://zothos.nullai.tech',
    hermes: () => 'hermes-zoth v1.1.4: git clone https://github.com/1nc0gn30/hermes-zoth && cd hermes-zoth && ./install.sh',
    nullai: () => 'https://nullai.tech · everything free.',
    links: () => 'x.com/1nc0gn30 · github.com/1nc0gn30 · github.com/NullAITech',
    tip: () => 'stripe: https://buy.stripe.com/3cIfZg27PdKo2D64Ocfw40X · sol: GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK',
    sudo: () => 'nice try.',
    clear: () => { out.textContent = ''; return null; },
    exit: () => { dlg.close(); return null; }
  };

  function openTerm() {
    if (dlg.open) return;
    out.textContent = '1nc0gn30 shell · type help\n';
    dlg.showModal();
    inp.focus();
  }
  document.getElementById('termBtn').addEventListener('click', openTerm);
  addEventListener('keydown', e => {
    if (e.key === '`' && document.activeElement !== inp) {
      e.preventDefault();
      openTerm();
    }
  });
  document.getElementById('termForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = inp.value.trim().toLowerCase();
    inp.value = '';
    if (!v) return;
    say('$ ' + v);
    const parts = v.split(/\s+/);
    const f = CMD[parts[0]];
    const r = f ? f(parts[1]) : 'command not found: ' + v + ' (try help)';
    if (r) say(r);
  });
})();
