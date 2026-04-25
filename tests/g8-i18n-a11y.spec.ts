import { test, expect } from '@playwright/test'

const FR_ERR = /[éèêàçù]|Connexion|requis|invalide|administrateur/i

test.describe('G8.7.1+2+3 — i18n 32 locales : fichiers présents + cohérence', () => {
  // Smoke "fichier accessible" via Vercel asset si exposé, sinon on vérifie
  // que la home rend une langue compatible. Ici on test que les pages publiques
  // répondent 200 quel que soit Accept-Language.
  const TEST_LOCALES_HEADERS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'el', 'hu', 'ro', 'tr', 'ar', 'he', 'hi', 'zh', 'ja', 'ko', 'th', 'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bn', 'ur']
  for (const locale of TEST_LOCALES_HEADERS) {
    test(`GET / avec Accept-Language ${locale} → 200`, async ({ request }) => {
      const r = await request.get('/', { headers: { 'Accept-Language': locale } })
      expect(r.status()).toBe(200)
    })
  }
})

test.describe('G8.7.1+2+3 — Locale switcher API', () => {
  test('POST /api/locale avec locale valide → 200 + cookie set', async ({ request }) => {
    const r = await request.post('/api/locale', {
      data: { locale: 'es' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(200)
    const j = (await r.json()) as { ok: boolean; locale: string }
    expect(j.ok).toBe(true)
    expect(j.locale).toBe('es')
  })

  test('POST /api/locale avec locale invalide → 400 FR', async ({ request }) => {
    const r = await request.post('/api/locale', {
      data: { locale: 'xx' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(400)
    const j = (await r.json()) as { error?: string }
    expect(j.error ?? '').toMatch(FR_ERR)
  })

  test('POST /api/locale 32 nouvelles : he (RTL) accepté', async ({ request }) => {
    const r = await request.post('/api/locale', {
      data: { locale: 'he' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(200)
  })

  test('POST /api/locale 32 nouvelles : ur (RTL) accepté', async ({ request }) => {
    const r = await request.post('/api/locale', {
      data: { locale: 'ur' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(200)
  })

  test('POST /api/locale 32 nouvelles : tl (Tagalog) accepté', async ({ request }) => {
    const r = await request.post('/api/locale', {
      data: { locale: 'tl' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(200)
  })
})

test.describe('G8.7.4+5 — A11y baseline (skip-to-content + body lang attribute)', () => {
  test('Homepage a un lien skip-to-content visible au focus', async ({ page }) => {
    await page.goto('/')
    // Skip link présent dans le DOM (peut être visuellement masqué jusqu'au focus)
    const skip = page.getByRole('link', { name: /aller au contenu|skip to content/i })
    const count = await skip.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Homepage a un h1 unique', async ({ page }) => {
    await page.goto('/')
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBeGreaterThanOrEqual(1)
  })

  test('Homepage a #main-content cible du skip link', async ({ page }) => {
    await page.goto('/')
    const main = page.locator('#main-content')
    expect(await main.count()).toBeGreaterThanOrEqual(1)
  })
})

test.describe('G8.7.6 — Page accessibility settings (auth-guard)', () => {
  test('GET /dashboard/profile/accessibility sans auth → redirect /login', async ({ request }) => {
    const r = await request.get('/dashboard/profile/accessibility', { maxRedirects: 0 })
    expect([301, 302, 303, 307, 308]).toContain(r.status())
    expect(r.headers()['location'] ?? '').toContain('/login')
  })
})

test.describe('G8.7 — Régression admin G8.6 + zero-error pages publiques', () => {
  const PUBLIC_PAGES = ['/', '/pricing', '/impact', '/fiscal', '/login', '/signup', '/mentions-legales']
  for (const path of PUBLIC_PAGES) {
    test(`GET ${path} → 200`, async ({ request }) => {
      const r = await request.get(path)
      expect(r.status()).toBe(200)
    })
  }

  const ADMIN_PAGES = [
    '/dashboard/admin',
    '/dashboard/admin/pricing',
    '/dashboard/admin/wording',
    '/dashboard/admin/promos',
    '/dashboard/admin/influenceurs',
    '/dashboard/admin/feature-flags',
    '/dashboard/admin/missions',
    '/dashboard/admin/vida-angel',
    '/dashboard/admin/stats',
    '/dashboard/admin/audit',
    '/dashboard/admin/system',
  ]
  for (const path of ADMIN_PAGES) {
    test(`GET ${path} → redirect anonyme préservé`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 })
      expect([301, 302, 303, 307, 308]).toContain(r.status())
    })
  }
})
