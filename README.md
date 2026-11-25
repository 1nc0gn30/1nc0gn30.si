# 1nc0gn30.si

Static sovereign hub and client-side **Unicode `U+2800` Braille & Ordered Bayer 4×4 / 8×8 Dither Character Lab** for **1nc0gn30** (`@1nc0gn30` · Neal Frazier Tech) on the **NullAI Platform** (`https://nullai.tech`). Zero runtime dependencies, zero telemetry, 100% open-access.

## Architecture & Capabilities
- **HiDPI 60fps 360° Volumetric Character Rig (`main.js`)**: Interactive drag-to-orbit & helical vortex morph canvas (`devicePixelRatio`-scaled up to `2×`, single-frame static mode under `prefers-reduced-motion`) with 5 real-time shaders (`Hybrid`, `U+2800 Braille`, `Bayer 4×4 Dither`, `Edge ASCII`, `3D Voxel Lattice`).
- **Deterministic Braille & Bayer Engine (`dither-engine.js`)**: Shared zero-dependency UMD module powering both the browser lab and Node.js test suite:
  - ISO/Unicode `U+2800` 2×4 sub-pixel bitmask packing (`0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80`).
  - Recursive **Ordered Bayer 4×4** (`0..15`) and **Ordered Bayer 8×8** (`0..63`) threshold matrices, flat threshold cut, and Sobel gradient Edge ASCII.
  - 100% client-side **Local Image Upload** (`FileReader` + drag-and-drop), built-in local **Sentinel** portrait, procedural **3D Torus**, **Fresnel Rings**, **Cymatic**, and custom **Text Banner** sources.
  - Real-time **Columns (`28–92`)**, **Threshold (`0.15–0.85`)**, **Contrast (`0.60–2.40`)**, **Invert**, and **Wave Field** controls.
  - One-click **Copy Unicode** (with clipboard fallback), **Download `.TXT`**, **Export Vector `.SVG`**, and **Export 2× HiDPI `.PNG`**.
- **Dual-Reality Theme System**: Switch instantaneously between **Obsidian Gold CRT** (`#040301` / `#f5b82e`) and **Editorial Alabaster Vellum** (`#faf8f3` / `#9a6f0b`) across `/`, `/fieldkit.html`, and `/credits.html`.
- **12-Col Bento Ecosystem & 40-Tool Launcher**: Direct entry to **Zoth Studio v2** (80 free tools: 56 browser/WebGPU + 24 CLI, 79 public GitHub repos), **ZothOS v3.4.0** (23 daemons), **ZothOS-Lite v1.2** (56 curated models · `toram`), **Zoth Civilization v3.0** (23 Pantheon Agents), **ZothNet**, **Hermes-Zoth**, **FieldKit** (`/fieldkit.html`), and **World of Zoth v2.0** (`/game.html` + Android APK).
- **Interactive Sovereign Shell (`` ` `` / `>_`)**: Quick-command chips (`neofetch`, `ls`, `zoth`, `zothos`, `lite`, `fieldkit`, `theme`, `tip`) + fullscreen 60fps launch showreel modal.

## Local Preview & Tests
```bash
# Run unit tests (Braille U+2800 bitmask, Bayer 4x4/8x8 matrices, rasterizers, & production guardrails)
npm test

# Serve locally
python3 -m http.server 4331
# Open http://127.0.0.1:4331
```

Engineered by Neal Frazier Tech (`@1nc0gn30`) • [NullAI Platform](https://nullai.tech)
