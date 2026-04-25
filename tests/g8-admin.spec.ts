import { test, expect } from '@playwright/test'

const FR_ERR = /[éèêàçù]|Connexion|requis|invalide|administrateur|Acc[eè]s/i

const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
const PGREST = 'https://auth.purama.dev/rest/v1'

test.describe('G8.6 — PostgREST mukti.missions table (créée par migration 0011)', () => {
  test('missions: public select active=true', async ({ request }) => {
    const r = await request.get(`${PGREST}/missions?select=id,slug,active&active=eq.true&limit=20`, {
      headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
    })
    expect([200, 206]).toContain(r.status())
    const rows = (await r.json()) as Array<{ slug: string; active: boolean }>
    // Seeds : 6 missions actives par défaut depuis migration 0011
    expect(rows.length).toBeGreaterThanOrEqual(6)
    const slugs = new Set(rows.map((m) => m.slug))
    expect(slugs.has('first_signup')).toBe(true)
    expect(slugs.has('weekly_ritual')).toBe(true)
  })
})

test.describe('G8.6 — Hub admin et 10 sous-pages : auth guard SSR (302 ou 307 vers /dashboard ou /login)', () => {
  const ADMIN_PATHS = [
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
  for (const path of ADMIN_PATHS) {
    test(`${path} → redirect (jamais 200 anonyme)`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 })
      expect([301, 302, 303, 307, 308]).toContain(r.status())
      const loc = r.headers()['location'] ?? ''
      // Soit /login (pas auth), soit /dashboard (auth mais pas super_admin)
      expect(loc.includes('/login') || loc.includes('/dashboard')).toBe(true)
    })
  }
})

test.describe('G8.6 — APIs admin : 403 sans auth super_admin (FR error)', () => {
  const ADMIN_GET = [
    '/api/admin/settings',
    '/api/admin/settings/feature_flags',
    '/api/admin/audit',
    '/api/admin/stats-live',
    '/api/admin/promos',
    '/api/admin/missions',
    '/api/admin/influenceurs/commissions',
    '/api/admin/feature-flags',
  ]
  for (const path of ADMIN_GET) {
    test(`GET ${path} → 403 message FR`, async ({ request }) => {
      const r = await request.get(path)
      expect(r.status()).toBe(403)
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      expect(j.error ?? '').toMatch(FR_ERR)
    })
  }

  test('GET /api/admin/promos/<uuid> → 403', async ({ request }) => {
    const r = await request.get('/api/admin/promos/00000000-0000-0000-0000-000000000000')
    expect(r.status()).toBe(403)
  })

  test('GET /api/admin/missions/<uuid> → 403', async ({ request }) => {
    const r = await request.get('/api/admin/missions/00000000-0000-0000-0000-000000000000')
    expect(r.status()).toBe(403)
  })

  test('PUT /api/admin/settings/feature_flags sans auth → 403', async ({ request }) => {
    const r = await request.put('/api/admin/settings/feature_flags', {
      data: { value: {} },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })

  test('POST /api/admin/promos sans auth → 403', async ({ request }) => {
    const r = await request.post('/api/admin/promos', {
      data: { code: 'TEST', label: 'Test', discount_type: 'percent', discount_value: 10, duration: 'once' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })

  test('POST /api/admin/missions sans auth → 403', async ({ request }) => {
    const r = await request.post('/api/admin/missions', {
      data: { slug: 'test_x', title_fr: 'Test', title_en: 'Test', type: 'action' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })

  test('PUT /api/admin/feature-flags/ar_mirror sans auth → 403', async ({ request }) => {
    const r = await request.put('/api/admin/feature-flags/ar_mirror', {
      data: { value: false },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })

  test('PUT /api/admin/influenceurs/commissions/<uuid> sans auth → 403', async ({ request }) => {
    const r = await request.put('/api/admin/influenceurs/commissions/00000000-0000-0000-0000-000000000000', {
      data: { status: 'paid' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })

  test('DELETE /api/admin/promos/<uuid> sans auth → 403', async ({ request }) => {
    const r = await request.delete('/api/admin/promos/00000000-0000-0000-0000-000000000000')
    expect(r.status()).toBe(403)
  })

  test('DELETE /api/admin/missions/<uuid> sans auth → 403', async ({ request }) => {
    const r = await request.delete('/api/admin/missions/00000000-0000-0000-0000-000000000000')
    expect(r.status()).toBe(403)
  })
})

test.describe('G8.6 — Validation params (sans auth, regression-safe)', () => {
  test('GET /api/admin/settings/INVALID_KEY (sans auth) → 403 d\'abord (auth-first), pas 400', async ({ request }) => {
    // Le guard auth passe AVANT la validation de la key → 403 attendu
    const r = await request.get('/api/admin/settings/INVALID_KEY_XYZ')
    expect(r.status()).toBe(403)
  })

  test('PUT /api/admin/feature-flags/UPPER (sans auth) → 403', async ({ request }) => {
    const r = await request.put('/api/admin/feature-flags/UPPER_INVALID', {
      data: { value: true },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(403)
  })
})

test.describe('G8.6 — Régression zéro G7/G8 session 1', () => {
  test('GET / → 200', async ({ request }) => {
    const r = await request.get('/')
    expect(r.status()).toBe(200)
  })
  test('GET /pricing → 200', async ({ request }) => {
    const r = await request.get('/pricing')
    expect(r.status()).toBe(200)
  })
  test('GET /impact → 200', async ({ request }) => {
    const r = await request.get('/impact')
    expect(r.status()).toBe(200)
  })
  test('GET /fiscal → 200', async ({ request }) => {
    const r = await request.get('/fiscal')
    expect(r.status()).toBe(200)
  })
  test('GET /dashboard/aide-ia → redirect /login (G8.5 préservé)', async ({ request }) => {
    const r = await request.get('/dashboard/aide-ia', { maxRedirects: 0 })
    expect([301, 302, 303, 307]).toContain(r.status())
    expect(r.headers()['location'] ?? '').toContain('/login')
  })
  test('POST /api/qa/ask sans auth → 401 FR (G8.5)', async ({ request }) => {
    const r = await request.post('/api/qa/ask', {
      data: { question: 'test ?' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(r.status()).toBe(401)
  })
})
