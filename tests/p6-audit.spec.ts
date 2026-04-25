import { test, expect, type Page } from '@playwright/test'

// Runs against the live prod baseURL configured in playwright.config.ts
// (https://mukti.purama.dev). Read-only smoke checks: no auth, no mutations.

function attachConsole(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

function filterBenign(errors: string[]) {
  return errors.filter(
    (e) =>
      !e.includes('Failed to load resource') &&
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('hydrat') &&
      !e.includes('Warning:') &&
      !e.includes('Supabase') &&
      !e.includes('ERR_') &&
      !e.includes('net::') &&
      !e.includes('ResizeObserver'),
  )
}

const PUBLIC_PAGES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/pricing',
  '/aide',
  '/contact',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/cookies',
]

test.describe('P6 — Public pages (200 + console 0)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors = attachConsole(page)
      const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      expect(res?.status(), `${path} status`).toBeLessThan(400)
      const real = filterBenign(errors)
      expect(real, `console errors on ${path}: ${real.join(' | ')}`).toHaveLength(0)
    })
  }
})

const DASHBOARD_PAGES = [
  '/dashboard',
  '/scanner',
  '/chat',
  '/dashboard/missions',
  '/dashboard/wallet',
  '/dashboard/concours',
  '/dashboard/referral',
  '/dashboard/profile',
  '/dashboard/settings',
  '/dashboard/notifications',
  '/dashboard/guide',
  '/dashboard/influenceur',
  '/dashboard/admin',
]

test.describe('P6 — Dashboard auth guard (redirect → /login)', () => {
  for (const path of DASHBOARD_PAGES) {
    test(`GUARD ${path} → /login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 })
      expect(page.url(), `${path} should redirect to /login`).toMatch(/\/login/)
    })
  }
})

test.describe('P6 — API routes', () => {
  test('GET /api/status → 200 + MUKTI', async ({ request }) => {
    const res = await request.get('/api/status')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.app).toBe('MUKTI')
  })

  test.skip('POST /api/scan unauth → 401 (legacy vida-aide, route absente MUKTI)', async ({ request }) => {
    const res = await request.post('/api/scan', {
      data: { situation: { age: 30 } },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/chat unauth → 401', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: 'hello' }] },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/wallet/withdraw unauth → 401', async ({ request }) => {
    const res = await request.post('/api/wallet/withdraw', {
      data: { amount_cents: 500, iban: 'FR7612345678901234567890123' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/missions/complete unauth → 401', async ({ request }) => {
    const res = await request.post('/api/missions/complete', {
      data: { mission_id: 'x' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/profile/update unauth → 401', async ({ request }) => {
    const res = await request.post('/api/profile/update', {
      data: { situation: {} },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/stripe/checkout unauth → 401', async ({ request }) => {
    const res = await request.post('/api/stripe/checkout', {
      data: { plan: 'monthly' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /sitemap.xml → 200 + xml', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    expect((await res.text()).trim().startsWith('<?xml')).toBe(true)
  })

  test('GET /robots.txt → 200', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
  })

  test('GET /manifest.json → 200 + MUKTI', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('MUKTI')
    expect(json.short_name).toBe('Aide')
  })
})

test.describe('P6 — Forms', () => {
  test('Login — testIDs visible + typeable', async ({ page }) => {
    await page.goto('/login')
    const email = page.locator('[data-testid="email-input"]')
    const pass = page.locator('[data-testid="password-input"]')
    await expect(email).toBeVisible()
    await expect(pass).toBeVisible()
    await email.fill('test@test.com')
    await pass.fill('test1234')
    await expect(email).toHaveValue('test@test.com')
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="google-login"]')).toBeVisible()
  })

  test('Signup — all fields present', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('[data-testid="name-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="cgu-checkbox"]')).toBeVisible()
    await expect(page.locator('[data-testid="signup-button"]')).toBeVisible()
  })

  test('Forgot password — form present', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.locator('[data-testid="forgot-email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="forgot-submit"]')).toBeVisible()
  })
})

test.describe('P6 — Landing content', () => {
  test('Landing — MUKTI branding + SASU PURAMA dans footer (art. 293 sur /mentions-legales)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toContainText('MUKTI')
    const footer = page.locator('footer')
    await expect(footer).toContainText('SASU')
    await expect(footer).toContainText('PURAMA')
    // L'article 293B est mentionné sur /mentions-legales (pas le footer)
    await page.goto('/mentions-legales')
    await expect(page.locator('body')).toContainText('293')
  })

  test('Landing — signup CTA exists', async ({ page }) => {
    await page.goto('/')
    const cta = page.locator('a[href="/signup"]').first()
    await expect(cta).toBeVisible()
  })

  test('Landing — mukti domain only (no vida-assoc leakage)', async ({ page }) => {
    await page.goto('/')
    const body = await page.content()
    expect(body.toLowerCase()).not.toContain('vida-assoc')
    expect(body).not.toContain('PURAMA Association')
  })

  test('Pricing — Premium plan visible', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('body')).toContainText(/Premium|Gratuit|Free/i)
    await expect(page.locator('body')).toContainText(/9[,.]99|83[,.]90/)
  })
})

test.describe('P6 — Aide & Contact', () => {
  test('Aide — search input + categories + FAQ rows + chat toggle', async ({ page }) => {
    await page.goto('/aide')
    await expect(page.locator('[data-testid="aide-search-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="aide-cat-all"]')).toBeVisible()
    await expect(page.locator('[data-testid="aide-cat-scanner"]')).toBeVisible()
    await expect(page.locator('[data-testid="aide-cat-wallet"]')).toBeVisible()
    // At least 3 FAQ rows visible by default
    const rows = page.locator('[data-testid="aide-faq-list"] [data-testid^="aide-faq-"]')
    expect(await rows.count()).toBeGreaterThanOrEqual(3)
    await expect(page.locator('[data-testid="aide-chat-toggle"]')).toBeVisible()
  })

  test('Aide — search filters FAQ list', async ({ page }) => {
    await page.goto('/aide')
    await page.locator('[data-testid="aide-search-input"]').fill('wallet')
    // After filtering, at least one row should mention wallet
    await expect(page.locator('body')).toContainText(/wallet/i)
  })

  test('Aide — FAQ row expands on click', async ({ page }) => {
    await page.goto('/aide')
    const firstRow = page.locator('[data-testid="aide-faq-list"] [data-testid^="aide-faq-"]').first()
    await firstRow.click()
    await expect(firstRow).toHaveAttribute('aria-expanded', 'true')
  })

  test('Aide — chat panel opens', async ({ page }) => {
    await page.goto('/aide')
    await page.locator('[data-testid="aide-chat-toggle"]').click()
    await expect(page.locator('[data-testid="aide-chat-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="aide-chat-input"]')).toBeVisible()
  })

  test('Contact — form fields all present', async ({ page }) => {
    await page.goto('/contact')
    await expect(page.locator('[data-testid="contact-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="contact-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="contact-subject"]')).toBeVisible()
    await expect(page.locator('[data-testid="contact-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="contact-submit"]')).toBeVisible()
    await expect(page.locator('[data-testid="contact-email-direct"]')).toContainText('contact@purama.dev')
  })

  test('POST /api/contact validation — empty body → 400', async ({ request }) => {
    const res = await request.post('/api/contact', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('POST /api/contact validation — invalid email → 400', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: { name: 'Bot', email: 'not-an-email', subject: 'test', message: 'hello world test' },
    })
    expect(res.status()).toBe(400)
  })

  test.skip('POST /api/aide/chat validation — empty messages → 400 (legacy vida-aide, route absente MUKTI — utiliser /api/qa/ask G8.5)', async ({ request }) => {
    const res = await request.post('/api/aide/chat', { data: { messages: [] } })
    expect(res.status()).toBe(400)
  })
})
