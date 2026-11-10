import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const sample = {
  intention: 'Avancer sur mon projet créatif',
  outcome: 'Une page à partager',
  obstacle: 'Attendre la perfection',
  response: 'Écrire un brouillon court',
  action: 'Écrire cinq lignes',
  context: 'Demain à 18 h à mon bureau',
}

async function prepare(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Préparer un rituel' }).click()
  for (const [field, value] of Object.entries(sample)) await page.locator(`#ritual-${field}`).fill(value)
  await page.getByRole('button', { name: 'Préparer le texte', exact: true }).click()
  await expect(page.getByRole('heading', { name: '2. Vérifier ton texte' })).toBeVisible()
}

async function approve(page: Page) {
  await page.getByRole('checkbox', { name: 'J’ai relu ce texte' }).check()
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test('mobile : préparation, consentement, texte seul, pause, export et brouillon conservé', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = collectErrors(page)
  const apiRequests: string[] = []
  page.on('request', (request) => { if (request.url().includes('/api/')) apiRequests.push(request.url()) })
  await prepare(page)
  const start = page.getByRole('button', { name: 'Commencer mon rituel' })
  await expect(start).toBeDisabled()
  await page.getByRole('button', { name: 'Texte seul', exact: true }).click()
  await approve(page)
  await start.click()
  await expect(page.getByRole('heading', { name: 'Étape 1 sur 8' })).toBeVisible()
  await expect(page.getByText('Régularité du guidage')).toHaveCount(0)
  await expect(page.getByLabel('Avancement du rituel')).toHaveAttribute('max', '468')
  await expect.poll(() => page.getByRole('timer').innerText()).not.toContain('0:00 /')
  await page.getByRole('button', { name: 'Mettre le rituel en pause' }).click()
  const pausedTime = await page.getByRole('timer').innerText()
  await page.waitForTimeout(1100)
  expect(await page.getByRole('timer').innerText()).toBe(pausedTime)
  await page.getByRole('button', { name: 'Reprendre le rituel' }).click()
  await expect(page.getByRole('heading', { name: 'Étape 1 sur 8' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__auroraProbe.contexts())).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('ritual-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Arrêter le rituel' }).click()
  await expect(page.getByRole('heading', { name: 'Ton action reste prévue' })).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter mon texte et mon action' }).click()
  const download = await downloaded
  const exported = await readFile((await download.path())!, 'utf8')
  expect(exported).toContain('Statut de l’action : prévue.')
  expect(exported).toContain(sample.action)
  expect(exported).toContain('468 secondes')
  await page.getByRole('button', { name: 'Revenir à AURORA', exact: true }).click()
  await page.getByRole('button', { name: 'Préparer un rituel' }).click()
  await expect(page.locator('#ritual-intention')).toHaveValue(sample.intention)
  await expect(page.getByRole('button', { name: 'Commencer mon rituel' })).toBeDisabled()
  expect(apiRequests).toEqual([])
  expect(errors).toEqual([])
})

test('durée modifiable, aperçu invalidé et entrée Unicode sans troncature', async ({ page }) => {
  const errors = collectErrors(page)
  await prepare(page)
  await approve(page)
  await page.getByLabel('Durée du rituel').selectOption('focus')
  await expect(page.getByRole('button', { name: 'Commencer mon rituel' })).toBeDisabled()
  await expect(page.locator('#ritual-action')).toHaveValue(sample.action)
  await page.getByRole('button', { name: 'Préparer le texte', exact: true }).click()
  await approve(page)
  await page.getByRole('button', { name: 'Texte seul', exact: true }).click()
  await page.getByRole('button', { name: 'Commencer mon rituel' }).click()
  await expect(page.getByLabel('Avancement du rituel')).toHaveAttribute('max', '248')
  await page.getByRole('button', { name: 'Arrêter le rituel' }).click()
  await page.getByRole('button', { name: 'Revenir à AURORA', exact: true }).click()
  await page.getByRole('button', { name: 'Préparer un rituel' }).click()
  const unicode = '🌱'.repeat(160)
  await page.locator('#ritual-intention').fill(unicode)
  await expect(page.locator('#ritual-intention')).toHaveValue(unicode)
  await expect(page.locator('#ritual-intention-count')).toContainText('160/160')
  await page.locator('#ritual-intention').fill(unicode + 'x')
  await page.getByRole('button', { name: 'Préparer le texte', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('160 caractères')
  expect(errors).toEqual([])
})

test('vrai Web Audio : musique audible dans le graphe, silence immédiat, reprise et arrêt', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await prepare(page)
  await page.getByRole('checkbox', { name: 'Lire le guide à voix haute' }).uncheck()
  await approve(page)
  await page.getByRole('button', { name: 'Commencer mon rituel' }).click()
  const rms = () => page.evaluate(() => (window as any).__auroraProbe.rms() as number)
  await expect.poll(rms).toBeGreaterThan(0.001)
  await page.screenshot({ path: testInfo.outputPath('ritual-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Silence', exact: true }).click()
  await expect.poll(rms).toBeLessThan(0.00001)
  await expect(page.getByRole('button', { name: 'Mettre le rituel en pause' })).toBeVisible()
  await page.getByRole('button', { name: 'Mettre le rituel en pause' }).click()
  const musicVolume = page.getByLabel('Volume de la musique')
  await musicVolume.focus()
  await musicVolume.press('Home')
  for (let step = 0; step < 8; step += 1) await musicVolume.press('ArrowRight')
  await expect(musicVolume).toHaveValue('40')
  await page.getByRole('button', { name: 'Reprendre le rituel' }).click()
  await expect.poll(rms).toBeGreaterThan(0.001)
  await page.getByRole('button', { name: 'Arrêter le rituel' }).click()
  await expect.poll(rms).toBeLessThan(0.00001)
  await expect(page.getByRole('heading', { name: 'Ton action reste prévue' })).toBeVisible()
  expect(errors).toEqual([])
})

test('absence de voix locale : erreur explicite, puis démarrage en texte seul', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.speechSynthesis) Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [] })
  })
  await prepare(page)
  await page.getByRole('button', { name: 'Voix et musique', exact: true }).click()
  await approve(page)
  await page.getByRole('button', { name: 'Commencer mon rituel' }).click()
  await expect(page.getByRole('alert')).toContainText('voix française locale')
  await expect(page.getByRole('button', { name: 'Mettre le rituel en pause' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Texte seul', exact: true }).click()
  await page.getByRole('button', { name: 'Commencer mon rituel' }).click()
  await expect(page.getByRole('heading', { name: 'Étape 1 sur 8' })).toBeVisible()
})
