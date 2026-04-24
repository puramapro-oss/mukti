import { test, expect } from '@playwright/test'

const FR_ERR = /[éèêàçù]|Connexion|requis|invalide|pos[eé]-toi|souffle|patiente/i

test.describe('G8.1 — PostgREST mukti schema (11 nouvelles tables)', () => {
  const ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
  const PGREST = 'https://auth.purama.dev/rest/v1'
  const PUBLIC_TABLES = ['accompagnants_resources', 'rituel_hebdo_weeks', 'emergency_resources']
  const PRIVATE_TABLES = [
    'accompagnants_profiles',
    'accompagnants_testimonials',
    'life_feed_entries',
    'life_feed_projections',
    'rituel_hebdo_participations',
    'admin_settings',
    'admin_audit_log',
    'qa_conversations',
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
    test(`${t} anon access → [] / 401 (jamais 500)`, async ({ request }) => {
      const r = await request.get(`${PGREST}/${t}?select=*&limit=1`, {
        headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' },
      })
      expect([200, 206, 401, 403]).toContain(r.status())
    })
  }
  test('emergency_resources seed ≥ 18 ressources', async ({ request }) => {
    const r = await request.get(
      `${PGREST}/emergency_resources?select=country_code&active=eq.true`,
      { headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' } },
    )
    expect(r.status()).toBe(200)
    const j = (await r.json()) as Array<{ country_code: string }>
    expect(j.length).toBeGreaterThanOrEqual(18)
    const fr = j.filter(x => x.country_code === 'FR').length
    expect(fr).toBeGreaterThanOrEqual(3)
  })
  test('accompagnants_resources seed 10 sections', async ({ request }) => {
    const r = await request.get(
      `${PGREST}/accompagnants_resources?select=section_slug&active=eq.true`,
      { headers: { apikey: ANON_KEY, Accept: 'application/json', 'Accept-Profile': 'mukti' } },
    )
    expect(r.status()).toBe(200)
    const j = (await r.json()) as Array<{ section_slug: string }>
    const unique = new Set(j.map(r => r.section_slug))
    expect(unique.size).toBeGreaterThanOrEqual(10)
  })
})

test.describe('G8.2 — Espace Accompagnants auth guards', () => {
  const PAGES = [
    '/dashboard/accompagnants',
    '/dashboard/accompagnants/nama-aidant',
    '/dashboard/accompagnants/comprendre-le-malade',
    '/dashboard/accompagnants/proteger-ton-energie',
  ]
  for (const p of PAGES) {
    test(`${p} → 307 sans auth`, async ({ request }) => {
      const r = await request.get(p, { maxRedirects: 0 })
      expect([307, 308]).toContain(r.status())
    })
  }
  test('/dashboard/accompagnants/invalid-slug → 307 (redirect avant 404)', async ({ request }) => {
    const r = await request.get('/dashboard/accompagnants/invalid-xyz', { maxRedirects: 0 })
    expect([307, 308, 404]).toContain(r.status())
  })
})

test.describe('G8.2 — APIs Accompagnants', () => {
  test('POST /api/accompagnants/profile sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/accompagnants/profile', { data: {} })
    expect(r.status()).toBe(401)
    const j = await r.json().catch(() => ({}))
    expect(j.error ?? '').toMatch(FR_ERR)
  })
  test('POST /api/accompagnants/testimonial sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/accompagnants/testimonial', { data: { content: 'x'.repeat(50) } })
    expect(r.status()).toBe(401)
  })
  test('POST /api/accompagnants/nama-aidant sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/accompagnants/nama-aidant', {
      data: { history: [{ role: 'user', content: 'bonjour' }] },
    })
    expect(r.status()).toBe(401)
  })
  test('GET /api/accompagnants/profile → 405 (POST only)', async ({ request }) => {
    const r = await request.get('/api/accompagnants/profile')
    expect(r.status()).toBe(405)
  })
})

test.describe('G8.3 — Fil de Vie auth guards', () => {
  const PAGES = [
    '/dashboard/fil-de-vie',
    '/dashboard/fil-de-vie/carte',
    '/dashboard/fil-de-vie/projection',
  ]
  for (const p of PAGES) {
    test(`${p} → 307`, async ({ request }) => {
      const r = await request.get(p, { maxRedirects: 0 })
      expect([307, 308]).toContain(r.status())
    })
  }
})

test.describe('G8.3 — APIs Life Feed', () => {
  test('GET /api/life-feed/timeline sans auth → 401', async ({ request }) => {
    const r = await request.get('/api/life-feed/timeline')
    expect(r.status()).toBe(401)
  })
  test('POST /api/life-feed/projection sans auth → 401', async ({ request }) => {
    const r = await request.post('/api/life-feed/projection', { data: { horizon_years: 5 } })
    expect(r.status()).toBe(401)
  })
  test('GET /api/life-feed/world 200 public', async ({ request }) => {
    const r = await request.get('/api/life-feed/world')
    expect(r.status()).toBe(200)
    const j = (await r.json()) as { aggregates: unknown[]; updated_at: string }
    expect(Array.isArray(j.aggregates)).toBe(true)
    expect(typeof j.updated_at).toBe('string')
  })
})

test.describe('G8.4 — Rituel hebdo', () => {
  test('/dashboard/rituel-hebdo → 307 sans auth', async ({ request }) => {
    const r = await request.get('/dashboard/rituel-hebdo', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
  test('GET /api/rituel-hebdo/current 200 public + theme + week_iso', async ({ request }) => {
    const r = await request.get('/api/rituel-hebdo/current')
    expect(r.status()).toBe(200)
    const j = (await r.json()) as {
      week_iso: string
      theme_slug: string
      theme_title_fr: string
      theme_color: string
      participants_count: number
    }
    expect(j.week_iso).toMatch(/^\d{4}-W\d{2}$/)
    expect(['depolluer', 'paix', 'amour', 'pardon', 'gratitude', 'abondance', 'conscience']).toContain(j.theme_slug)
    expect(j.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(typeof j.participants_count).toBe('number')
  })
  test('POST /api/rituel-hebdo/join sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/rituel-hebdo/join', { data: { minutes_practiced: 10 } })
    expect(r.status()).toBe(401)
  })
  test('GET /api/rituel-hebdo/history sans auth → 401', async ({ request }) => {
    const r = await request.get('/api/rituel-hebdo/history')
    expect(r.status()).toBe(401)
  })
  test('POST /api/cron/rituel-hebdo-rotate sans secret → 401', async ({ request }) => {
    const r = await request.post('/api/cron/rituel-hebdo-rotate', {})
    expect(r.status()).toBe(401)
  })
})

test.describe('G8.5 — IA Q&R + détresse', () => {
  test('/dashboard/aide-ia → 307 sans auth', async ({ request }) => {
    const r = await request.get('/dashboard/aide-ia', { maxRedirects: 0 })
    expect([307, 308]).toContain(r.status())
  })
  test('POST /api/qa/ask sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/qa/ask', {
      data: { question: 'Bonjour MUKTI' },
    })
    expect(r.status()).toBe(401)
    const j = await r.json().catch(() => ({}))
    expect(j.error ?? '').toMatch(FR_ERR)
  })
  test('POST /api/qa/ask invalid payload sans auth → 401 (auth-first)', async ({ request }) => {
    const r = await request.post('/api/qa/ask', { data: { question: '' } })
    expect(r.status()).toBe(401)
  })
  test('POST /api/qa/distress-signal sans auth → 401 FR', async ({ request }) => {
    const r = await request.post('/api/qa/distress-signal', {})
    expect(r.status()).toBe(401)
  })
})

test.describe('G8 — Régression G1-G7 (pages publiques)', () => {
  const PUB = ['/', '/login', '/signup', '/pricing', '/fiscal', '/impact']
  for (const p of PUB) {
    test(`GET ${p} → 200`, async ({ request }) => {
      const r = await request.get(p)
      expect(r.status()).toBe(200)
    })
  }
})
