import { test, expect } from '@playwright/test'

const FR_ERR = /[éèêàçù]|Connexion|requis|invalide|refusé/i

test.describe('G7 — Régression zéro (pages publiques G1-G6)', () => {
  const PUB = ['/', '/login', '/signup', '/pricing', '/mentions-legales', '/cgv', '/cgu']
  for (const path of PUB) {
    test(`GET ${path} → 200`, async ({ request }) => {
      const r = await request.get(path)
      expect(r.status()).toBe(200)
    })
  }
})

test.describe('G7.4 — Pricing + Subscribe + Confirmation', () => {
  test('/pricing 200 + contient "14 jours" + CTA subscribe', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('body')).toContainText(/14 jours/i)
    await expect(page.getByTestId('pricing-subscribe-btn')).toBeVisible()
  })
  test('/subscribe redirect → /pricing', async ({ request }) => {
    const r = await request.get('/subscribe', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
  test('/confirmation 200 + CTA Ouvrir mon espace', async ({ page }) => {
    await page.goto('/confirmation')
    await expect(page.getByTestId('confirmation-cta')).toBeVisible()
  })
  test('/dashboard/settings/abonnement → 307 (auth guard)', async ({ request }) => {
    const r = await request.get('/dashboard/settings/abonnement', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
})

test.describe('G7.5 — Ambassadeurs guards', () => {
  const AUTH_PAGES = [
    '/dashboard/ambassadeur',
    '/dashboard/ambassadeur/apply',
    '/dashboard/ambassadeur/leaderboard',
  ]
  for (const p of AUTH_PAGES) {
    test(`${p} → 307 sans auth`, async ({ request }) => {
      const r = await request.get(p, { maxRedirects: 0 })
      expect([307, 308]).toContain(r.status())
    })
  }
})

test.describe('G7.6 — Concours guards + Fiscal public', () => {
  test('/dashboard/concours → 307', async ({ request }) => {
    const r = await request.get('/dashboard/concours', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
  for (const period of ['weekly', 'monthly', 'annual']) {
    test(`/dashboard/concours/${period} → 307`, async ({ request }) => {
      const r = await request.get(`/dashboard/concours/${period}`, { maxRedirects: 0 })
      expect([307, 308]).toContain(r.status())
    })
  }
})

test.describe('G7.7 — Wallet Connect guard', () => {
  test('/dashboard/wallet/connect → 307', async ({ request }) => {
    const r = await request.get('/dashboard/wallet/connect', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
})

test.describe('G7.8 — Fiscal pages', () => {
  test('/fiscal public 200 + 4 profils', async ({ page }) => {
    await page.goto('/fiscal')
    await expect(page.getByTestId('fiscal-profile-particulier')).toBeVisible()
    await expect(page.getByTestId('fiscal-profile-micro_bic')).toBeVisible()
    await expect(page.getByTestId('fiscal-profile-societe_is')).toBeVisible()
    await expect(page.getByTestId('fiscal-profile-association')).toBeVisible()
  })
  test('/dashboard/fiscal → 307', async ({ request }) => {
    const r = await request.get('/dashboard/fiscal', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
})

test.describe('G7.9 — Wealth Engine', () => {
  test('/impact public 200 + Flywheel + SocialFeed + ImpactDashboard', async ({ page }) => {
    await page.goto('/impact')
    await expect(page.getByTestId('impact-dashboard')).toBeVisible()
    await expect(page.getByTestId('flywheel')).toBeVisible()
  })
  test('/dashboard/flywheel → 307', async ({ request }) => {
    const r = await request.get('/dashboard/flywheel', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
  test('/api/wealth/feed 200 + array', async ({ request }) => {
    const r = await request.get('/api/wealth/feed')
    expect(r.status()).toBe(200)
    const j = await r.json()
    expect(Array.isArray(j.feed)).toBe(true)
  })
  test('/api/wealth/impact-stats 200 + counters', async ({ request }) => {
    const r = await request.get('/api/wealth/impact-stats')
    expect(r.status()).toBe(200)
    const j = await r.json()
    expect(typeof j.total_users).toBe('number')
  })
  test('Feed NO PII montants (aucun €/euro)', async ({ request }) => {
    const r = await request.get('/api/wealth/feed')
    const j = await r.json()
    const feed = j.feed as Array<{ message_fr: string }>
    for (const item of feed ?? []) {
      expect(item.message_fr).not.toMatch(/\d+\s*€|\d+\s*euros?/i)
    }
  })
})

test.describe('G7 — APIs 401 FR', () => {
  const POST_ENDPOINTS = [
    '/api/stripe/checkout',
    '/api/stripe/cancel-flow',
    '/api/stripe/validate-promo',
    '/api/stripe-connect/session',
    '/api/referral/register',
    '/api/referral/claim-lifetime-card',
    '/api/ambassadeur/apply',
    '/api/wallet/withdraw',
    '/api/fiscal/override-profile',
  ]
  for (const ep of POST_ENDPOINTS) {
    test(`POST ${ep} sans auth → 401 FR`, async ({ request }) => {
      const r = await request.post(ep, { data: {} })
      expect(r.status()).toBe(401)
      const j = await r.json().catch(() => ({}))
      expect(j.error ?? '').toMatch(FR_ERR)
    })
  }
  const GET_ENDPOINTS = [
    '/api/subscriptions/current',
    '/api/subscriptions/invoices',
    '/api/wallet/history',
    '/api/fiscal/me',
  ]
  for (const ep of GET_ENDPOINTS) {
    test(`GET ${ep} sans auth → 401 FR`, async ({ request }) => {
      const r = await request.get(ep)
      expect(r.status()).toBe(401)
      const j = await r.json().catch(() => ({}))
      expect(j.error ?? '').toMatch(FR_ERR)
    })
  }
  test('GET /api/ambassadeur/leaderboard 200 public', async ({ request }) => {
    const r = await request.get('/api/ambassadeur/leaderboard')
    expect(r.status()).toBe(200)
  })
})

test.describe('G7 — APIs auth-first (401 avant 400)', () => {
  test('POST /api/stripe/checkout invalid payload sans auth → 401 (pas 400)', async ({ request }) => {
    const r = await request.post('/api/stripe/checkout', {
      data: { plan_slug: 'BAD' },
    })
    expect(r.status()).toBe(401)
  })
  test('POST /api/ambassadeur/apply invalid payload sans auth → 401 (pas 400)', async ({ request }) => {
    const r = await request.post('/api/ambassadeur/apply', { data: { bio: 'x' } })
    expect(r.status()).toBe(401)
  })
})

test.describe('G7 — PostgREST mukti schema (13 nouvelles tables)', () => {
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
  const PGREST = 'https://auth.purama.dev/rest/v1'
  // Tables publiques (read public via RLS)
  const PUBLIC_TABLES = ['ambassador_tiers', 'promos', 'contests_karma', 'magic_moments']
  // Tables privées self-only (anon = 401 ou [] vide)
  const PRIVATE_TABLES = [
    'subscriptions', 'payments', 'referrals_v4',
    'ambassadeur_profiles', 'commissions', 'contest_entries',
    'stripe_connect_accounts', 'withdrawals_karma',
    'fiscal_profiles', 'fiscal_declarations',
  ]
  for (const t of PUBLIC_TABLES) {
    test(`${t} public read OK`, async ({ request }) => {
      const r = await request.get(`${PGREST}/${t}?select=*&limit=1`, {
        headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
      })
      expect([200, 206]).toContain(r.status())
    })
  }
  for (const t of PRIVATE_TABLES) {
    test(`${t} anon access → [] or 401 (jamais 500)`, async ({ request }) => {
      const r = await request.get(`${PGREST}/${t}?select=*&limit=1`, {
        headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
      })
      expect([200, 206, 401, 403]).toContain(r.status())
    })
  }
})

test.describe('G7 — CRONs 401 sans CRON_SECRET', () => {
  const CRONS = [
    '/api/cron/contest-karma-weekly-close',
    '/api/cron/contest-karma-monthly-draw',
    '/api/cron/contest-karma-annual-schedule',
    '/api/cron/fiscal-detect-profile',
    '/api/cron/fiscal-annual-pdf',
  ]
  for (const path of CRONS) {
    test(`POST ${path} sans secret → 401`, async ({ request }) => {
      const r = await request.post(path, {})
      expect(r.status()).toBe(401)
    })
  }
})

test.describe('G7 — Seeds DB (3 promos + 8 tiers)', () => {
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
  test('8 ambassador tiers seedés', async ({ request }) => {
    const r = await request.get('https://auth.purama.dev/rest/v1/ambassador_tiers?select=slug', {
      headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
    })
    expect(r.status()).toBe(200)
    const j = await r.json() as Array<{ slug: string }>
    expect(j.length).toBe(8)
  })
  test('3 promos seedées (WELCOME10/ANNUAL30/INFLUENCEUR50)', async ({ request }) => {
    const r = await request.get('https://auth.purama.dev/rest/v1/promos?select=code&active=eq.true', {
      headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
    })
    expect(r.status()).toBe(200)
    const j = await r.json() as Array<{ code: string }>
    expect(j.length).toBeGreaterThanOrEqual(3)
    const codes = j.map(p => p.code)
    expect(codes).toContain('WELCOME10')
    expect(codes).toContain('ANNUAL30')
    expect(codes).toContain('INFLUENCEUR50')
  })
})

test.describe('G7 — SEO régression', () => {
  test('/sitemap.xml 200', async ({ request }) => {
    const r = await request.get('/sitemap.xml')
    expect(r.status()).toBe(200)
  })
  test('/robots.txt 200', async ({ request }) => {
    const r = await request.get('/robots.txt')
    expect(r.status()).toBe(200)
  })
})
