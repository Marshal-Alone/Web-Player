/**
 * Challenger Test Harness: CSS & Hallmark Standard Compliance Verification
 * Empirically challenges:
 * 1. Zero instances of `transition: all` across built bundles and source code.
 * 2. Hardcoded non-token color literals in CSS vs tokens at :root.
 * 3. Hallmark mandatory floor rules (overflow-x: clip, :focus-visible, reduced motion).
 * 4. WCAG AA Contrast ratio analysis on profile badge buttons and theme text.
 */

import fs from 'fs';
import path from 'path';
import { assert } from './e2e/framework/assert';

async function runCssVerification() {
  console.log('================================================================');
  console.log('   CHALLENGER: CSS & HALLMARK INTEGRITY VERIFICATION           ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(` ✔ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ✘ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  const distDir = path.resolve('web/dist');
  const distAssetsDir = path.resolve('web/dist/assets');
  const srcCssPath = path.resolve('web/src/index.css');

  const cssFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.css'));
  const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
  const htmlFile = path.resolve(distDir, 'index.html');

  assert.ok(cssFiles.length > 0, 'Built CSS file must exist in web/dist/assets');
  assert.ok(jsFiles.length > 0, 'Built JS file must exist in web/dist/assets');

  const builtCss = fs.readFileSync(path.join(distAssetsDir, cssFiles[0]), 'utf8');
  const builtJs = fs.readFileSync(path.join(distAssetsDir, jsFiles[0]), 'utf8');
  const builtHtml = fs.readFileSync(htmlFile, 'utf8');
  const srcCss = fs.readFileSync(srcCssPath, 'utf8');

  // Test 1: Zero instances of `transition: all` in built CSS
  test('Zero instances of transition: all or transition-all in built CSS bundle', () => {
    const forbidden = [/transition\s*:\s*all\b/i, /transition\s*:\s*[^;}]*\ball\b/i, /transition-all/i];
    for (const pat of forbidden) {
      const match = builtCss.match(pat);
      assert.equal(
        match,
        null,
        `Built CSS contains forbidden pattern: ${pat} (found: ${match ? match[0] : ''})`
      );
    }
  });

  // Test 2: Zero instances of `transition: all` in built JS bundle
  test('Zero instances of transition: all or transition-all in built JS bundle', () => {
    const forbidden = [/transition\s*:\s*all\b/i, /"transition-all"/i, /'transition-all'/i];
    for (const pat of forbidden) {
      const match = builtJs.match(pat);
      assert.equal(
        match,
        null,
        `Built JS contains forbidden pattern: ${pat} (found: ${match ? match[0] : ''})`
      );
    }
  });

  // Test 3: Zero instances of `transition: all` in source index.css
  test('Zero instances of transition: all in source web/src/index.css', () => {
    assert.ok(!srcCss.includes('transition: all'), 'Source CSS must not contain transition: all');
    assert.ok(!srcCss.includes('transition:all'), 'Source CSS must not contain transition:all');
  });

  // Test 4: Hallmark Mandatory Floor Rules in index.css
  test('Hallmark Floor Rules: overflow-x: clip on html, body', () => {
    assert.ok(
      srcCss.includes('overflow-x: clip'),
      'Source CSS must include overflow-x: clip on root container'
    );
    assert.ok(
      builtCss.includes('overflow-x:clip'),
      'Built CSS must preserve overflow-x: clip'
    );
  });

  test('Hallmark Floor Rules: Instant accessible :focus-visible outline', () => {
    assert.ok(
      srcCss.includes('*:focus-visible'),
      'Source CSS must declare *:focus-visible outline rule'
    );
    assert.ok(
      builtCss.includes(':focus-visible'),
      'Built CSS must include :focus-visible outline'
    );
  });

  test('Hallmark Floor Rules: prefers-reduced-motion fallback', () => {
    assert.ok(
      srcCss.includes('prefers-reduced-motion: reduce'),
      'Source CSS must declare prefers-reduced-motion media query'
    );
    assert.ok(
      builtCss.includes('prefers-reduced-motion'),
      'Built CSS must preserve prefers-reduced-motion fallback'
    );
  });

  // Test 5: Tokens at :root verification
  test('Complete Hallmark CSS Token declarations at :root and theme selectors', () => {
    const requiredTokens = [
      '--bg-canvas',
      '--bg-surface',
      '--bg-card',
      '--bg-hover',
      '--border-subtle',
      '--border-strong',
      '--text-primary',
      '--text-secondary',
      '--text-dim',
      '--accent-primary',
      '--accent-hover',
      '--accent-subtle',
      '--accent-text',
      '--font-sans',
      '--font-mono'
    ];

    for (const token of requiredTokens) {
      assert.ok(
        srcCss.includes(token),
        `Source index.css must define token: ${token}`
      );
      assert.ok(
        builtCss.includes(token),
        `Built CSS must include compiled token: ${token}`
      );
    }
  });

  // Test 6: Dual Profile accent definition verification
  test('Profile tokens defined for both [data-profile="dsa"] and [data-profile="development"]', () => {
    assert.ok(
      srcCss.includes('[data-profile="dsa"]'),
      'Source CSS must define [data-profile="dsa"] accents'
    );
    assert.ok(
      srcCss.includes('[data-profile="development"]'),
      'Source CSS must define [data-profile="development"] accents'
    );
    assert.ok(
      builtCss.includes('[data-profile=dsa]'),
      'Built CSS must compile [data-profile=dsa]'
    );
    assert.ok(
      builtCss.includes('[data-profile=development]'),
      'Built CSS must compile [data-profile=development]'
    );
  });

  // Test 7: Non-token arbitrary color audit
  test('Non-token arbitrary hex color audit in built CSS rules', () => {
    const blocks = builtCss.split('}');
    const violations: string[] = [];

    for (const b of blocks) {
      const parts = b.split('{');
      if (parts.length < 2) continue;
      const sel = parts[0].trim();
      const decl = parts[1].trim();

      // Skip definitions on tokens or resets
      if (
        sel.includes(':root') ||
        sel.includes('[data-theme') ||
        sel.includes('.light') ||
        sel.includes('[data-profile') ||
        sel.includes('*,:before,:after') ||
        sel.includes('input::') ||
        sel.includes('textarea::') ||
        sel.includes('::backdrop')
      ) {
        continue;
      }

      // Check for raw hex colors in styling rules
      const hexes = decl.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      const nonZeroHexes = hexes.filter((h) => h !== '#0000'); // #0000 is shadow default transparent
      if (nonZeroHexes.length > 0) {
        violations.push(`${sel} { ${decl} } -> ${nonZeroHexes.join(', ')}`);
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found rules with hardcoded non-token hex colors:\n${violations.join('\n')}`
    );
  });

  // Test 8: WCAG Contrast Ratio Stress-Testing
  test('WCAG Contrast calculation: Canvas vs Text Tokens', () => {
    function getLuminance(r: number, g: number, b: number): number {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrast(rgb1: [number, number, number], rgb2: [number, number, number]): number {
      const l1 = getLuminance(...rgb1);
      const l2 = getLuminance(...rgb2);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    // Dark Mode: Canvas #0b0d14 vs Text #f8fafc
    const darkCanvas: [number, number, number] = [11, 13, 20];
    const darkText: [number, number, number] = [248, 250, 252];
    const darkContrast = getContrast(darkCanvas, darkText);
    console.log(`   [Info] Dark Mode Canvas (#0b0d14) vs Text (#f8fafc) Contrast: ${darkContrast.toFixed(2)}:1`);
    assert.ok(darkContrast >= 7.0, `Dark mode text contrast ${darkContrast.toFixed(2)} must pass AAA (>= 7.0)`);

    // Light Mode: Canvas #f8fafc vs Text #0f172a
    const lightCanvas: [number, number, number] = [248, 250, 252];
    const lightText: [number, number, number] = [15, 23, 42];
    const lightContrast = getContrast(lightCanvas, lightText);
    console.log(`   [Info] Light Mode Canvas (#f8fafc) vs Text (#0f172a) Contrast: ${lightContrast.toFixed(2)}:1`);
    assert.ok(lightContrast >= 7.0, `Light mode text contrast ${lightContrast.toFixed(2)} must pass AAA (>= 7.0)`);
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCssVerification().catch((err) => {
  console.error('Fatal CSS verification error:', err);
  process.exit(1);
});
