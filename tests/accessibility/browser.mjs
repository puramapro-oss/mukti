import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const tooling = process.env.A11Y_TOOLING_PACKAGE ? createRequire(process.env.A11Y_TOOLING_PACKAGE) : require;
const { build } = tooling('esbuild');
const { chromium } = tooling('playwright');
const output = path.join(root, 'tests/accessibility/evidence');
await mkdir(output, { recursive: true });
const aliases = { '@': path.join(root, 'src'), 'react': path.dirname(require.resolve('react/package.json')), 'react-dom': path.dirname(require.resolve('react-dom/package.json')) };
const common = { absWorkingDir: root, bundle: true, jsx: 'automatic', alias: aliases, logLevel: 'silent' };
await build({ ...common, entryPoints: ['tests/accessibility/server.tsx'], platform: 'node', format: 'cjs', outfile: path.join(output, 'server.cjs') });
await build({ ...common, entryPoints: ['tests/accessibility/client.tsx'], platform: 'browser', format: 'iife', outfile: path.join(output, 'client.js') });
const { render } = require(path.join(output, 'server.cjs'));
const serverMarkup = render();
globalThis.window = { localStorage: { getItem: () => '{"fontSize":"xl","highContrast":true}' } };
try { assert.equal(render(), serverMarkup, 'Saved browser preferences must not change the initial hydration markup.'); }
finally { delete globalThis.window; }
await writeFile(path.join(output, 'ssr-report.json'), JSON.stringify({ status: 'PASS', scope: 'Actual SSR component tree renders identically with and without saved browser preferences.', serverMarkupBytes: Buffer.byteLength(serverMarkup) }, null, 2));
if (process.env.A11Y_SSR_ONLY === '1') { console.log('PASS: SSR markup is stable with saved browser preferences.'); process.exit(0); }
const cssReport = { status: 'NON_TESTE', scope: 'Actual page and stylesheet sources; Tailwind compiled with the application PostCSS configuration. Dashboard layout and next/font are not rendered.', sources: {}, runtime: {} };
let css;
try {
  for (const file of ['src/app/(dashboard)/dashboard/profile/accessibility/page.tsx', 'tests/accessibility/Fixture.tsx', 'tests/accessibility/server.tsx', 'tests/accessibility/client.tsx', 'src/app/globals.css', 'src/app/accessibility.css', 'postcss.config.mjs']) {
    cssReport.sources[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
  }
  const postcss = tooling('postcss');
  const tailwind = tooling('@tailwindcss/postcss');
  const { default: config } = await import(pathToFileURL(path.join(root, 'postcss.config.mjs')).href);
  assert.deepEqual(Object.keys(config.plugins), ['@tailwindcss/postcss'], 'Review the isolated compiler when application PostCSS plugins change.');
  const globalsPath = path.join(root, 'src/app/globals.css');
  const compiled = await postcss([tailwind({ ...config.plugins['@tailwindcss/postcss'], base: root })]).process(await readFile(globalsPath, 'utf8'), { from: globalsPath });
  css = compiled.css + '\n' + await readFile(path.join(root, 'src/app/accessibility.css'), 'utf8') + '\n@keyframes fixture-motion { from { opacity: .5; } to { opacity: 1; } }';
  await writeFile(path.join(output, 'compiled-css.log'), css);
  // The plugin exports its dist entry point, but not its package.json subpath.
  const tailwindPackage = JSON.parse(await readFile(path.resolve(path.dirname(tooling.resolve('@tailwindcss/postcss')), '../package.json'), 'utf8'));
  assert.equal(tailwindPackage.name, '@tailwindcss/postcss');
  cssReport.runtime = { postcss: tooling('postcss/package.json').version, tailwindcss: tooling('tailwindcss/package.json').version, tailwindPostcss: tailwindPackage.version };
  cssReport.compiledBytes = Buffer.byteLength(css);
  cssReport.compiledSha256 = createHash('sha256').update(css).digest('hex');
  cssReport.warnings = compiled.warnings().map(warning => warning.toString());
  cssReport.status = 'PASS_COMPILED';
} catch (error) { cssReport.status = 'FAIL'; cssReport.failure = String(error); throw error; }
finally { await writeFile(path.join(output, 'css-report.json'), JSON.stringify(cssReport, null, 2)); }
const bundle = await readFile(path.join(output, 'client.js'));
const html = '<!doctype html><html lang="fr" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test accessibilité MUKTI</title><style>' + css + '</style></head><body><div id="root">' + render() + '</div><script src="/client.js" defer></script></body></html>';
const server = http.createServer((req, res) => { if (req.url === '/client.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(bundle); } else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const report = { sourceBase: 'b7e76735d6ee2498d72be06d624e96a090f8ad96', testedCommit: process.env.GITHUB_SHA ?? null, scope: 'Actual AccessibilityPage, preference components and hooks, compiled application styles, SSR/hydration in a local browser fixture. Dashboard layout, next/font, complete Next route, physical hardware and production are not qualified.', stylesheets: cssReport, runtime: { node: process.version, react: require('react/package.json').version, typescript: require('typescript/package.json').version, playwright: tooling('playwright/package.json').version, axe: require('axe-core/package.json').version }, checks: [], errors: [] };
let browser;
try { browser = await chromium.launch({ headless: true, executablePath: process.env.A11Y_BROWSER_EXECUTABLE, args: ['--no-sandbox'] }); }
catch (error) { await writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ ...report, status: 'BLOCKED', failure: String(error) }, null, 2)); await new Promise(resolve => server.close(resolve)); throw error; }
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 1000 }, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('mukti.a11y.prefs')) localStorage.setItem('mukti.a11y.prefs', JSON.stringify({ fontSize: 'lg', silentMode: true, captionsForced: true }));
    window.__vibrations = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: value => { window.__vibrations.push(value); return true; } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.goto(origin);
  await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '18px');
  assert.equal(await page.locator('h1').count(), 1, 'The actual page must supply the sole h1.');
  assert.equal(await page.getByRole('heading', { level: 1, name: 'Accessibilité', exact: true }).count(), 1);
  assert.equal(await page.getByRole('switch', { name: 'Vibrations des pratiques' }).isChecked(), false);
  assert.equal(await page.getByRole('button', { name: 'Tester une vibration' }).isDisabled(), true);
  report.checks.push('Saved legacy settings hydrate without mismatch; previous silence remains effective.');
  await page.getByRole('radio', { name: 'Grand', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl');
  assert.equal(await page.getByRole('radio', { name: 'Très grand' }).isChecked(), true);
  await page.reload();
  await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '22px');
  const second = await context.newPage(); await second.goto(origin);
  await second.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl');
  await page.getByRole('radio', { name: 'Standard', exact: true }).check();
  await second.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'md');
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('mukti.a11y.prefs')));
  assert.equal(prefs.captionsForced, true);
  report.checks.push('Native radio arrow navigation, persistence and second-tab synchronization; legacy captions field retained.');
  await page.getByRole('switch', { name: 'Vibrations des pratiques' }).focus(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Tester une vibration' }).click();
  const patterns = await page.evaluate(() => window.__vibrations);
  assert.ok(patterns.some(item => Array.isArray(item) && item.length === 5));
  await page.getByRole('switch', { name: 'Vibrations des pratiques' }).uncheck();
  assert.equal((await page.evaluate(() => window.__vibrations)).at(-1), 0);
  report.checks.push('Keyboard switch enables requested haptics; disabling cancels current vibration. Hardware is stubbed.');
  const reduce = page.getByRole('switch', { name: 'Réduire les animations' });
  await reduce.check();
  await page.waitForFunction(() => document.getElementById('motion-result').dataset.reduced === 'true');
  assert.ok(parseFloat(await page.locator('#motion-sample').evaluate(el => getComputedStyle(el).animationDuration)) < .001);
  await reduce.uncheck(); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.getElementById('motion-result').dataset.reduced === 'true');
  report.checks.push('Forced motion preference affects shared hook and CSS; OS reduced motion stays active when the app switch is off.');
  await page.getByRole('switch', { name: 'Renforcer les contrastes du thème' }).check();
  await page.waitForFunction(() => getComputedStyle(document.getElementById('token-sample')).color === 'rgb(214, 216, 226)');
  assert.equal(await page.locator('#image-sample').evaluate(el => getComputedStyle(el).filter), 'none');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('token-sample')).color === 'rgb(54, 54, 71)');
  report.checks.push('Contrast tokens work in light and dark themes without filtering images.');
  await page.setViewportSize({ width: 320, height: 1100 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '32px');
  report.styleReadiness = { status: 'PENDING', timeoutMs: 5000, pollingMs: 100, requiredConsecutiveMatches: 2, scope: 'Observe the complete text-scale precondition; this does not establish a browser cause for an earlier inconsistent sample.' };
  try {
    await page.waitForFunction(() => {
      const probe = window.__muktiStyleProbe ??= { startedAt: performance.now(), samples: [], consecutiveMatches: 0 };
      const title = document.querySelector('h1'), header = title?.parentElement, wrapper = header?.parentElement;
      if (header?.tagName !== 'HEADER' || !wrapper) throw new Error('Expected the real page header and wrapper.');
      const headingStyle = getComputedStyle(title), wrapperStyle = getComputedStyle(wrapper), rootStyle = getComputedStyle(document.documentElement);
      const sample = {
        elapsedMs: performance.now() - probe.startedAt,
        headingCount: document.querySelectorAll('h1').length, title: title.textContent,
        rootFontSize: parseFloat(rootStyle.fontSize),
        headingFontSize: parseFloat(headingStyle.fontSize), headingLineHeight: headingStyle.lineHeight,
        headingFontWeight: headingStyle.fontWeight, headingOverflowWrap: headingStyle.overflowWrap, headingWordBreak: headingStyle.wordBreak,
        wrapperPaddingLeft: parseFloat(wrapperStyle.paddingLeft), wrapperPaddingRight: parseFloat(wrapperStyle.paddingRight), wrapperWidth: wrapper.getBoundingClientRect().width,
        bodyFontFamily: getComputedStyle(document.body).fontFamily,
        rootText2xl: rootStyle.getPropertyValue('--text-2xl').trim(), rootSpacing: rootStyle.getPropertyValue('--spacing').trim(),
      };
      probe.samples.push(sample);
      const matches = sample.rootFontSize === 32 && sample.headingFontSize === 48 && sample.wrapperPaddingLeft === 32 && sample.wrapperPaddingRight === 32;
      probe.consecutiveMatches = matches ? probe.consecutiveMatches + 1 : 0;
      return probe.consecutiveMatches >= 2;
    }, null, { timeout: 5000, polling: 100 });
    report.styleReadiness.status = 'PASS';
  } catch (error) {
    report.styleReadiness.status = 'FAIL'; report.styleReadiness.failure = String(error); throw error;
  } finally {
    try {
      Object.assign(report.styleReadiness, await page.evaluate(() => {
        const probe = window.__muktiStyleProbe, samples = probe?.samples ?? [];
        const observation = { initial: samples[0] ?? null, final: samples.at(-1) ?? null, samples, elapsedMs: probe ? performance.now() - probe.startedAt : null, consecutiveMatches: probe?.consecutiveMatches ?? 0 };
        delete window.__muktiStyleProbe;
        return observation;
      }));
      report.pageStyles = report.styleReadiness.final;
    } catch (error) { report.styleReadiness.observationFailure = String(error); }
    if (report.styleReadiness.status === 'FAIL') {
      try { await page.screenshot({ path: path.join(output, 'mukti-accessibility-style-failure.png'), fullPage: true }); }
      catch (error) { report.styleReadiness.captureFailure = String(error); }
    }
  }
  assert.equal(report.pageStyles.headingCount, 1);
  assert.equal(report.pageStyles.headingFontSize, 1.5 * report.pageStyles.rootFontSize, 'The real text-2xl utility must be compiled and applied.');
  assert.equal(report.pageStyles.headingFontWeight, '600', 'The real font-semibold utility must be compiled and applied.');
  assert.equal(report.pageStyles.wrapperPaddingLeft, report.pageStyles.rootFontSize, 'The real px-4 utility must be compiled and applied.');
  assert.equal(report.pageStyles.wrapperPaddingRight, report.pageStyles.rootFontSize);
  report.checks.push('The actual page supplies the sole h1; its Tailwind title and wrapper utilities are applied at 320px/200%. No fixture heading or wrapping rule.');
  report.reflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const outside = rect => rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > width + 1);
    const identify = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).replace(/\s+/g, '.') : '');
    const elementOverflows = [...document.body.querySelectorAll('*')].filter(el => outside(el.getBoundingClientRect())).map(el => ({ element: identify(el), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
    // Element boxes can fit while their text is clipped by an ancestor. Inspect text rectangles too.
    const textOverflows = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (outside(rect)) textOverflows.push({ parent: identify(node.parentElement), text: node.textContent.trim().slice(0, 160), left: rect.left, right: rect.right });
    }
    const headings = [...document.querySelectorAll('h1,h2,legend')].map(el => ({ element: identify(el), text: el.textContent, width: el.getBoundingClientRect().width }));
    const switchRows = [...document.querySelectorAll('.mukti-a11y-choice label')].map(label => {
      const span = label.querySelector('span').getBoundingClientRect(), control = label.querySelector('input').getBoundingClientRect(), box = label.getBoundingClientRect();
      return { text: label.querySelector('span').textContent, labelWidth: box.width, textWidth: span.width, textBottom: span.bottom, controlTop: control.top };
    });
    return { viewport: width, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, elementOverflows, textOverflows, headings, switchRows,
      rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize), buttonFontSize: parseFloat(getComputedStyle(document.querySelector('.mukti-accessibility-panel button')).fontSize),
      targetHeights: [...document.querySelectorAll('.mukti-accessibility-panel label, .mukti-accessibility-panel button')].map(el => el.getBoundingClientRect().height) };
  });
  await page.screenshot({ path: path.join(output, 'mukti-accessibility-mobile.png'), fullPage: true });
  assert.ok(report.reflow.documentWidth <= report.reflow.viewport + 1, 'Document must not overflow horizontally.');
  assert.ok(report.reflow.bodyWidth <= report.reflow.viewport + 1, 'Body must not overflow horizontally.');
  assert.deepEqual(report.reflow.elementOverflows, [], 'Every visible element must remain inside the viewport.');
  assert.deepEqual(report.reflow.textOverflows, [], 'Heading and body text must remain visible, including inside clipped ancestors.');
  assert.ok(report.reflow.switchRows.every(row => row.textWidth >= row.labelWidth - 1 && row.controlTop >= row.textBottom - 1), 'Mobile switches must put full-width labels above their controls.');
  assert.ok(report.reflow.targetHeights.every(height => height >= 44));
  assert.equal(report.reflow.buttonFontSize, report.reflow.rootFontSize, 'Button text must follow the chosen text size.');
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  report.axe = { themes: [], status: 'NON_TESTE' };
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const result = await page.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } });
      // Keep full incomplete nodes/check data for review; an ID alone loses the reason and target.
      return { violations: r.violations, incomplete: r.incomplete, passes: r.passes.length, bodyBackgroundImage: getComputedStyle(document.body).backgroundImage, bodyBackgroundColor: getComputedStyle(document.body).backgroundColor };
    });
    report.axe.themes.push({ theme, ...result });
  }
  const violations = report.axe.themes.flatMap(result => result.violations);
  const incomplete = report.axe.themes.flatMap(result => result.incomplete);
  report.axe.status = violations.length ? 'FAIL' : incomplete.length ? 'PARTIEL' : 'PASS';
  assert.deepEqual(violations, []);
  assert.deepEqual(incomplete.filter(result => result.id === 'color-contrast'), [], 'Contrast must be measurable in both enhanced-contrast themes; review full incomplete nodes in the report.');
  report.checks.push('320px/200%: no global or text overflow, headings visible, full-width switch labels, button text scales and targets are at least 44px. Enhanced-contrast themes checked by axe with incomplete details preserved.');
  await context.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); }; });
  const blockedPage = await blocked.newPage(); await blockedPage.goto(origin);
  await blockedPage.getByRole('radio', { name: 'Très grand' }).check();
  await blockedPage.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl');
  assert.match(await blockedPage.getByRole('status').innerText(), /dans cet onglet/);
  report.checks.push('Blocked persistence still changes this tab and announces the exact limitation.');
  await blocked.close();
  assert.deepEqual(report.errors, []);
  report.status = report.axe.status === 'PASS' ? 'PASS' : 'PARTIEL';
} catch (error) { report.status = 'FAIL'; report.failure = String(error); throw error; }
finally { await writeFile(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify(report, null, 2));
