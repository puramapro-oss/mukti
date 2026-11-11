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
  for (const file of ['src/app/(dashboard)/dashboard/profile/accessibility/page.tsx', 'src/components/ui/Modal.tsx', 'src/components/shared/ShareStoryButton.tsx', 'tests/accessibility/Fixture.tsx', 'tests/accessibility/server.tsx', 'tests/accessibility/client.tsx', 'src/app/globals.css', 'src/app/accessibility.css', 'postcss.config.mjs']) {
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
const report = { sourceBase: '2ab63923e1dbc31adac428da0a7754d8092d68aa', testedCommit: process.env.GITHUB_SHA ?? null, scope: 'Actual AccessibilityPage, shared native Modal, preference components and hooks, compiled application styles, SSR/hydration in a local browser fixture. Dashboard layout, next/font, complete Next route, physical hardware and production are not qualified.', stylesheets: cssReport, runtime: { node: process.version, react: require('react/package.json').version, typescript: require('typescript/package.json').version, playwright: tooling('playwright/package.json').version, axe: require('axe-core/package.json').version }, checks: [], errors: [] };
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
  const modalTrigger = page.getByRole('button', { name: 'Ouvrir la fenêtre de test', exact: true });
  await modalTrigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Exemple de partage', exact: true });
  await dialog.waitFor({ state: 'visible', timeout: 3000 });
  const closeModal = dialog.getByRole('button', { name: 'Fermer', exact: true });
  assert.equal(await closeModal.evaluate(el => el === document.activeElement), true, 'Closing must be available immediately on open.');
  const closeBox = await closeModal.boundingBox();
  assert.ok(closeBox.width >= 44 && closeBox.height >= 44, 'Close target must be at least 44 × 44 CSS pixels.');
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'Focus must remain inside the native modal.');
  }
  await dialog.getByRole('textbox', { name: 'Message de test' }).fill('Texte de contrôle');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await modalTrigger.evaluate(el => el === document.activeElement), true, 'Escape must restore focus to the trigger.');
  assert.equal(await page.locator('#modal-close-count').textContent(), 'Fermetures : 1', 'Escape requests exactly one close.');
  await page.keyboard.press('Enter');
  await dialog.waitFor({ state: 'visible' });
  await closeModal.click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await modalTrigger.evaluate(el => el === document.activeElement), true, 'The close button must restore focus.');
  assert.equal(await page.locator('#modal-submit-count').textContent(), 'Actions : 0', 'Closing a modal inside a form must not submit the form.');
  const untitledTrigger = page.getByRole('button', { name: 'Ouvrir sans titre', exact: true });
  await untitledTrigger.click();
  const untitled = page.getByRole('dialog', { name: 'Fenêtre de dialogue', exact: true });
  await untitled.waitFor({ state: 'visible' });
  await untitled.getByRole('button', { name: 'Fermer', exact: true }).click();
  await untitled.waitFor({ state: 'detached' });
  assert.equal(await untitledTrigger.evaluate(el => el === document.activeElement), true);
  report.checks.push('Native shared modal: accessible title and fallback, named 44px close target, initial focus, Tab containment, Escape exactly once, return focus, repeated opening and no accidental form submission.');
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
  report.modalReflow = [];
  for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 360 }]) {
    const storyContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    let shareRequests = 0;
    const storyPage = await storyContext.newPage();
    storyPage.on('pageerror', error => report.errors.push(String(error)));
    await storyPage.route('**/api/story/share', async route => {
      shareRequests++;
      assert.equal(route.request().method(), 'POST');
      const body = route.request().postDataJSON();
      assert.equal(body.type, 'streak'); assert.equal(body.shared_to, 'native');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, share_id: 'synthetic-accessibility-share', points_given: 0, daily_remaining: 0,
        referral_url: 'https://example.invalid/partage-synthetique',
        image_url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'%3E%3Crect width='1080' height='1920' fill='%23365974'/%3E%3C/svg%3E",
      }) });
    });
    await storyPage.goto(origin);
    await storyPage.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'md');
    await storyPage.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const storyTrigger = storyPage.getByRole('button', { name: 'Ouvrir le partage complet', exact: true });
    await storyTrigger.focus(); await storyPage.keyboard.press('Enter');
    const storyDialog = storyPage.getByRole('dialog', { name: '🚀 Partage ta story', exact: true });
    await storyDialog.getByTestId('share-story-image').waitFor({ state: 'visible' });
    const reading = storyDialog.getByRole('region', { name: 'Contenu de la fenêtre', exact: true });
    const dismiss = storyDialog.getByRole('button', { name: 'Fermer', exact: true });
    const lastAction = storyDialog.getByTestId('share-story-download');
    const measure = () => storyDialog.evaluate(dialog => {
      const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; };
      const region = dialog.querySelector('[role="region"]');
      return { viewport: { width: innerWidth, height: innerHeight }, rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
        close: box(dialog.querySelector('[aria-label="Fermer"]')), content: box(region), lastAction: box(dialog.querySelector('[data-testid="share-story-download"]')),
        scrollTop: region.scrollTop, scrollHeight: region.scrollHeight, clientHeight: region.clientHeight, clientWidth: region.clientWidth, scrollWidth: region.scrollWidth };
    });
    const inside = (box, size) => box.x >= -1 && box.y >= -1 && box.right <= size.width + 1 && box.bottom <= size.height + 1;
    const before = await measure();
    assert.equal(before.rootFontSize, 32);
    assert.ok(inside(before.close, viewport) && before.close.width >= 44 && before.close.height >= 44, 'The close action must remain entirely visible with enlarged text.');
    assert.ok(inside(before.content, viewport) && before.content.height >= 96, 'A useful part of the long content must remain visible.');
    assert.ok(before.scrollHeight > before.clientHeight, 'The real share content must exercise vertical scrolling.');
    assert.ok(before.scrollWidth <= before.clientWidth + 1, 'Share content must not require horizontal scrolling.');
    await reading.focus(); await storyPage.keyboard.press('End');
    await storyPage.waitForFunction(() => { const region = document.querySelector('dialog [role="region"]'); return region && region.scrollTop >= region.scrollHeight - region.clientHeight - 2; });
    const afterEnd = await measure();
    assert.ok(inside(afterEnd.close, viewport));
    assert.ok(inside(afterEnd.lastAction, viewport), 'The final share action must be visible after keyboard scrolling.');
    for (let step = 0; step < 20 && !(await lastAction.evaluate(element => element === document.activeElement)); step++) {
      await storyPage.keyboard.press('Tab');
      assert.equal(await storyDialog.evaluate(element => element.contains(document.activeElement)), true);
    }
    assert.equal(await lastAction.evaluate(element => element === document.activeElement), true, 'The final action must be reachable with Tab.');
    const afterTab = await measure();
    assert.ok(inside(afterTab.close, viewport) && inside(afterTab.lastAction, viewport));
    await storyPage.screenshot({ path: path.join(output, `mukti-modal-${viewport.width}x${viewport.height}.png`) });
    await dismiss.focus(); await storyPage.keyboard.press('Enter');
    await storyDialog.waitFor({ state: 'detached' });
    assert.equal(await storyTrigger.evaluate(element => element === document.activeElement), true);
    assert.equal(shareRequests, 1, 'Only the intercepted synthetic loading request is allowed; sharing actions are never activated.');
    report.modalReflow.push({ viewport, before, afterEnd, afterTab, returnedFocus: true, syntheticShareRequests: shareRequests });
    await storyContext.close();
  }
  report.checks.push('Real ShareStoryButton with intercepted synthetic loading: 320×640 and 640×360 at 200% text, visible close action, bounded reading region, End scrolling, final action reachable by Tab and focus returned without activating any share endpoint.');
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
