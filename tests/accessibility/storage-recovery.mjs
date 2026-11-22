import assert from 'node:assert/strict';

export async function verifyStorageRecovery(browser, origin, report) {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const originalGet = Storage.prototype.getItem, originalSet = Storage.prototype.setItem;
      window.__blockMuktiReads = false; window.__blockMuktiWrites = false;
      Storage.prototype.getItem = function(key) {
        if (key === 'mukti.a11y.prefs' && window.__blockMuktiReads) throw new DOMException('Read unavailable', 'SecurityError');
        return originalGet.call(this, key);
      };
      Storage.prototype.setItem = function(key, value) {
        if (key === 'mukti.a11y.prefs' && window.__blockMuktiWrites) throw new DOMException('Storage full', 'QuotaExceededError');
        return originalSet.call(this, key, value);
      };
    });
    const local = await context.newPage(), remote = await context.newPage();
    for (const page of [local, remote]) {
      page.on('pageerror', error => report.errors.push(String(error)));
      await page.goto(origin);
      await page.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'md');
    }
    await local.evaluate(() => { window.__blockMuktiWrites = true; });
    await local.getByRole('radio', { name: 'Très grand', exact: true }).check();
    await local.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl');
    assert.match(await local.getByRole('status').innerText(), /dans cet onglet/);
    await remote.getByRole('switch', { name: 'Renforcer les contrastes du thème', exact: true }).check();
    await local.waitForFunction(() => document.documentElement.dataset.muktiContrast === 'true');
    assert.equal(await local.getByRole('radio', { name: 'Très grand', exact: true }).isChecked(), true, 'A real storage event must retain the unsaved local size.');

    await local.evaluate(() => { window.__blockMuktiWrites = false; });
    await local.getByRole('switch', { name: 'Réduire les animations', exact: true }).check();
    assert.match(await local.getByRole('status').innerText(), /enregistrée/);
    await remote.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl' && document.documentElement.dataset.muktiReducedMotion === 'true');
    const writeRecovery = await remote.evaluate(() => JSON.parse(localStorage.getItem('mukti.a11y.prefs')));
    assert.equal(writeRecovery.fontSize, 'xl'); assert.equal(writeRecovery.highContrast, true); assert.equal(writeRecovery.reducedMotionForced, true);
    await remote.getByRole('radio', { name: 'Grand', exact: true }).check();
    await local.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'lg');

    const beforeBlockedRead = await remote.evaluate(() => localStorage.getItem('mukti.a11y.prefs'));
    await local.evaluate(() => { window.__blockMuktiReads = true; });
    await local.getByRole('radio', { name: 'Très grand', exact: true }).check();
    await local.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl');
    assert.match(await local.getByRole('status').innerText(), /dans cet onglet/);
    assert.equal(await local.getByRole('switch', { name: 'Renforcer les contrastes du thème', exact: true }).isChecked(), true, 'Temporary failed reads must retain the last observed contrast.');
    assert.equal(await remote.evaluate(() => localStorage.getItem('mukti.a11y.prefs')), beforeBlockedRead, 'A blocked read must prevent overwriting storage even if setItem works.');
    await remote.getByRole('switch', { name: 'Renforcer les contrastes du thème', exact: true }).uncheck();
    await local.evaluate(() => { window.__blockMuktiReads = false; });
    await local.getByRole('switch', { name: 'Réduire les animations', exact: true }).uncheck();
    await remote.waitForFunction(() => document.documentElement.dataset.muktiTextSize === 'xl' && document.documentElement.dataset.muktiContrast === 'false' && document.documentElement.dataset.muktiReducedMotion === 'false');
    const readRecovery = await remote.evaluate(() => JSON.parse(localStorage.getItem('mukti.a11y.prefs')));
    assert.equal(readRecovery.fontSize, 'xl'); assert.equal(readRecovery.highContrast, false); assert.equal(readRecovery.reducedMotionForced, false);
    report.storageRecovery = { status: 'PASS', contexts: 1, tabs: 2, writeRecovery, readRecovery,
      scope: 'Real UI and browser localStorage/storage events; read/write failures injected per tab. No cross-origin or account synchronization.' };
    report.checks.push('Two real tabs: blocked writes keep local size while remote contrast arrives; recovery persists both, releases local precedence, and failed reads never overwrite unseen remote settings.');
  } finally { await context.close(); }
}
