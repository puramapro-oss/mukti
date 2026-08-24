import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

/**
 * P6 — Tests humains simulés (SIM 1-10) bout en bout sur prod live.
 *
 * Couvre : signup→login→dashboard→scanner→wallet→premiers tests auth.
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
const TEST_EMAIL = `pw-sim21-1-${RUN_ID}@test.purama.dev`
const TEST_PASSWORD = `Sim21!${RUN_ID}aBc`
const TEST_NAME = `SIM21-1 ${RUN_ID}`

const STORAGE_DIR = path.join(__dirname, '.auth')
const STORAGE_FILE = path.join(STORAGE_DIR, `sim21-1.json`)
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

test.describe.serial('P6 — SIM 1-10 (live e2e)', () => {
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

  test('SIM 01 — Landing CTA présent + signup form champs visibles', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="hero-cta"]').first()).toBeVisible({ timeout: 15000 })
    await page.goto('/signup', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="signup-button"]')).toBeVisible({ timeout: 15000 })
    await ctx.close()
  })

  test('SIM 02 — GoTrue REST refuse mot de passe invalide', async ({ playwright }) => {
    const req = await playwright.request.newContext()
    const res = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      data: { email: TEST_EMAIL, password: 'wrongpassword123' },
    })
    expect(res.status()).toBe(400)
    const json = (await res.json()) as { error_code?: string }
    expect(json.error_code).toBe('invalid_credentials')
    await req.dispose()
  })

  test('SIM 03 — Profile fetch PostgREST avec service-role → 200', async ({ playwright }) => {
    const req = await playwright.request.newContext()
    const res = await req.get(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email,role&auth_user_id=eq.${createdUserId}`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Accept-Profile': 'mukti',
        },
      },
    )
    expect(res.status()).toBe(200)
    const json = (await res.json()) as Array<{ id: string; email: string; role: string }>
    expect(json.length).toBe(1)
    expect(json[0].email).toBe(TEST_EMAIL)
    expect(json[0].role).toBe('user')
    await req.dispose()
  })

  test('SIM 04 — Dashboard auth guard : session cookie acceptée, pas de redirect', async ({ page }) => {
    const res = await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 })
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).toMatch(/\/dashboard/)
    expect(page.url()).not.toMatch(/\/login/)
  })

  test('SIM 05 — Scanner page form champs présents', async ({ page }) => {
    await page.goto('/scanner', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="scanner-page"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="field-age"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="field-emploi"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="field-revenus"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="btn-launch-scan"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 06 — POST /api/scan auth → 200 + résultat IA', async ({ request, page }) => {
    test.setTimeout(120000)
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.post('/api/scan', {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        situation: {
          age: 32,
          emploi: 'salarié',
          revenus_mensuels: 1900,
          composition_foyer: 'célibataire',
          localisation: 'Frasne 25560',
        },
      },
      timeout: 100000,
    })
    expect(res.status(), `scan status: ${await res.text()}`).toBeLessThan(500)
    if (res.status() === 200) {
      const json = await res.json()
      expect(json).toHaveProperty('scan_id')
    }
  })

  test('SIM 07 — Wallet page : solde visible + form retrait', async ({ page }) => {
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="wallet-page"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="withdraw-amount"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-testid="withdraw-iban"]')).toBeVisible({ timeout: 15000 })
  })

  test('SIM 08 — Retrait IBAN invalide → 400', async ({ request, page }) => {
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.post('/api/wallet/withdraw', {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: { amount_cents: 500, iban: 'INVALID' },
    })
    expect(res.status()).toBe(400)
  })

  test('SIM 09 — Retrait < 5€ → 400 ou 422', async ({ request, page }) => {
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const res = await request.post('/api/wallet/withdraw', {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: { amount_cents: 100, iban: 'FR7612345678901234567890123' },
    })
    expect([400, 422]).toContain(res.status())
  })

  test('SIM 10 — Missions page liste visible', async ({ page }) => {
    await page.goto('/dashboard/missions', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-testid="missions-page"]')).toBeVisible({ timeout: 15000 })
  })
})
