import { test, expect } from '@playwright/test'
import { installWidgetNativeFixture } from './widget-native-fixture'

// This feature needs no microphone permission; audio scenarios keep their own grant.
test.use({ permissions: [] })

const items = [
  'Je reviens à l’essentiel, une respiration à la fois.',
  'Je m’accorde le droit de ralentir.',
  'Je peux avancer à mon rythme.',
  'Un petit pas suffit pour commencer.',
  'Je laisse de la place à ce qui me fait du bien.',
  'Je peux accueillir cette journée avec douceur.',
  'Je choisis la bienveillance envers moi-même.',
].map((text, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, text }))

test('widget settings render, select, navigate and remain honest about the web surface', async ({ page }) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true, items } }))
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/widget.html')
  await expect(page.getByRole('heading', { name: 'Un mot doux. Au bon moment.' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(7)
  await expect(page.getByText('À configurer dans l’application mobile')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer ma sélection' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Affirmations', exact: true })).toHaveAttribute('href', '/dashboard/subconscient')
  await page.getByRole('radio', { name: 'Trois moments' }).check()
  await expect(page.getByText('Prévu à 7 h, 13 h et 20 h', { exact: false })).toBeVisible()
  await page.getByRole('checkbox').first().uncheck()
  await expect(page.getByRole('heading', { name: 'Ma sélection 6 / 30' })).toBeVisible()
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('heading', { name: 'Ma sélection 7 / 30' })).toBeVisible()
  await page.screenshot({ path: 'browser/test-results/widget-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('widget-preview-text')).not.toHaveText('Choisis les mots que tu aimerais retrouver.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByText('Comment l’ajouter à mon écran ?').click()
  await expect(page.getByRole('heading', { name: 'Sur iPhone · iOS 16 ou plus récent' })).toBeVisible()
  await page.screenshot({ path: 'browser/test-results/widget-mobile.png', fullPage: true })
  expect(failures).toEqual([])
})

test('catalogue failures remain retryable, and empty categories are visible', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/affirmations/widget?**', route => {
    attempts++
    return attempts === 1
      ? route.fulfill({ status: 503, json: { ok: false, error: 'Le catalogue est momentanément indisponible.' } })
      : route.fulfill({ json: { ok: true, items: [] } })
  })
  await page.goto('/widget.html')
  await expect(page.getByRole('alert')).toHaveText('Le catalogue est momentanément indisponible.')
  await page.getByRole('button', { name: 'Actualiser le catalogue' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Aucune phrase courte disponible pour ce choix.', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ma sélection 0 / 30' })).toBeVisible()
})

test('changing catalogue language replaces a selected translation without duplicates', async ({ page }) => {
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true,
    items: route.request().url().includes('locale=en') ? [{ ...items[0], text: 'I can take my time.' }] : items,
  } }))
  await page.goto('/widget.html')
  await expect(page.getByRole('heading', { name: 'Ma sélection 7 / 30' })).toBeVisible()
  await page.getByLabel('Langue du catalogue').selectOption('en')
  const translated = page.getByRole('checkbox', { name: 'I can take my time.' })
  await expect(translated).not.toBeChecked()
  await translated.check()
  await expect(page.getByRole('button', { name: 'Retirer : I can take my time.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ma sélection 7 / 30' })).toBeVisible()
})

test('removing phrases preserves keyboard position and an empty draft survives catalogue refresh', async ({ page }) => {
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true, items: items.slice(0, 2) } }))
  await page.goto('/widget.html')
  const firstRemove = page.getByRole('button', { name: `Retirer : ${items[0].text}`, exact: true })
  const secondRemove = page.getByRole('button', { name: `Retirer : ${items[1].text}`, exact: true })
  await firstRemove.focus()
  await page.keyboard.press('Enter')
  await expect(secondRemove).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Ma sélection 0 / 30' })).toBeFocused()
  await page.getByRole('button', { name: 'Actualiser le catalogue' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Ma sélection 0 / 30' })).toBeVisible()
  await expect(page.getByRole('checkbox').first()).not.toBeChecked()
})

test('existing accessibility preferences apply to widget controls with 200 percent text and 320px reflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mukti.a11y.prefs', JSON.stringify({
    fontSize: 'xl', highContrast: true, reducedMotionForced: true,
  })))
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true, items } }))
  await page.goto('/widget.html')
  await expect(page.locator('html')).toHaveAttribute('data-mukti-text-size', 'xl')
  await expect(page.locator('html')).toHaveAttribute('data-mukti-contrast', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-mukti-reduced-motion', 'true')
  await page.getByText('Comment l’ajouter à mon écran ?').click()
  const text = page.getByTestId('widget-preview-text')
  // Preference styles can finish on a later frame, even with reduced motion.
  // Measure each settled size; keep the exact 200% requirement below.
  await expect(text).toHaveCSS('font-size', '22px')
  const preferredSize = await text.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%' })
  await expect(text).toHaveCSS('font-size', '16px')
  const defaultSize = await text.evaluate(element => parseFloat(getComputedStyle(element).fontSize))
  expect(preferredSize).toBeGreaterThan(defaultSize)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
    // The dashboard's p-4 parent also scales with the user's root font size.
    document.getElementById('root')!.style.padding = '1rem'
  })
  await expect(text).toHaveCSS('font-size', `${defaultSize * 2}px`)
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
    for (const width of [320, 640]) {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 360 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const metrics = await page.locator('button, a, select, summary, label:has(input)').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect()
        return { name: element.textContent?.trim(), width: rect.width, height: rect.height }
      }))
      expect(metrics.filter(rect => rect.width < 44 || rect.height < 44)).toEqual([])
      const phrase = await text.boundingBox()
      const caption = await page.locator('figcaption').boundingBox()
      expect(phrase && caption && phrase.y + phrase.height <= caption.y).toBe(true)
      await page.screenshot({ path: `browser/test-results/widget-${theme}-${width}-text200.png`, fullPage: true })
    }
  }
})

test('native recovery, verified saving and Android pinning remain distinct in the real editor', async ({ page }) => {
  await installWidgetNativeFixture(page, { failRead: true })
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true, items } }))
  await page.goto('/widget.html')
  await expect(page.getByRole('alert')).toContainText('Lecture du téléphone indisponible')
  await page.getByRole('button', { name: 'Actualiser le catalogue' }).click()
  await expect(page.getByRole('alert')).toContainText('Lecture du téléphone indisponible')
  await page.getByRole('checkbox').first().uncheck()
  await page.evaluate(() => { window.__widgetNativeFixture.failRead = false })
  await page.getByRole('button', { name: 'Réessayer la connexion au téléphone' }).click()
  await expect(page.getByRole('heading', { name: 'Ma sélection 6 / 30' })).toBeVisible()
  await expect(page.getByText('Modifications non enregistrées', { exact: true })).toBeVisible()
  const save = page.getByRole('button', { name: 'Enregistrer ma sélection' })
  await save.click()
  await expect(save).toBeDisabled()
  expect(await page.evaluate(() => window.__widgetNativeFixture.writes)).toBe(1)
  await page.evaluate(() => { window.__widgetNativeFixture.pinDelayMs = 100 })
  await page.getByRole('button', { name: 'Ajouter à mon écran d’accueil' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Demande envoyée' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Sélection à jour sur le téléphone' })).toBeFocused()
  await expect(page.getByText('Un widget MUKTI est ajouté sur ce téléphone.')).toHaveCount(0)
  await page.evaluate(() => {
    window.__widgetNativeFixture.state.installed = true
    window.__widgetNativeFixture.resume()
  })
  await expect(page.getByText('Un widget MUKTI est ajouté sur ce téléphone.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ma sélection 6 / 30' })).toBeVisible()
  expect(await page.evaluate(() => window.__widgetNativeFixture.pins)).toBe(1)
})

test('restoring saved choices never writes, and failed saving preserves the editable draft', async ({ page }) => {
  await installWidgetNativeFixture(page, { saved: {
    schemaVersion: 1, cadence: 'moments', items: items.slice(0, 2), configuredAt: '2026-11-11T07:00:00.000Z',
  } })
  await page.route('**/api/affirmations/widget?**', route => route.fulfill({ json: { ok: true, items } }))
  await page.goto('/widget.html')
  const save = page.getByRole('button', { name: 'Enregistrer ma sélection' })
  await expect(save).toBeDisabled()
  await page.getByRole('radio', { name: 'Chaque jour' }).check()
  await page.getByRole('button', { name: 'Revenir à la sélection enregistrée' }).click()
  await expect(page.getByRole('radio', { name: 'Trois moments' })).toBeChecked()
  await expect(save).toBeDisabled()
  expect(await page.evaluate(() => window.__widgetNativeFixture.writes)).toBe(0)
  await page.getByRole('checkbox').first().uncheck()
  await page.evaluate(() => { window.__widgetNativeFixture.failWrite = true })
  await save.click()
  await expect(page.getByRole('alert')).toContainText('Enregistrement simulé non confirmé.')
  await expect(page.getByRole('heading', { name: 'Ma sélection 1 / 30' })).toBeVisible()
  await expect(page.getByText('État enregistré à vérifier', { exact: true })).toBeVisible()
  await expect(save).toBeEnabled()
  await page.evaluate(() => { window.__widgetNativeFixture.failWrite = false })
  await save.click()
  await expect(save).toBeDisabled()
  await page.evaluate(() => { window.__widgetNativeFixture.failRead = true })
  await page.getByRole('button', { name: 'Retirer la sélection du téléphone' }).click()
  await expect(page.getByText('État enregistré à vérifier', { exact: true })).toBeVisible()
  await expect(page.getByText('Sélection à jour sur le téléphone', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => window.__widgetNativeFixture.state.configured)).toBe(false)
  await page.evaluate(() => { window.__widgetNativeFixture.failRead = false })
  await page.getByRole('button', { name: 'Réessayer la connexion au téléphone' }).click()
  await expect(page.getByText('Modifications non enregistrées', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ma sélection 1 / 30' })).toBeVisible()
  expect(await page.evaluate(() => window.__widgetNativeFixture.state.configured)).toBe(false)
})
