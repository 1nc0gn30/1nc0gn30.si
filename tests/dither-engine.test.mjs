import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');
const engine = require(path.join(rootDir, 'dither-engine.js'));

test('Unicode U+2800 Braille 2x4 bitmask packs every single dot coordinate accurately', () => {
  const expectedBits = [
    [0, 0, 0x01],
    [0, 1, 0x02],
    [0, 2, 0x04],
    [1, 0, 0x08],
    [1, 1, 0x10],
    [1, 2, 0x20],
    [0, 3, 0x40],
    [1, 3, 0x80]
  ];

  for (const [dx, dy, bit] of expectedBits) {
    const buf = new Uint8Array(8);
    buf[dy * 2 + dx] = 1;
    const out = engine.packBrailleBuffer(buf, 1, 1, { blankChar: 'braille' });
    assert.equal(out.charCodeAt(0), 0x2800 + bit, `dot (${dx},${dy}) must map to 0x${(0x2800 + bit).toString(16)}`);
  }

  // Full 2x4 cell -> U+28FF (⣿)
  const full = new Uint8Array(8).fill(1);
  assert.equal(engine.packBrailleBuffer(full, 1, 1), '\u28ff');

  // Empty 2x4 cell -> U+2800 when blankChar === 'braille', space otherwise
  const empty = new Uint8Array(8);
  assert.equal(engine.packBrailleBuffer(empty, 1, 1, { blankChar: 'braille' }), '\u2800');
  assert.equal(engine.packBrailleBuffer(empty, 1, 1, { blankChar: 'space' }), ' ');
});

test('Ordered Bayer 4x4 matrix satisfies exact rank permutation and normalized bounds', () => {
  assert.equal(engine.BAYER_4X4_RAW.length, 16);
  assert.deepEqual(
    engine.BAYER_4X4_RAW,
    [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  );

  const sorted = [...engine.BAYER_4X4_RAW].sort((a, b) => a - b);
  assert.deepEqual(sorted, Array.from({ length: 16 }, (_, i) => i));

  let sum = 0;
  for (const v of engine.BAYER_4X4) {
    assert.ok(v > 0 && v < 1, `value ${v} must lie strictly inside (0,1)`);
    sum += v;
  }
  assert.ok(Math.abs(sum / 16 - 0.5) < 1e-12);
});

test('Ordered Bayer 8x8 matrix satisfies recursive permutation and normalized invariants', () => {
  assert.equal(engine.BAYER_8X8_RAW.length, 64);
  const sorted = [...engine.BAYER_8X8_RAW].sort((a, b) => a - b);
  assert.deepEqual(sorted, Array.from({ length: 64 }, (_, i) => i));

  const mat8 = engine.generateBayerMatrix2D(8);
  const mat4 = engine.generateBayerMatrix2D(4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      assert.equal(mat8[y][x], mat4[y][x] * 4);
      assert.equal(mat8[y][x + 4], mat4[y][x] * 4 + 2);
      assert.equal(mat8[y + 4][x], mat4[y][x] * 4 + 3);
      assert.equal(mat8[y + 4][x + 4], mat4[y][x] * 4 + 1);
    }
  }

  const mean = engine.BAYER_8X8.reduce((a, b) => a + b, 0) / 64;
  assert.ok(Math.abs(mean - 0.5) < 1e-12);
});

test('applyTone handles contrast, threshold, clamping, and invert symmetrically', () => {
  assert.equal(engine.applyTone(0.5, { contrast: 1, threshold: 0.5, invert: false }), 0.5);
  assert.equal(engine.applyTone(0, { contrast: 1, threshold: 0.5, invert: true }), 1);
  assert.equal(engine.applyTone(1, { contrast: 1, threshold: 0.5, invert: true }), 0);
  assert.ok(engine.applyTone(0.6, { contrast: 2, threshold: 0.5 }) > engine.applyTone(0.6, { contrast: 1, threshold: 0.5 }));
  assert.equal(engine.applyTone(1.5, { contrast: 2, threshold: 0.2 }), 1);
  assert.equal(engine.applyTone(-0.5, { contrast: 2, threshold: 0.8 }), 0);
});

test('rasterizeToBraille converts solid black, solid white, and gradients deterministically', () => {
  const w = 16;
  const h = 16;
  const white = new Uint8ClampedArray(w * h * 4).fill(255);
  const black = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < black.length; i += 4) black[i] = 255;

  const resW = engine.rasterizeToBraille(white, w, h, { matrix: 'bayer8', threshold: 0.5, contrast: 1 });
  assert.equal(resW.cols, 8);
  assert.equal(resW.rows, 4);
  assert.equal(resW.text.split('\n').every(line => line === '⣿'.repeat(8)), true);

  const resB = engine.rasterizeToBraille(black, w, h, { matrix: 'bayer4', threshold: 0.5, contrast: 1 });
  assert.equal(resB.text.split('\n').every(line => line === '\u2800'.repeat(8)), true);

  const resInv = engine.rasterizeToBraille(black, w, h, { matrix: 'bayer4', threshold: 0.5, contrast: 1, invert: true });
  assert.equal(resInv.text.split('\n').every(line => line === '⣿'.repeat(8)), true);
});

test('rasterizeToBayerBlocks & rasterizeToEdgeAscii emit expected grid dimensions and glyphs', () => {
  const w = 32;
  const h = 24;
  const rgba = engine.generateProceduralRGBA('torus', w, h);

  const b4 = engine.rasterizeToBayerBlocks(rgba, w, h, { matrix: 'bayer4' });
  const b8 = engine.rasterizeToBayerBlocks(rgba, w, h, { matrix: 'bayer8' });
  assert.equal(b4.cols, 16);
  assert.equal(b4.rows, 6);
  assert.equal(b8.text.split('\n').length, 6);
  for (const ch of b8.text.replace(/\n/g, '')) {
    assert.ok(engine.BAYER_BLOCKS.includes(ch), `unexpected Bayer block char: ${ch}`);
  }

  const ascii = engine.rasterizeToEdgeAscii(rgba, w, h, { contrast: 1.4 });
  assert.equal(ascii.cols, 16);
  assert.equal(ascii.rows, 6);
  assert.ok(ascii.text.trim().length > 0);
});

test('buildSvgExport returns valid escaped SVG markup with accurate geometry', () => {
  const svg = engine.buildSvgExport('⣿<tag>&"\n⠿ test', { bg: '#050401', fg: '#f5b82e' });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('&lt;tag&gt;&amp;&quot;'));
  assert.ok(svg.includes('fill="#f5b82e"'));
});

test('Production Guardrail: index.html SEO/AEO JSON-LD @graph, OG/Twitter, alt text, and zero paywalls', () => {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  // JSON-LD @graph validation
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ldMatch, 'index.html must contain JSON-LD script');
  const parsed = JSON.parse(ldMatch[1]);
  assert.ok(Array.isArray(parsed['@graph']), 'JSON-LD must declare @graph array');
  const types = parsed['@graph'].map(n => n['@type']);
  assert.ok(types.includes('WebApplication'), 'JSON-LD @graph must include WebApplication');
  assert.ok(types.includes('FAQPage'), 'JSON-LD @graph must include FAQPage');

  // Social Meta Tags
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image']) {
    assert.ok(html.includes(`property="${prop}"`), `missing OpenGraph ${prop}`);
  }
  for (const name of ['twitter:card', 'twitter:site', 'twitter:creator', 'twitter:image']) {
    assert.ok(html.includes(`name="${name}"`), `missing Twitter tag ${name}`);
  }

  // Every <img> must have non-empty alt
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  assert.ok(imgTags.length > 0, 'index.html should contain at least one img');
  for (const tag of imgTags) {
    const alt = tag.match(/\balt="([^"]*)"/i);
    assert.ok(alt && alt[1].trim().length > 0, `img missing non-empty alt: ${tag}`);
  }

  // Zero paywalls / Buy Us a Coffee + Solana tip present
  assert.ok(!/depay/i.test(html), 'must not contain DePay references');
  assert.ok(html.includes('https://buy.stripe.com/3cIfZg27PdKo2D64Ocfw40X'), 'missing Stripe Buy Us a Coffee link');
  assert.ok(html.includes('GG2eQbVh8ut1BK6j1A2tz7pSySdLpD38BgyEhGcxdXoK'), 'missing Solana tip address');

  // Local root-relative assets referenced in index.html must exist on disk
  const localRefs = [...html.matchAll(/(?:src|href)="(\/(?:assets\/[^"]+|dither-engine\.js|main\.js|style\.css|fieldkit\.html|credits\.html|game\.html|llms\.txt))"/g)].map(m => m[1]);
  assert.ok(localRefs.length >= 6);
  for (const ref of localRefs) {
    const abs = path.join(rootDir, ref.slice(1));
    assert.ok(fs.existsSync(abs), `referenced asset missing on disk: ${ref}`);
  }
});

test('Production Guardrail: robots.txt, sitemap.xml, and netlify.toml invariants', () => {
  const robots = fs.readFileSync(path.join(rootDir, 'robots.txt'), 'utf8');
  for (const bot of ['User-agent: *', 'Googlebot', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'Applebot', 'Sitemap: https://1nc0gn30.si/sitemap.xml']) {
    assert.ok(robots.includes(bot), `robots.txt missing ${bot}`);
  }

  const sitemap = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('<loc>https://1nc0gn30.si/</loc>'));
  assert.ok(sitemap.includes('<loc>https://1nc0gn30.si/fieldkit.html</loc>'));
  assert.ok(sitemap.includes('<lastmod>2026-11-25</lastmod>'));

  const netlify = fs.readFileSync(path.join(rootDir, 'netlify.toml'), 'utf8');
  for (const rule of ['X-Frame-Options = "SAMEORIGIN"', 'X-Content-Type-Options = "nosniff"', 'Referrer-Policy = "strict-origin-when-cross-origin"', 'from = "/*"', 'to = "/index.html"']) {
    assert.ok(netlify.includes(rule), `netlify.toml missing ${rule}`);
  }
});
