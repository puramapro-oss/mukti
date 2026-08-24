import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * P6 — Tests humains simulés (SIM 11-21) bout en bout sur prod live.
 *
 * Couvre : concours→parrainage→profil→settings→notifs→langue→mobile→logout.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://auth.purama.dev'
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const APP_DOMAIN = 'mukti.purama.dev'
const COOKIE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
const COOKIE_CHUNK_SIZE = 3180

const RUN_ID = `${Date.now()}${Math.floor(Math.random() * 1e6)}`
const TEST_EMAIL = `pw-sim21-2-${RUN_ID}@test.purama.dev`
const TEST_PASSWORD = `Sim21!${RUN_ID}aBc`
const TEST_NAME = `SIM21-2 ${RUN_ID}`

const STORAGE_DIR = path.join(__dirname, '.auth')
const STORAGE_FILE = path.join(STORAGE_DIR, `sim21-2.json`)
let createdUserId: string | null = null

if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true })
if (!existsSync(STORAGE_FILE)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('node:fs').writeFileSync(STORAGE_FILE, JSON.stringify({ cookies: [], origins: [] }))
}

async function adminCreateUser(req: APIRequestContext): Promise<string> {
  const res = await req.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    data: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_NAME },
    },
  })
  if (!res.ok()) {
    throw new Error(`adminCreateUser failed ${res.status()}: ${await res.text()}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

async function adminDeleteUser(req: APIRequestContext, userId: string) {
  await req.delete(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  })
}

async function getSessionViaRest(req: APIRequestContext): Promise<Record<string, unknown>> {
  const res = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(`getSessionViaRest failed ${res.status()}: ${await res.text()}`)
  }
  return (await res.json()) as Record<string, unknown>
}

function buildAuthCookies(session: Record<string, unknown>) {
  const sessionJSON = JSON.stringify(session)
  const encoded = 'base64-' + Buffer.from(sessionJSON, 'utf-8').toString('base64url')
  const encodedURI = encodeURIComponent(encoded)
  const baseAttrs = {
    domain: APP_DOMAIN,
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax' as const,
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  }
  if (encodedURI.length <= COOKIE_CHUNK_SIZE) {
    return [{ ...baseAttrs, name: COOKIE_KEY, value: encoded }]
  }
  const chunks: { name: string; value: string }[] = []
  let remainingURI = encodedURI
  let i = 0
  while (remainingURI.length > 0) {
    let head = remainingURI.slice(0, COOKIE_CHUNK_SIZE)
    const lastEsc = head.lastIndexOf('%')
    if (lastEsc > COOKIE_CHUNK_SIZE - 3) head = head.slice(0, lastEsc)
    while (head.length > 0) {
      try {
        const decoded = decodeURIComponent(head)
        chunks.push({ name: `${COOKIE_KEY}.${i}`, value: decoded })
        i++
        remainingURI = remainingURI.slice(head.length)
        break
      } catch {
        if (head.at(-3) === '%' && head.length > 3) head = head.slice(0, head.length - 3)
        else throw new Error('cookie chunking failed')
      }
    }
  }
  return chunks.map((c) => ({ ...baseAttrs, name: c.name, value: c.value }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loginViaCookies(playwrightFx: any, browserContext: BrowserContext) {
  const req = await playwrightFx.request.newContext()
  const session = await getSessionViaRest(req)
  await req.dispose()
  const cookies = buildAuthCookies(session)
  await browserContext.addCookies(cookies)
}

test.describe.serial('P6 — SIM 11-21 (live e2e)', () => {
  test.beforeAll(async ({ playwright, browser }) => {
    test.skip(!SERVICE_ROLE, 'SUPABASE_SERVICE_ROLE_KEY missing → cannot create test user')
    test.setTimeout(120000)

    if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true })

    const req = await playwright.request.newContext()
    createdUserId = await adminCreateUser(req)
    await req.dispose()

    const ctx = await browser.newContext()
    await loginViaCookies(playwright, ctx)
    await ctx.storageState({ path: STORAGE_FILE })
    await ctx.close()
  })

  test.afterAll(async ({ playwright }) => {
    if (createdUserId && SERVICE_ROLE) {
      const req = await playwright.request.newContext()
      await adminDeleteUser(req, createdUserId)
      await req.dispose()
    }
  })

  test.use({ storageState: STORAGE_FILE })

  test('SIM 11 — Concours page leaderboard', async ({ page }) => {
    await page.goto('/dashboard/concours', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="concours-page"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 12 — Parrainage page : code visible + copy', async ({ page }) => {
    await page.goto('/dashboard/referral', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="referral-page"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="referral-copy"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 13 — Profile page rendue', async ({ page }) => {
    await page.goto('/dashboard/profile', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="profile-page"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 14 — Settings page rendue', async ({ page }) => {
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 15 — Notifications page rendue', async ({ page }) => {
    await page.goto('/dashboard/notifications', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/dashboard\/notifications/)
  })

  test('SIM 16 — POST /api/locale (en) → 200 + cookie locale', async ({ request }) => {
    const res = await request.post('/api/locale', { data: { locale: 'en' } })
    expect(res.status()).toBe(200)
    const setCookie = res.headers()['set-cookie'] || ''
    expect(setCookie.toLowerCase()).toContain('locale')
  })

  test('SIM 17 — POST /api/locale invalide → 400', async ({ request }) => {
    const res = await request.post('/api/locale', { data: { locale: 'xyz' } })
    expect(res.status()).toBe(400)
  })

  test('SIM 18 — Viewport mobile 375 → bottom tab bar visible', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: STORAGE_FILE,
      viewport: { width: 375, height: 812 },
    })
    const page = await ctx.newPage()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const tab = page.locator('[data-testid^="tab-"]').first()
    await expect(tab).toBeVisible({ timeout: 10000 })
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth, '375px viewport should not overflow').toBeLessThanOrEqual(380)
    await ctx.close()
  })

  test('SIM 19 — Dashboard auth : console 0 erreur applicative', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const real = errors.filter(
      (e) =>
        !e.includes('Failed to load resource') &&
        !e.includes('favicon') &&
        !e.includes('manifest') &&
        !e.includes('hydrat') &&
        !e.includes('Warning:') &&
        !e.includes('Supabase') &&
        !e.includes('ERR_') &&
        !e.includes('net::') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Minified React error #418') &&
        !e.includes('Minified React error #423'),
    )
    expect(real, `console errors: ${real.join(' | ')}`).toHaveLength(0)
  })

  test('SIM 20 — Sidebar : 6 liens nav principaux visibles', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="nav-accueil"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="nav-scanner"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="nav-chat"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="nav-wallet"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="nav-missions"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="nav-concours"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 21 — Sans auth → /dashboard redirige vers /login (middleware guard)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(res?.status()).toBeLessThan(400)
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/login/)
    await ctx.close()
  })
})
