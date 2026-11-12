import { test, expect } from './browser-test'
import type { Page } from '@playwright/test'

type Probe = { contexts(): number; rms(): number; states(): string[] }
// The HTTP boundary is simulated; these are the fields returned by the real
// route and required by ModeFrame before it accepts an acknowledgement.
const receipt = (body: Record<string, unknown>) => ({
  id: body.client_session_id,
  mode: body.mode,
  addiction_id: String(body.addiction_id).toLowerCase(),
  started_at: body.started_at,
  completed_at: body.completed_at,
  duration_sec: body.duration_sec,
  outcome: body.outcome,
  urge_before: body.urge_before ?? null,
  urge_after: body.urge_after ?? null,
})
const probe = (page: Page) => page.evaluate(() => {
  const observed = (window as unknown as { __auroraProbe: Probe }).__auroraProbe
  return { contexts: observed.contexts(), rms: observed.rms(), states: observed.states() }
})
async function begin(page: Page, mode = 'multisensoriel') {
  await page.goto(`/modes.html?mode=${mode}`)
  await page.getByTestId('urge-before-5').click()
  await page.getByTestId('mode-start').click()
  await expect(page.getByRole('timer', { name: 'Temps restant' })).toBeVisible()
}

test('multisensoriel mobile: choix accessibles et reprise du même reçu après échec', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('mukti.a11y.prefs', JSON.stringify({ silentMode: true, reducedMotionForced: true, fontSize: 'lg' })))
  await page.clock.install({ time: new Date('2026-11-12T10:00:00Z') })
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/mode-sessions/log', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    bodies.push(body)
    await route.fulfill({ status: bodies.length === 1 ? 503 : 201, contentType: 'application/json',
      body: JSON.stringify(bodies.length === 1 ? { error: 'Indisponibilité simulée' } : { ok: true, session: receipt(body) }) })
  })
  await begin(page)
  await expect(page.getByText('Respire librement, à ton rythme')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activer le son 432 Hz' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }).check()
  await expect(page.getByTestId('multisensoriel-breath')).toHaveCSS('transform', 'none')
  expect((await probe(page)).contexts).toBe(0)
  await page.screenshot({ path: info.outputPath('multisensoriel-mobile.png'), fullPage: true })
  await page.clock.runFor(2500)
  await page.getByRole('button', { name: 'Arrêter la séance', exact: true }).click()
  await expect(page.getByText('Et maintenant ?', { exact: true })).toBeVisible()
  await page.getByTestId('urge-after-6').click()
  expect(bodies).toHaveLength(0)
  await page.getByTestId('mode-submit').click()
  await expect(page.getByTestId('mode-submit')).toBeEnabled()
  await expect(page.getByTestId('navigation-complete')).toHaveCount(0)
  await expect(page.getByText(/Enregistrement non confirmé/).first()).toBeVisible()
  await page.clock.runFor(25_000)
  await page.getByTestId('mode-submit').click()
  await expect(page.getByTestId('navigation-complete')).toBeVisible()
  await expect(page.getByTestId('navigation-complete')).toHaveAttribute('data-destination', '/dashboard/liberation/20000000-0000-4000-8000-000000000012')
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[0].outcome).toBe('interrupted')
  expect(bodies[0].duration_sec).toBeLessThan(25)
  expect(bodies[0].client_session_id).toMatch(/^[0-9a-f-]{36}$/i)
})

test('la fin du multisensoriel enregistre une activité terminée sans résultat de santé inventé', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-12T11:00:00Z') })
  let body: Record<string, unknown> | undefined
  await page.route('**/api/mode-sessions/log', async route => {
    body = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, session: receipt(body) }) })
  })
  await begin(page)
  await page.clock.runFor(180_500)
  await expect(page.getByTestId('mode-submit')).toBeVisible()
  expect(body).toBeUndefined()
  await page.getByTestId('mode-submit').click()
  await expect(page.getByTestId('navigation-complete')).toBeVisible()
  expect(body?.outcome).toBe('completed')
  expect(body?.urge_after).toBeUndefined()
  expect((await probe(page)).contexts).toBe(0)
})

test('le vrai moteur audio reste volontaire, suit le silence et ne reprend pas après pagehide', async ({ page }, info) => {
  await begin(page)
  expect((await probe(page)).contexts).toBe(0)
  await page.getByRole('button', { name: 'Activer le son 432 Hz' }).click()
  await expect(page.getByRole('button', { name: 'Couper le son' })).toBeVisible()
  await expect.poll(async () => (await probe(page)).rms).toBeGreaterThan(0.0000001)
  await page.screenshot({ path: info.outputPath('multisensoriel-audio.png'), fullPage: true })
  await page.evaluate(() => {
    localStorage.setItem('mukti.a11y.prefs', JSON.stringify({ silentMode: true }))
    window.dispatchEvent(new Event('mukti:a11y-prefs-change'))
  })
  await expect(page.getByRole('button', { name: 'Activer le son 432 Hz' })).toBeDisabled()
  await expect.poll(async () => (await probe(page)).rms).toBe(0)
  await page.evaluate(() => {
    localStorage.setItem('mukti.a11y.prefs', JSON.stringify({ silentMode: false }))
    window.dispatchEvent(new Event('mukti:a11y-prefs-change'))
  })
  await expect(page.getByRole('button', { name: 'Activer le son 432 Hz' })).toBeEnabled()
  expect((await probe(page)).rms).toBe(0)
  await page.getByRole('button', { name: 'Activer le son 432 Hz' }).click()
  await expect.poll(async () => (await probe(page)).rms).toBeGreaterThan(0.0000001)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(page.getByTestId('mode-submit')).toBeVisible()
  await expect.poll(async () => (await probe(page)).rms).toBe(0)
  await expect.poll(async () => (await probe(page)).states.every(state => state === 'closed')).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await expect(page.getByRole('region', { name: 'Pause multisensorielle' })).toHaveCount(0)
})

test('micro-méditation: texte, mouvement réduit et fin sans sauvegarde automatique', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-11-12T12:00:00Z') })
  await begin(page, 'micro')
  await page.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }).check()
  await expect(page.getByTestId('micro-meditation-breath')).toHaveCSS('transform', 'none')
  await expect(page.getByText('Une pause choisie, à mon rythme.', { exact: false })).toBeVisible()
  await page.screenshot({ path: info.outputPath('micro-meditation-mobile.png'), fullPage: true })
  await page.clock.runFor(30_500)
  await expect(page.getByTestId('mode-submit')).toBeVisible()
  expect((await probe(page)).contexts).toBe(0)
  await page.getByRole('button', { name: /Sortir sans/ }).click()
  await expect(page.getByTestId('navigation-complete')).toBeVisible()
  await expect(page.getByTestId('navigation-complete')).toHaveAttribute('data-destination', '/dashboard/liberation/20000000-0000-4000-8000-000000000012')
})
