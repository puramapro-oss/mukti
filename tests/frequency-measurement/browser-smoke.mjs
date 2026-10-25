/**
 * Isolated real-browser smoke: React -> permission -> Chromium fake WAV device
 * -> native getUserMedia/Web Audio -> the current FrequencyMeter UI.
 * No microphone hardware, medical result, full Next app or mobile OS is tested.
 *
 * Run from any directory with Node 24 after `npm ci` in this test directory:
 *   node /absolute/path/to/tests/frequency-measurement/browser-smoke.mjs
 * Use --bundle-only to verify dependency isolation without launching Chromium.
 * All React/ReactDOM imports, including JSX runtime subpaths in production source,
 * resolve through this test directory. This prevents duplicate React instances
 * when the application also has its own node_modules installation.
 * Playwright is resolved locally, then CODEX_PRIMARY_RUNTIME_NODE_MODULES,
 * then NODE_PATH. Install Chromium with the chosen Playwright package, or set
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (or CHROMIUM_EXECUTABLE_PATH) to an
 * existing matching executable.
 * Fixtures are temporary and cleaned up on exit. Playwright serves the harness
 * through route fulfillment on an isolated HTTPS test origin; no server/socket
 * or external network is needed.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, '../..');
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

function loadPlaywright() {
  try { return require('playwright'); } catch { /* Try the runtime below. */ }
  const roots = [
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    ...(process.env.NODE_PATH ?? '').split(delimiter),
  ].filter(Boolean);
  for (const root of roots) {
    try { return require(join(root, 'playwright')); } catch { /* Try next root. */ }
  }
  throw new Error('Playwright is unavailable. Install playwright locally, or set CODEX_PRIMARY_RUNTIME_NODE_MODULES/NODE_PATH to its node_modules directory.');
}

function createToneWav(hz) {
  const sampleRate = 48000;
  const sampleCount = sampleRate * 10;
  const dataBytes = sampleCount * 2;
  const bytes = Buffer.alloc(44 + dataBytes);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + dataBytes, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM.
  bytes.writeUInt16LE(1, 22); // Mono.
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < sampleCount; i++) {
    // Independent time-domain fixture; no production DSP function is used.
    bytes.writeInt16LE(Math.round(32767 * 0.25 * Math.sin(2 * Math.PI * hz * i / sampleRate + 0.37)), 44 + i * 2);
  }
  return bytes;
}

const bundle = await build({
  absWorkingDir: repositoryRoot,
  stdin: {
    contents: `import React from 'react';
import { createRoot } from 'react-dom/client';
import FrequencyMeter from ${JSON.stringify(join(repositoryRoot, 'src/components/audio/FrequencyMeter.tsx'))};
createRoot(document.getElementById('root')).render(<FrequencyMeter />);`,
    loader: 'tsx',
    resolveDir: testDirectory,
    sourcefile: 'frequency-smoke-entry.tsx',
  },
  nodePaths: [join(testDirectory, 'node_modules')],
  plugins: [{
    name: 'react-from-smoke-harness',
    setup(bundler) {
      bundler.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, ({ path }) => ({
        // Unlike nodePaths (a fallback), this applies to imports from src too.
        // createRequire(import.meta.url) anchors every entry point to the bench.
        path: require.resolve(path),
      }));
    },
  }],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  metafile: true,
  logLevel: 'silent',
});
const dependencyRoots = { react: new Set(), 'react-dom': new Set() };
for (const input of Object.keys(bundle.metafile.inputs)) {
  const absolute = resolve(repositoryRoot, input).replaceAll('\\', '/');
  const match = absolute.match(/^(.*\/node_modules\/(react|react-dom))\//);
  if (match) dependencyRoots[match[2]].add(match[1]);
}
for (const name of ['react', 'react-dom']) {
  const expectedRoot = dirname(require.resolve(`${name}/package.json`)).replaceAll('\\', '/');
  assert.deepEqual([...dependencyRoots[name]], [expectedRoot], `The smoke bundle must contain only the harness installation of ${name}.`);
}
const bundleChecks = {
  reactInstances: dependencyRoots.react.size,
  reactDomInstances: dependencyRoots['react-dom'].size,
  reactVersion: require('react/package.json').version,
  reactDomVersion: require('react-dom/package.json').version,
};
const bundleOnly = process.argv.includes('--bundle-only');
const { chromium } = bundleOnly ? { chromium: null } : loadPlaywright();
const javascript = bundle.outputFiles[0].text;
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frequency meter smoke</title>
<style>body{font:16px system-ui;margin:16px;max-width:900px}button,input{font:inherit}button{min-height:44px;margin:8px}output{display:block;font-size:28px}</style>
</head><body><main id="root"></main><script src="/bundle.js"></script></body></html>`;

const origin = 'https://mukti-frequency.test';
const fixturesDirectory = bundleOnly ? null : await mkdtemp(join(tmpdir(), 'mukti-frequency-smoke-'));

async function runScenario({ hz, name, viewport, isMobile }) {
  const started = performance.now();
  const wavPath = join(fixturesDirectory, `${hz}.wav`);
  await writeFile(wavPath, createToneWav(hz));
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || process.env.CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${wavPath}`,
    ],
  });
  const errors = [];
  let page;
  try {
    const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort('blockedbyclient');
      if (url.pathname === '/bundle.js') return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: javascript });
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.fulfill({ status: 404, body: 'Not found' });
    });
    // Simulates the user's permission grant, not the physical permission dialog.
    await context.grantPermissions(['microphone'], { origin });
    await context.addInitScript(() => {
      const smoke = { calls: 0, constraints: [], tracks: [], requestErrors: [] };
      window.__frequencySmoke = smoke;
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        smoke.calls += 1;
        smoke.constraints.push(constraints);
        try {
          // Delegates to Chromium: there is no fake MediaStream or AudioContext.
          const stream = await original(constraints);
          smoke.tracks.push(...stream.getTracks());
          return stream;
        } catch (error) {
          smoke.requestErrors.push(String(error));
          throw error;
        }
      };
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByTestId('frequency-meter').waitFor({ state: 'visible' });
    const permission = await page.evaluate(async () =>
      (await navigator.permissions.query({ name: 'microphone' })).state);
    assert.equal(permission, 'granted');
    const start = page.getByRole('button', { name: 'Démarrer la mesure', exact: true });
    const stop = page.getByRole('button', { name: 'Arrêter le microphone', exact: true });
    assert.equal(await start.isDisabled(), true, 'The source checkbox must be required.');
    assert.equal(await stop.isDisabled(), true);
    assert.equal(await page.evaluate(() => window.__frequencySmoke.calls), 0, 'Mounting the component must not open capture.');
    assert.equal(await page.getByTestId('measured-frequency').textContent(), '—');

    await page.getByRole('checkbox').check();
    assert.equal(await start.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.__frequencySmoke.calls), 0, 'Checking the box must not open capture.');
    await start.click();
    await page.waitForFunction(() => window.__frequencySmoke.calls === 1);
    const expectedStatus = hz === 432
      ? 'Composante dominante stable, proche de 432 Hz.'
      : 'Fréquence dominante différente de 432 Hz.';
    await page.waitForFunction(expected =>
      document.querySelector('[data-testid="measurement-status"]')?.textContent === expected,
    expectedStatus, { timeout: 15000 });

    const measured = await page.getByTestId('measured-frequency').textContent();
    assert.ok(Math.abs(Number.parseFloat(measured) - hz) < 0.3, `Expected ${hz} Hz; got ${measured}.`);
    assert.equal(await page.getByRole('checkbox').isDisabled(), true);
    assert.equal(await start.isDisabled(), true);
    assert.equal(await stop.isEnabled(), true);
    const captured = await page.evaluate(() => ({
      calls: window.__frequencySmoke.calls,
      trackStates: window.__frequencySmoke.tracks.map(track => track.readyState),
      constraints: window.__frequencySmoke.constraints,
      requestErrors: window.__frequencySmoke.requestErrors,
    }));
    assert.equal(captured.calls, 1);
    assert.ok(captured.trackStates.length > 0 && captured.trackStates.every(state => state === 'live'));
    assert.deepEqual(captured.requestErrors, []);
    const processing = await page.getByTestId('input-processing').textContent();

    await stop.click();
    await page.waitForFunction(() => window.__frequencySmoke.tracks.every(track => track.readyState === 'ended'));
    assert.equal(await page.getByTestId('measured-frequency').textContent(), '—', 'Stopping must remove the stale result.');
    assert.equal(await page.getByTestId('measurement-status').textContent(), 'Mesure arrêtée. Microphone libéré.');
    assert.equal(await stop.isDisabled(), true);
    assert.equal(await start.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.__frequencySmoke.calls), 1);
    assert.deepEqual(errors, [], 'Unexpected browser/console errors.');
    return {
      name, sourceHz: hz, measured, expectedStatus, viewport, isMobile,
      browserVersion: browser.version(), permission,
      captureCalls: captured.calls, tracksReleased: captured.trackStates.length,
      noAutoCapture: true, checkboxRequired: true, resultClearedOnStop: true,
      processing, errors, durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    const diagnostics = page ? await page.evaluate(() => ({
      status: document.querySelector('[data-testid="measurement-status"]')?.textContent,
      value: document.querySelector('[data-testid="measured-frequency"]')?.textContent,
      calls: window.__frequencySmoke?.calls,
      trackStates: window.__frequencySmoke?.tracks.map(track => track.readyState),
      requestErrors: window.__frequencySmoke?.requestErrors,
    })).catch(() => null) : null;
    throw new Error(`${name}: ${error.message}\n${JSON.stringify({ diagnostics, errors })}`, { cause: error });
  } finally {
    await browser.close();
  }
}

try {
  if (bundleOnly) {
    process.stdout.write(JSON.stringify({ status: 'passed', mode: 'bundle-only', bundleChecks }, null, 2) + '\n');
  } else {
    const scenarios = [];
    scenarios.push(await runScenario({ name: 'desktop-432-stable', hz: 432, viewport: { width: 1280, height: 900 }, isMobile: false }));
    scenarios.push(await runScenario({ name: 'mobile-440-off-target', hz: 440, viewport: { width: 390, height: 844 }, isMobile: true }));
    process.stdout.write(JSON.stringify({
      status: 'passed', bundleChecks, scenarios,
      scope: 'Current isolated React component with native Chromium capture/Web Audio and independent synthetic WAV inputs. No physical microphone, full Next app, iOS or Android OS tested.',
    }, null, 2) + '\n');
  }
} finally {
  if (fixturesDirectory) await rm(fixturesDirectory, { recursive: true, force: true });
}
