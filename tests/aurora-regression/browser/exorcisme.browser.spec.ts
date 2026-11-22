import { test, expect } from './browser-test'

const ID = '00000000-0000-4000-8000-000000000001'

test('rituel mobile : sortie pendant un démarrage sans reprise tardive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.clock.install()
  let finish!: () => void
  const pending = new Promise<void>(resolve => { finish = resolve })
  let starts = 0
  await page.route('**/api/exorcisme/start', async route => {
    starts++
    await pending
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, session_id: ID, possession_text: 'une habitude' }) })
  })
  await page.goto('/exorcisme.html')
  await page.clock.runFor(10_600)
  await page.getByRole('textbox', { name: 'Ce qui me possède' }).fill('une habitude')
  await page.getByRole('button', { name: 'Nommer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Démarrage…' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('navigation-complete')).toBeVisible()
  finish()
  await page.clock.runFor(1_000)
  expect(starts).toBe(1)
  await expect(page.getByRole('button', { name: 'Frapper pour briser' })).toHaveCount(0)
})

test('rituel complet : quatre actions, reçu refusé puis reprise identique et explicite', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.clock.install()
  let affirmations = 0
  const saves: Record<string, unknown>[] = []
  await page.route('**/api/exorcisme/start', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, session_id: ID, possession_text: 'une habitude' }) }))
  await page.route('**/api/exorcisme/affirmation', async route => {
    affirmations++
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, affirmation_fr: 'Je peux avancer à mon rythme.', affirmation_en: 'I can move at my own pace.', source: 'fallback' }) })
  })
  await page.route('**/api/exorcisme/complete', async route => {
    saves.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: saves.length === 1 ? 503 : 200, contentType: 'application/json',
      body: JSON.stringify(saves.length === 1 ? { error: 'Enregistrement non confirmé.' } : { ok: true, stats: {} }) })
  })
  await page.goto('/exorcisme.html')
  await page.clock.runFor(10_600)
  await page.clock.fastForward(1_200_000)
  await page.getByRole('textbox', { name: 'Ce qui me possède' }).fill('une habitude')
  await page.getByRole('button', { name: 'Nommer', exact: true }).click()
  await page.clock.runFor(700)
  const tap = page.getByRole('button', { name: 'Frapper pour briser' })
  await expect(tap).toBeVisible()
  for (let i = 0; i < 4; i++) await tap.click()
  await expect(tap).toBeDisabled()
  await page.clock.runFor(1_600)
  await expect(page.locator('blockquote')).toHaveText('« Je peux avancer à mon rythme. »')
  await page.clock.runFor(18_700)
  await page.getByRole('button', { name: 'Sceller', exact: true }).click()
  await page.clock.runFor(700)
  await expect(page.getByRole('alert')).toContainText('non confirmé')
  await expect(page.getByRole('heading', { name: 'Séance arrêtée' })).toBeFocused()
  await expect(page.getByTestId('navigation-complete')).toHaveCount(0)
  expect(affirmations).toBe(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: info.outputPath('ritual-save-retry-mobile.png'), fullPage: true })
  await page.clock.runFor(5_000)
  await page.getByRole('button', { name: 'Réessayer l’enregistrement' }).click()
  await expect(page.getByTestId('navigation-complete')).toBeVisible()
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
  expect(saves[0]).toMatchObject({ session_id: ID, outcome: 'completed', taps_destruction: 4, sealed: true })
  expect(Number(saves[0].duration_sec)).toBeGreaterThan(1_200)
  expect(Number((saves[0].phases_ms as Record<string, unknown>).revelation)).toBeGreaterThan(600_000)
})
