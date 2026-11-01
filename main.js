// 1nc0gn30.si — vanilla JS, zero external dependencies.
// U+2800 2x4 Sub-Pixel Braille packer + 4x4 Ordered Bayer Dither + Interactive Character Rig & Shipped Index.
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduced');

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const BIT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
  const ASCII_RAMP = ' .:-=+*#%@';
  const POSES = ['hero', 'type', 'walk', 'dissolve', 'idle', 'front', 'three-quarter', 'side', 'back'];

  const mouse = { x: 0.5, y: 0.5 };
  addEventListener('pointermove', e => {
    mouse.x = e.clientX / innerWidth;
    mouse.y = e.clientY / innerHeight;
  }, { passive: true });

  // Pack a dot buffer (cols*2 x rows*4) into U+2800 Braille text
  function packBraille(buf, cols, rows) {
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

  // Pack a dot buffer (cols*2 x rows*4) into Bayer ASCII density
  function packAsciiFromDots(buf, cols, rows) {
    let out = '';
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (buf[(r * 4 + dy) * cols * 2 + c * 2 + dx]) sum++;
          }
        }
        const idx = Math.min(ASCII_RAMP.length - 1, Math.round((sum / 8) * (ASCII_RAMP.length - 1)));
        line += ASCII_RAMP[idx];
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
    return {
      w: r.width / 20 || 7,
      h: parseFloat(getComputedStyle(el).lineHeight) || 12
    };
  }

  // ---- 1. Live 3D Perspective Braille Lattice ----
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
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      for (let k = 0; k <= N; k++) {
        P.push([i / N * 2 - 1, j / N * 2 - 1, k / N * 2 - 1]);
      }
    }
  }
  const id = (i, j, k) => (i * (N + 1) + j) * (N + 1) + k;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      for (let k = 0; k <= N; k++) {
        if (i < N) E.push([id(i, j, k), id(i + 1, j, k)]);
        if (j < N) E.push([id(i, j, k), id(i, j + 1, k)]);
        if (k < N) E.push([id(i, j, k), id(i, j, k + 1)]);
      }
    }
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
      let X = x * cy - z * sy, Z = x * sy + z * cy;
      let Y = y * cx - Z * sx;
      Z = y * sx + Z * cx;
      const f = 2.6 / (3.2 + Z);
      return [ox + X * sc * f, oy + Y * sc * f, (1.6 - Z) / 3.2];
    });
    for (const [a, b] of E) {
      const A = pr[a], B = pr[b], n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]));
      for (let s = 0; s <= n; s++) {
        const u = s / (n || 1);
        const x = (A[0] + (B[0] - A[0]) * u) | 0;
        const y = (A[1] + (B[1] - A[1]) * u) | 0;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const I = A[2] + (B[2] - A[2]) * u;
        if (I > BAYER[(y & 3) * 4 + (x & 3)] * 0.9) buf[y * W + x] = 1;
      }
    }
    lat.textContent = packBraille(buf, L.cols, L.rows);
  }

  // ---- 2. Hero Sprite Dissolving into Braille / Bayer ASCII / Pixel Modes ----
  const ghost = document.getElementById('ghost');
  const heroFigure = document.getElementById('heroFigure');
  const img = document.getElementById('spriteImg');
  let heroMode = 'braille'; // 'braille' | 'ascii' | 'dither' | 'pixel'
  let heroPose = 'hero';
  let G = null;

  function setupGhost() {
    if (!img || !img.complete || !img.naturalWidth || !ghost) return;
    const fig = img.parentElement.getBoundingClientRect(), cs = cellSize(ghost);
    const cols = Math.max(16, Math.floor(fig.width / cs.w));
    const rows = Math.max(16, Math.floor(fig.height / cs.h));
    const w = cols * 2, h = rows * 4;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, dots = [];
    for (let y = 0; y < h; y++) {
      for (let X = 0; X < w; X++) {
        const i = (y * w + X) * 4;
        const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        if (Math.min(1, lum * 3.2) > BAYER[(y & 3) * 4 + (X & 3)] + 0.12) {
          dots.push([X, y, Math.random()]);
        }
      }
    }
    const TRAIL = 46;
    G = {
      cols: cols + TRAIL,
      rows,
      W: (cols + TRAIL) * 2,
      H: h,
      w,
      dots,
      buf: new Uint8Array((cols + TRAIL) * 2 * h)
    };
  }

  function drawGhost(t) {
    if (!G || heroMode === 'dither' || heroMode === 'pixel') return;
    const { W, H, w, buf, dots } = G;
    buf.fill(0);
    const fig = img.parentElement.getBoundingClientRect();
    const hover = Math.max(0, Math.min(1, (mouse.x * innerWidth - fig.left) / (fig.width || 1)));
    const scroll = Math.min(1, scrollY / (innerHeight * 0.8));
    const front = w * (1 - 0.55 * Math.max(scroll, 1 - hover * 0.9) * 0.9 - 0.12 * (1 + Math.sin(t * 0.0011)) / 2);
    for (const [x, y, r] of dots) {
      let X = x, Y = y;
      if (x > front) {
        const k = (x - front) / w;
        if (r < k * 0.55) continue;
        X = x + k * (40 + r * 90) + Math.sin(t * 0.003 + y * 0.2 + r * 6) * 2;
        Y = y + Math.sin(t * 0.002 + r * 9) * k * 6;
      }
      X |= 0;
      Y |= 0;
      if (X >= 0 && X < W && Y >= 0 && Y < H) buf[Y * W + X] = 1;
    }
    ghost.textContent = heroMode === 'ascii'
      ? packAsciiFromDots(buf, G.cols, G.rows)
      : packBraille(buf, G.cols, G.rows);
  }

  function setHeroPoseAndMode(pose, mode) {
    if (pose) heroPose = pose;
    if (mode) heroMode = mode;

    document.querySelectorAll('.stage-bar [data-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === heroMode);
    });
    document.querySelectorAll('.stage-bar [data-pose]').forEach(b => {
      b.classList.toggle('active', b.dataset.pose === heroPose);
    });

    const targetSrc = heroMode === 'dither'
      ? `assets/dither-${heroPose}.png`
      : `assets/${heroPose}.jpg`;

    if (heroMode === 'dither' || heroMode === 'pixel') {
      heroFigure.classList.add('show-img');
    } else {
      heroFigure.classList.remove('show-img');
    }

    if (!img.src.endsWith(targetSrc)) {
      img.onload = () => {
        setupGhost();
        drawGhost(performance.now());
      };
      img.src = targetSrc;
    } else {
      setupGhost();
      drawGhost(performance.now());
    }
  }

  document.querySelectorAll('.stage-bar [data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setHeroPoseAndMode(null, btn.dataset.mode));
  });
  document.querySelectorAll('.stage-bar [data-pose]').forEach(btn => {
    btn.addEventListener('click', () => setHeroPoseAndMode(btn.dataset.pose, null));
  });

  // ---- 3. Interactive 9-Pose Character Board & Braille / Bayer Dither Lab ----
  const poseCache = new Map();
  let labPose = 'hero';
  let labGain = 3.0;
  let labCols = 42;
  let preloadedSprites = null;

  fetch('assets/braille-sprites.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      preloadedSprites = data;
      renderLabSpecimen();
    })
    .catch(() => {});

  function loadPoseImage(pose) {
    if (poseCache.has(pose)) return Promise.resolve(poseCache.get(pose));
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => {
        poseCache.set(pose, im);
        resolve(im);
      };
      im.onerror = () => resolve(null);
      im.src = `assets/${pose}.jpg`;
    });
  }

  function compilePoseToBrailleAndAscii(im, cols, gain) {
    const aspect = im.naturalHeight / (im.naturalWidth || 1);
    const w = cols * 2;
    const rows = Math.max(8, Math.round((w * aspect) / 4));
    const h = rows * 4;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // 1. U+2800 Braille
    const buf = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
        if (Math.min(1, lum * gain) > BAYER[(y & 3) * 4 + (x & 3)] + 0.08) {
          buf[y * w + x] = 1;
        }
      }
    }
    const braille = packBraille(buf, cols, rows);

    // 2. Ordered Bayer 4x4 ASCII
    const asciiRows = Math.max(8, Math.round(cols * aspect * 0.5));
    const ca = document.createElement('canvas');
    ca.width = cols;
    ca.height = asciiRows;
    const ctxA = ca.getContext('2d', { willReadFrequently: true });
    ctxA.drawImage(im, 0, 0, cols, asciiRows);
    const dA = ctxA.getImageData(0, 0, cols, asciiRows).data;
    let ascii = '';
    for (let y = 0; y < asciiRows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const lum = (dA[i] * 0.3 + dA[i + 1] * 0.59 + dA[i + 2] * 0.11) / 255;
        const v = Math.min(1, Math.max(0, lum * (gain * 0.72) + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 0.25));
        const idx = Math.min(ASCII_RAMP.length - 1, Math.floor(v * (ASCII_RAMP.length - 1)));
        line += ASCII_RAMP[idx];
      }
      ascii += line.replace(/\s+$/, '') + '\n';
    }
    return { braille, ascii };
  }

  const labBrailleOut = document.getElementById('labBrailleOut');
  const labAsciiOut = document.getElementById('labAsciiOut');
  const labDitherImg = document.getElementById('labDitherImg');
  const activePoseLabel = document.getElementById('activePoseLabel');

  async function renderLabSpecimen() {
    if (!labBrailleOut || !labAsciiOut) return;
    activePoseLabel.textContent = labPose.toUpperCase();
    if (labDitherImg) {
      labDitherImg.src = `assets/dither-${labPose}.png`;
      labDitherImg.alt = `Ordered Bayer 4x4 dithered sprite for ${labPose} pose`;
    }
    const im = await loadPoseImage(labPose);
    if (im) {
      const { braille, ascii } = compilePoseToBrailleAndAscii(im, labCols, labGain);
      labBrailleOut.textContent = braille;
      labAsciiOut.textContent = ascii;
    } else if (preloadedSprites && preloadedSprites[labPose]) {
      labBrailleOut.textContent = preloadedSprites[labPose].braille_40;
      labAsciiOut.textContent = preloadedSprites[labPose].ascii_40;
    }
  }

  document.querySelectorAll('#poseGrid .pose-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#poseGrid .pose-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      labPose = card.dataset.pose;
      renderLabSpecimen();
      setHeroPoseAndMode(labPose, null);
    });
  });

  const gainRange = document.getElementById('gainRange');
  const gainVal = document.getElementById('gainVal');
  const colsRange = document.getElementById('colsRange');
  const colsVal = document.getElementById('colsVal');

  if (gainRange) {
    gainRange.addEventListener('input', () => {
      labGain = parseFloat(gainRange.value);
      gainVal.textContent = labGain.toFixed(1) + '×';
      renderLabSpecimen();
    });
  }
  if (colsRange) {
    colsRange.addEventListener('input', () => {
      labCols = parseInt(colsRange.value, 10);
      colsVal.textContent = String(labCols);
      renderLabSpecimen();
    });
  }

  // Specimen format tabs
  const specimenStage = document.getElementById('specimenStage');
  const specBrailleBox = document.getElementById('specBrailleBox');
  const specAsciiBox = document.getElementById('specAsciiBox');
  const specDitherBox = document.getElementById('specDitherBox');

  document.querySelectorAll('.specimen-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.specimen-tabs .tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const mode = tab.dataset.spec;
      if (mode === 'split') {
        specimenStage.classList.remove('single');
        specBrailleBox.classList.remove('hidden');
        specAsciiBox.classList.remove('hidden');
        specDitherBox.classList.add('hidden');
      } else if (mode === 'braille') {
        specimenStage.classList.add('single');
        specBrailleBox.classList.remove('hidden');
        specAsciiBox.classList.add('hidden');
        specDitherBox.classList.add('hidden');
      } else if (mode === 'ascii') {
        specimenStage.classList.add('single');
        specBrailleBox.classList.add('hidden');
        specAsciiBox.classList.remove('hidden');
        specDitherBox.classList.add('hidden');
      } else if (mode === 'dither') {
        specimenStage.classList.add('single');
        specBrailleBox.classList.add('hidden');
        specAsciiBox.classList.add('hidden');
        specDitherBox.classList.remove('hidden');
      }
    });
  });

  function copyWithFeedback(btn, text, label) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ copied!';
      setTimeout(() => { btn.textContent = orig; }, 1400);
    }).catch(() => {});
  }

  const copyBrailleBtn = document.getElementById('copyBrailleBtn');
  const copyAsciiBtn = document.getElementById('copyAsciiBtn');
  if (copyBrailleBtn) {
    copyBrailleBtn.addEventListener('click', () => copyWithFeedback(copyBrailleBtn, labBrailleOut.textContent));
  }
  if (copyAsciiBtn) {
    copyAsciiBtn.addEventListener('click', () => copyWithFeedback(copyAsciiBtn, labAsciiOut.textContent));
  }

  // Solana tip copy
  const copySolBtn = document.getElementById('copySolBtn');
  if (copySolBtn) {
    copySolBtn.addEventListener('click', () => {
      const addr = copySolBtn.dataset.sol;
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(addr).then(() => {
        const orig = copySolBtn.innerHTML;
        copySolBtn.innerHTML = '✓ copied <code>' + addr.slice(0, 8) + '...' + addr.slice(-4) + '</code>';
        setTimeout(() => { copySolBtn.innerHTML = orig; }, 1800);
      }).catch(() => {});
    });
  }

  // ---- 4. Canonical 115 Shipped Systems Index (72 Zoth Studio Tools + 43 ZothOS Workstations) ----
  const SHIPPED_INDEX = [
    // 53 Zoth Studio Browser Tools
    ['zoth-civilization', 'web', '3D Multi-World Civilization & Pantheon 21', 'https://zoth.nullai.tech/tools/zoth-civilization'],
    ['adytum-hermetic-engine', 'web', '22-Key 3D Tarot Diorama & Kabbalah Engine', 'https://zoth.nullai.tech/tools/adytum-hermetic-engine'],
    ['zothos-lite', 'web', 'Browser-Native Sovereign Desktop OS v1.1', 'https://zothos-lite.nullai.tech'],
    ['zoth-gpu-foundry', 'web', 'A100 80GB Telemetry & Benchmark Observatory', 'https://zoth.nullai.tech/tools/zoth-gpu-foundry'],
    ['neuro-memory-daemon', 'web', 'STDP Synaptic Engram & Obsidian Second Brain', 'https://zoth.nullai.tech/tools/neuro-memory-daemon'],
    ['zoth-kernel-forge', 'web', 'Custom Linux Kernel Config & eBPF Inspector', 'https://zoth.nullai.tech/tools/zoth-kernel-forge'],
    ['rag-chunk-visualizer', 'web', 'Semantic & Token RAG Chunking Lab', 'https://zoth.nullai.tech/tools/rag-chunk-visualizer'],
    ['prompt-cost-calculator', 'web', 'Frontier LLM Token & Context Pricing Matrix', 'https://zoth.nullai.tech/tools/prompt-cost-calculator'],
    ['json-schema-forge', 'web', 'Structured Output & Tool Schema Compiler', 'https://zoth.nullai.tech/tools/json-schema-forge'],
    ['mcp-inspector-studio', 'web', 'Model Context Protocol JSON-RPC Debugger', 'https://zoth.nullai.tech/tools/mcp-inspector-studio'],
    ['agent-trace-replay', 'web', 'Multi-Agent Trajectory & Step Visualizer', 'https://zoth.nullai.tech/tools/agent-trace-replay'],
    ['regex-ast-workbench', 'web', 'NFA/DFA State Machine & Regex Visualizer', 'https://zoth.nullai.tech/tools/regex-ast-workbench'],
    ['jwt-crypto-auditor', 'web', 'Client-Side JWS/JWE & HMAC Security Auditor', 'https://zoth.nullai.tech/tools/jwt-crypto-auditor'],
    ['sql-query-plan-lab', 'web', 'EXPLAIN ANALYZE DAG & Index Optimizer', 'https://zoth.nullai.tech/tools/sql-query-plan-lab'],
    ['cron-schedule-simulator', 'web', '5/6-Field Cron Timeline & Jitter Predictor', 'https://zoth.nullai.tech/tools/cron-schedule-simulator'],
    ['openapi-mock-forge', 'web', 'OpenAPI 3.1 Spec Validator & Contract Lab', 'https://zoth.nullai.tech/tools/openapi-mock-forge'],
    ['css-shader-studio', 'web', 'GLSL Fragment, Bayer Dither & CRT Lab', 'https://zoth.nullai.tech/tools/css-shader-studio'],
    ['unicode-braille-canvas', 'web', 'U+2800 2x4 Sub-Pixel Braille Art Studio', 'https://zoth.nullai.tech/tools/unicode-braille-canvas'],
    ['webaudio-synth-rack', 'web', 'Modular WebAudio FM/Wavetable Synthesizer', 'https://zoth.nullai.tech/tools/webaudio-synth-rack'],
    ['svg-plotter-foundry', 'web', 'Generative Pen-Plotter & G-Code Vector Lab', 'https://zoth.nullai.tech/tools/svg-plotter-foundry'],
    ['ast-code-surgeon', 'web', 'Tree-Sitter & Babel AST Codemod Workbench', 'https://zoth.nullai.tech/tools/ast-code-surgeon'],
    ['diff-merge-3way', 'web', 'Semantic 3-Way Git Conflict Resolver', 'https://zoth.nullai.tech/tools/diff-merge-3way'],
    ['docker-compose-architect', 'web', 'Multi-Container Topology & Network Builder', 'https://zoth.nullai.tech/tools/docker-compose-architect'],
    ['nginx-caddy-transpiler', 'web', 'Reverse Proxy & TLS Security Header Forge', 'https://zoth.nullai.tech/tools/nginx-caddy-transpiler'],
    ['systemd-unit-hardener', 'web', 'Sandboxed systemd Service & Timer Generator', 'https://zoth.nullai.tech/tools/systemd-unit-hardener'],
    ['wireguard-mesh-planner', 'web', 'Zero-Trust WireGuard CIDR & Peer Configurator', 'https://zoth.nullai.tech/tools/wireguard-mesh-planner'],
    ['bpftrace-one-liner-lab', 'web', 'Linux eBPF Syscall & Latency Probe Builder', 'https://zoth.nullai.tech/tools/bpftrace-one-liner-lab'],
    ['vram-quant-calculator', 'web', 'GGUF / EXL2 / AWQ KV-Cache VRAM Planner', 'https://zoth.nullai.tech/tools/vram-quant-calculator'],
    ['lora-rank-planner', 'web', 'QLoRA Target Module & Rank Hyperparameter Lab', 'https://zoth.nullai.tech/tools/lora-rank-planner'],
    ['eval-harness-matrix', 'web', 'LLM Judge & Deterministic Benchmark Grader', 'https://zoth.nullai.tech/tools/eval-harness-matrix'],
    ['prompt-injection-redteam', 'web', 'OWASP LLM01 Adversarial Guardrail Tester', 'https://zoth.nullai.tech/tools/prompt-injection-redteam'],
    ['embedding-space-projector', 'web', 'UMAP/PCA Cosine Similarity Cluster Explorer', 'https://zoth.nullai.tech/tools/embedding-space-projector'],
    ['jsonl-dataset-curator', 'web', 'SFT / DPO ChatML Deduplicator & Scrubber', 'https://zoth.nullai.tech/tools/jsonl-dataset-curator'],
    ['function-call-playground', 'web', 'Parallel Tool-Use & Schema Fuzzing Harness', 'https://zoth.nullai.tech/tools/function-call-playground'],
    ['system-prompt-architect', 'web', 'Constitutional Persona & Constraint Compiler', 'https://zoth.nullai.tech/tools/system-prompt-architect'],
    ['markdown-knowledge-compiler', 'web', 'Obsidian Wikilink & JSON Canvas Graph Lab', 'https://zoth.nullai.tech/tools/markdown-knowledge-compiler'],
    ['aeo-schema-graph-forge', 'web', 'JSON-LD @graph & AI Search Citation Auditor', 'https://zoth.nullai.tech/tools/aeo-schema-graph-forge'],
    ['color-oklch-alchemist', 'web', 'Perceptual OKLCH & APCA Contrast Palette Lab', 'https://zoth.nullai.tech/tools/color-oklch-alchemist'],
    ['typography-scale-director', 'web', 'Fluid Clamp() Modular Type & Grid Calculator', 'https://zoth.nullai.tech/tools/typography-scale-director'],
    ['spring-physics-choreographer', 'web', 'RK4 Spring Solver & CSS Linear() Generator', 'https://zoth.nullai.tech/tools/spring-physics-choreographer'],
    ['har-waterfall-forensics', 'web', 'HTTP Archive Latency & Payload Bottleneck Analyzer', 'https://zoth.nullai.tech/tools/har-waterfall-forensics'],
    ['csp-header-auditor', 'web', 'Content-Security-Policy Nonce & Directive Grader', 'https://zoth.nullai.tech/tools/csp-header-auditor'],
    ['cors-preflight-debugger', 'web', 'Cross-Origin Resource Sharing Header Simulator', 'https://zoth.nullai.tech/tools/cors-preflight-debugger'],
    ['dns-zone-architect', 'web', 'SPF / DKIM / DMARC & CAA Zone File Compiler', 'https://zoth.nullai.tech/tools/dns-zone-architect'],
    ['ssh-config-bastion', 'web', 'Ed25519 ProxyJump & Hardened sshd_config Lab', 'https://zoth.nullai.tech/tools/ssh-config-bastion'],
    ['chmod-acl-matrix', 'web', 'POSIX Octal, SetUID & Linux Capabilities Calculator', 'https://zoth.nullai.tech/tools/chmod-acl-matrix'],
    ['cidr-subnet-visualizer', 'web', 'IPv4/IPv6 Binary Bitmask & VPC Splitter', 'https://zoth.nullai.tech/tools/cidr-subnet-visualizer'],
    ['protobuf-wire-decoder', 'web', 'Raw Varint & Protobuf Hex Wire Inspector', 'https://zoth.nullai.tech/tools/protobuf-wire-decoder'],
    ['wasm-wat-inspector', 'web', 'WebAssembly Binary Section & Export Disassembler', 'https://zoth.nullai.tech/tools/wasm-wat-inspector'],
    ['unicode-byte-forensics', 'web', 'UTF-8 Grapheme, Zero-Width & Homoglyph Detector', 'https://zoth.nullai.tech/tools/unicode-byte-forensics'],
    ['base-radix-transcoder', 'web', 'Base58 / Bech32 / Base64URL / Hex Cipher Lab', 'https://zoth.nullai.tech/tools/base-radix-transcoder'],
    ['mermaid-architecture-studio', 'web', 'C4 & Sequence Diagram Live SVG Compiler', 'https://zoth.nullai.tech/tools/mermaid-architecture-studio'],
    ['parquet-arrow-peeker', 'web', 'In-Browser Columnar Schema & Row-Group Inspector', 'https://zoth.nullai.tech/tools/parquet-arrow-peeker'],

    // 19 Zoth Studio CLI Binaries
    ['zoth-cli', 'cli', 'Master ZothOS & Arsenal Orchestrator CLI', 'https://zoth.nullai.tech'],
    ['skillcheck', 'cli', 'Agent SKILL.md Frontmatter & Script Linter', 'https://github.com/1nc0gn30'],
    ['ctxmap', 'cli', 'Token Context Window Heatmap & File Profiler', 'https://github.com/1nc0gn30'],
    ['hermes-zoth', 'cli', 'Hermes Agent Community Plugin v1.1.4 (72 Tools)', 'https://github.com/1nc0gn30/hermes-zoth'],
    ['defuddle-cli', 'cli', 'Clean Markdown Extractor from Raw DOM/HTML', 'https://zoth.nullai.tech'],
    ['knap-cli', 'cli', 'Structured JSON/CSV to Markdown Template Compiler', 'https://zoth.nullai.tech'],
    ['zoth-Doctor', 'cli', '23-Daemon Loopback Health & Port Verifier', 'https://zothos.nullai.tech'],
    ['zoth-iso-forge', 'cli', 'Debian Live SquashFS & Amnesic toram ISO Builder', 'https://zothos.nullai.tech'],
    ['zoth-mcp-bridge', 'cli', '141-Tool Model Context Protocol Stdio/SSE Router', 'https://zothos.nullai.tech'],
    ['zoth-vault-sync', 'cli', 'Obsidian Second Brain & STDP Engram CLI', 'https://zothos.nullai.tech'],
    ['zoth-bench', 'cli', 'Local Ollama / vLLM Throughput & TTFT Profiler', 'https://zoth.nullai.tech'],
    ['zoth-guardrail', 'cli', 'Headless Triple-Viewport AEO/SEO & DOM Verifier', 'https://zoth.nullai.tech'],
    ['zoth-braille', 'cli', 'Terminal U+2800 Braille & Bayer 4x4 Image Renderer', 'https://1nc0gn30.si'],
    ['zoth-net-audit', 'cli', 'Loopback Socket & Zero-Telemetry Firewall Inspector', 'https://zothos.nullai.tech'],
    ['zoth-sec-scan', 'cli', 'Secret, Entropy & Supply-Chain Dependency Scanner', 'https://zoth.nullai.tech'],
    ['zoth-git-surgeon', 'cli', 'Deterministic Commit Graph & Worktree Manager', 'https://zoth.nullai.tech'],
    ['zoth-audio-forge', 'cli', 'Zero-Dep -14 LUFS Procedural WAV Synthesizer', 'https://zoth.nullai.tech'],
    ['zoth-pack', 'cli', 'Deterministic Tar/Zstd Reproducible Archive Builder', 'https://zothos.nullai.tech'],
    ['zoth-relay', 'cli', 'Localhost Terminal & Agent Session Relay Utility', 'https://zothos.nullai.tech'],

    // 43 ZothOS Workstations
    ['station-01 · Sovereign Cockpit (:8137)', 'os', 'ZothOS v3.4.0 Master Telemetry & Daemon Switchboard', 'https://zothos.nullai.tech'],
    ['station-02 · Zoth Studio Deck (:3000)', 'os', 'Local 72-Tool Arsenal & God-Mode Router', 'https://zoth.nullai.tech'],
    ['station-03 · Civilization Core (:9393)', 'os', '4-World Star System & Pantheon 21 Simulation', 'https://zothos.nullai.tech'],
    ['station-04 · Adytum Sanctuary (:8135)', 'os', '22-Arcana 3D Tarot & Tree of Life Workstation', 'https://zothos.nullai.tech'],
    ['station-05 · Neuro-Memory (:8094)', 'os', 'STDP Engram Graph & Karpathy LLM Wiki Daemon', 'https://zothos.nullai.tech'],
    ['station-06 · GPU Foundry (:8155)', 'os', 'A100 80GB / Local CUDA Benchmark Observatory', 'https://zothos.nullai.tech'],
    ['station-07 · ZothOS-Lite (:8145)', 'os', 'WebWM Multi-Window Desktop & Braille Terminal', 'https://zothos-lite.nullai.tech'],
    ['station-08 · Kernel & eBPF Forge', 'os', 'Live Ring-0 Syscall & Netfilter Telemetry Deck', 'https://zothos.nullai.tech'],
    ['station-09 · Amnesic RAM Vault', 'os', 'toram SquashFS Ephemeral Cryptographic Workspace', 'https://zothos.nullai.tech'],
    ['station-10 · MCP Router Hub', 'os', '11 MCP Servers · 141 Local Agent Tools Inspector', 'https://zothos.nullai.tech'],
    ['station-11 · Local LLM Inference Rig', 'os', 'Ollama / llama.cpp Context & KV-Cache Controller', 'https://zothos.nullai.tech'],
    ['station-12 · Obsidian Second Brain', 'os', 'Local Markdown Vault, Bases & JSON Canvas Studio', 'https://zothos.nullai.tech'],
    ['station-13 · WireGuard Zero-Trust Mesh', 'os', 'Encrypted Split-Tunnel & Loopback Isolation Deck', 'https://zothos.nullai.tech'],
    ['station-14 · Packet & DNS Sinkhole', 'os', 'Zero-Telemetry Egress Filter & Local Unbound Resolver', 'https://zothos.nullai.tech'],
    ['station-15 · Binary Reverse Lab', 'os', 'ELF / DWARF / Disassembly & Hex Forensics Station', 'https://zothos.nullai.tech'],
    ['station-16 · Crypto & Key Ceremony', 'os', 'Air-Gapped Ed25519 / Age /minisign Keyring Forge', 'https://zothos.nullai.tech'],
    ['station-17 · Shader & Demoscene CRT', 'os', '60fps WebGL Paper Shaders & Ordered Bayer Compositor', 'https://zothos.nullai.tech'],
    ['station-18 · Chiptune & FM Tracker', 'os', 'Procedural WebAudio & -14 LUFS Sound Design Bay', 'https://zothos.nullai.tech'],
    ['station-19 · Vector Plotter Studio', 'os', 'SVG Voxel, L-System Botany & Pen-Plotter Engine', 'https://zothos.nullai.tech'],
    ['station-20 · Agent Swarm Arena', 'os', 'Multi-Agent Consensus & Subagent Worktree Orchestrator', 'https://zothos.nullai.tech'],
    ['station-21 · RAG Vector Observatory', 'os', 'Local SQLite-Vec / LanceDB Hybrid Search Workbench', 'https://zothos.nullai.tech'],
    ['station-22 · Dataset Sanitizer Bay', 'os', 'PII Scrubber & JSONL Fine-Tuning Pipeline', 'https://zothos.nullai.tech'],
    ['station-23 · AST Refactoring Reactor', 'os', 'Multi-Repo Tree-Sitter Codemod & Lint Engine', 'https://zothos.nullai.tech'],
    ['station-24 · Container Podman Foundry', 'os', 'Rootless OCI Image & Quadlet Systemd Generator', 'https://zothos.nullai.tech'],
    ['station-25 · SQLite & DuckDB OLAP Lab', 'os', 'Zero-Server Local Analytical Query & Parquet Engine', 'https://zothos.nullai.tech'],
    ['station-26 · HTTP/3 & TLS Inspector', 'os', 'Local Caddy / X.509 Certificate & Cipher Auditor', 'https://zothos.nullai.tech'],
    ['station-27 · Cron & Temporal Scheduler', 'os', 'Deterministic Local Job Queue & Dead-Letter Monitor', 'https://zothos.nullai.tech'],
    ['station-28 · Git Worktree Matrix', 'os', 'Parallel Branch Isolation & Bisect Automation Deck', 'https://zothos.nullai.tech'],
    ['station-29 · Accessibility & AEO Lab', 'os', 'WCAG Contrast, Alt-Text & Schema.org Validator', 'https://zothos.nullai.tech'],
    ['station-30 · Headless Browser Harness', 'os', 'CDP Triple-Viewport Screenshot & Console Verifier', 'https://zothos.nullai.tech'],
    ['station-31 · Braille TUI Multiplexer', 'os', 'Unicode U+2800 Sub-Pixel Terminal Dashboard', 'https://zothos.nullai.tech'],
    ['station-32 · Retro Fantasy Console', 'os', '8-Bit Cartridges, PICO-Style Sprite & Tilemap Editor', 'https://zothos.nullai.tech'],
    ['station-33 · Physics & Verlet Sandbox', 'os', 'Rigid-Body & Particle Fluid Simulation Workstation', 'https://zothos.nullai.tech'],
    ['station-34 · Cartography & Globe Deck', 'os', 'Offline Vector Tile & Geodesic Arc Projection Lab', 'https://zothos.nullai.tech'],
    ['station-35 · Typographic Specimen Press', 'os', 'Variable Font Physics & Glyph Scramble Foundry', 'https://zothos.nullai.tech'],
    ['station-36 · Hardware Telemetry Bridge', 'os', 'NVMe SMART, Thermal & RAPL Power Sensor Monitor', 'https://zothos.nullai.tech'],
    ['station-37 · USB & Serial Logic Probe', 'os', 'WebSerial / UART Baud Frame & Hex Analyzer', 'https://zothos.nullai.tech'],
    ['station-38 ·SDR Spectrum Waterfall', 'os', 'IQ Baseband FFT & RF Modulation Visualizer', 'https://zothos.nullai.tech'],
    ['station-39 · Red-Team Prompt Firewall', 'os', 'Adversarial Jailbreak & Context Poisoning Sandbox', 'https://zothos.nullai.tech'],
    ['station-40 · Reproducible Build Forge', 'os', 'SHA-256 Attestation & Deterministic Binary Verifier', 'https://zothos.nullai.tech'],
    ['station-41 · Sovereign Mail & RSS Reader', 'os', 'Offline Defuddle Article & Atom Feed Compiler', 'https://zothos.nullai.tech'],
    ['station-42 · ZFS & Btrfs Snapshot Bay', 'os', 'Copy-on-Write Scrub & Incremental Send Planner', 'https://zothos.nullai.tech'],
    ['station-43 · Dead-Man Switch & Panic', 'os', 'Instant RAM Wipe & Ephemeral Key Zeroization Trigger', 'https://zothos.nullai.tech']
  ];

  const indexGrid = document.getElementById('indexGrid');
  const toolSearch = document.getElementById('toolSearch');
  let activeCat = 'all';

  function renderShippedIndex() {
    if (!indexGrid) return;
    const q = (toolSearch ? toolSearch.value : '').trim().toLowerCase();
    const filtered = SHIPPED_INDEX.filter(([name, cat, desc]) => {
      if (activeCat !== 'all' && cat !== activeCat) return false;
      if (!q) return true;
      return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || cat.includes(q);
    });
    indexGrid.innerHTML = filtered.map(([name, cat, desc, url]) => {
      const badge = cat === 'web' ? 'WEB' : cat === 'cli' ? 'CLI' : 'ZOTHOS';
      return `<a class="idx-item" href="${url}" target="_blank" rel="noopener">
        <b><span>${name}</span><span>[${badge}]</span></b>
        <small>${desc}</small>
      </a>`;
    }).join('');
  }

  document.querySelectorAll('.filter-pills [data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills [data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      renderShippedIndex();
    });
  });
  if (toolSearch) {
    toolSearch.addEventListener('input', renderShippedIndex);
  }
  renderShippedIndex();

  // ---- 5. Lightbox Specimen Viewer ----
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxClose = document.getElementById('lightboxClose');

  function openLightbox(src, title) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxTitle.textContent = title || src;
    lightbox.showModal();
  }
  if (lightboxClose) {
    lightboxClose.addEventListener('click', () => lightbox.close());
  }
  if (lightbox) {
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) lightbox.close();
    });
  }

  const openBoardBtn = document.getElementById('openBoardBtn');
  const openSpecimenBtn = document.getElementById('openSpecimenBtn');
  if (openBoardBtn) {
    openBoardBtn.addEventListener('click', () => openLightbox('assets/board.jpg', '01 · Master 9-Pose Pixel Character Board (board.jpg)'));
  }
  if (openSpecimenBtn) {
    openSpecimenBtn.addEventListener('click', () => openLightbox('assets/unicode-ascii-dither-sheet.png', '02 · Unicode U+2800 Braille & Ordered Bayer 4x4 Dither Specimen (1920x1080)'));
  }

  document.querySelectorAll('.post-card[data-zoom]').forEach(card => {
    const trigger = () => {
      const cap = card.querySelector('figcaption');
      openLightbox(card.dataset.zoom, cap ? cap.textContent : card.dataset.zoom);
    };
    card.addEventListener('click', trigger);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    });
  });

  // ---- 6. Animation Loop (~30fps, paused when hidden) ----
  let visible = true, last = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

  function frame(t) {
    if (visible && t - last > 33) {
      last = t;
      drawLattice(t);
      if (scrollY < innerHeight * 1.2) drawGhost(t);
    }
    requestAnimationFrame(frame);
  }

  function init() {
    setupLattice();
    setupGhost();
    renderLabSpecimen();
    if (reduced) {
      drawLattice(0);
      return;
    }
    if (!G && img) img.style.opacity = 1;
    requestAnimationFrame(frame);
  }

  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      setupLattice();
      setupGhost();
      if (reduced) drawLattice(0);
    }, 150);
  });

  if (img && img.complete) {
    init();
  } else if (img) {
    img.addEventListener('load', init);
    img.addEventListener('error', () => {
      img.style.opacity = 1;
      setupLattice();
      reduced ? drawLattice(0) : requestAnimationFrame(frame);
    });
  }

  // ---- 7. Interactive Terminal (`>_` / backtick) ----
  const dlg = document.getElementById('term');
  const out = document.getElementById('termOut');
  const inp = document.getElementById('termIn');
  const termCloseBtn = document.getElementById('termCloseBtn');
  const say = s => {
    out.textContent += s + '\n';
    out.scrollTop = out.scrollHeight;
  };

  const CMD = {
    help: () => [
      'available commands:',
      '  whoami          persona identity & zero-telemetry ethos',
      '  ls              list shipped systems & asset directories',
      '  poses           list all 9 character board poses',
      '  pose <name>     switch hero & lab to pose (hero, type, walk, dissolve, idle, front, three-quarter, side, back)',
      '  braille [pose]  print live U+2800 2x4 sub-pixel braille art for pose',
      '  ascii [pose]    print live Ordered Bayer 4x4 ASCII art for pose',
      '  zoth            zoth studio v2.2.0 (72 tools: 53 browser + 19 cli)',
      '  zothos          zothos v3.4.0 (43 workstations · 23 loopback daemons)',
      '  hermes          hermes-zoth v1.1.4 community plugin',
      '  nullai          nullai.tech umbrella',
      '  links           all official links',
      '  tip / sol       optional coffee link & solana tip address',
      '  clear / exit    clear screen or close shell'
    ].join('\n'),
    whoami: () => '1nc0gn30 · hooded builder @ nullai. zero accounts, zero telemetry, 100% free tools.',
    ls: () => 'zoth-studio/ (72 tools)  zothos/ (43 stations)  zothos-lite/  hermes-zoth/  assets/braille-sprites.json',
    poses: () => 'poses: ' + POSES.join(' · '),
    pose: arg => {
      const p = (arg || 'hero').toLowerCase();
      if (!POSES.includes(p)) return 'unknown pose. choose from: ' + POSES.join(', ');
      labPose = p;
      renderLabSpecimen();
      setHeroPoseAndMode(p, null);
      return 'switched active pose to: ' + p.toUpperCase();
    },
    braille: arg => {
      const p = (arg || labPose || 'hero').toLowerCase();
      if (preloadedSprites && preloadedSprites[p]) return preloadedSprites[p].braille_40;
      return labBrailleOut ? labBrailleOut.textContent : 'loading braille sprites...';
    },
    ascii: arg => {
      const p = (arg || labPose || 'hero').toLowerCase();
      if (preloadedSprites && preloadedSprites[p]) return preloadedSprites[p].ascii_40;
      return labAsciiOut ? labAsciiOut.textContent : 'loading ascii sprites...';
    },
    zoth: () => 'zoth studio v2.2.0: 72 tools. 53 in-browser, 19 cli. → https://zoth.nullai.tech',
    zothos: () => 'zothos v3.4.0: 43 workstations, 23 loopback daemons, 141 mcp tools. → https://zothos.nullai.tech',
    hermes: () => 'hermes-zoth v1.1.4: community plugin for hermes agent. independent, not affiliated with nous research.',
    nullai: () => 'nullai.tech · everything free and unlocked.',
    links: () => 'x.com/1nc0gn30 · github.com/1nc0gn30 · github.com/NullAITech · nullai.tech · zoth.nullai.tech · zothos.nullai.tech',
    tip: () => 'tips optional · stripe: https://buy.stripe.com/3cIfZg27PdKo2D64Ocfw40X · sol: GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK',
    sol: () => 'solana tip address: GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK',
    sudo: () => 'nice try. you already have root on your own box.',
    clear: () => { out.textContent = ''; return null; },
    exit: () => { dlg.close(); return null; }
  };

  function openTerm() {
    if (!dlg || dlg.open) return;
    out.textContent = '⣿ 1nc0gn30@nullai:~ (braille-sh v2.2) · type "help" or "braille hero"\n';
    dlg.showModal();
    inp.focus();
  }

  const termBtn = document.getElementById('termBtn');
  if (termBtn) termBtn.addEventListener('click', openTerm);
  if (termCloseBtn) termCloseBtn.addEventListener('click', () => dlg.close());

  addEventListener('keydown', e => {
    if (e.key === '`' && document.activeElement !== inp && document.activeElement !== toolSearch) {
      e.preventDefault();
      openTerm();
    }
  });

  const termForm = document.getElementById('termForm');
  if (termForm) {
    termForm.addEventListener('submit', e => {
      e.preventDefault();
      const raw = inp.value.trim();
      inp.value = '';
      if (!raw) return;
      say('$ ' + raw);
      const parts = raw.toLowerCase().split(/\s+/);
      const fn = CMD[parts[0]];
      const res = fn ? fn(parts[1]) : 'command not found: ' + parts[0] + ' (try "help")';
      if (res) say(res);
    });
  }
})();
