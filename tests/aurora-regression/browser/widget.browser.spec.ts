import { test, expect } from '@playwright/test'

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
