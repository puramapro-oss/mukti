// MUKTI G3 — tests smoke Cercles d'Intention
// Vérifie : auth guards + 401 API + PostgREST exposition + CRON secret
// + régression zéro G1/G2 intacte.

import { test, expect } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'
const SUPABASE_URL = 'https://auth.purama.dev'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'

test.describe('G3 — Régression zéro (G1+G2 intacts)', () => {
  for (const path of ['/', '/login', '/signup', '/mentions-legales', '/cgu', '/cgv']) {
    test(`${path} 200`, async ({ request }) => {
      const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect(r.status(), `${path} doit rester 200`).toBe(200)
    })
  }

  test('/dashboard/liberation 307 (G2 auth guard préservé)', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/liberation`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
    expect(r.headers().location).toContain('/login?next=')
  })
})

test.describe('G3 — Pages Cercles (auth guard 307 /login?next=)', () => {
  const AUTH_PROTECTED = [
    '/dashboard/cercles',
    '/dashboard/cercles/abondance',
    '/dashboard/cercles/amour_soi',
    '/dashboard/cercles/apaisement',
    '/dashboard/cercles/liberation',
    '/dashboard/cercles/paix',
    '/dashboard/cercles/create',
    '/dashboard/cercles/forum',
    `/dashboard/cercles/room/${DUMMY_UUID}`,
    `/dashboard/cercles/post-session/${DUMMY_UUID}`,
  ]
  for (const p of AUTH_PROTECTED) {
    test(`${p} redirect 307 vers /login`, async ({ request }) => {
      const r = await request.get(`${BASE}${p}`, { maxRedirects: 0 })
      expect(r.status()).toBe(307)
      expect(r.headers().location).toContain('/login?next=')
      expect(r.headers().location).toContain(encodeURIComponent(p))
    })
  }
})

test.describe('G3 — APIs 401 FR sans auth', () => {
  test('POST /api/circles → 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles`, {
      data: { category: 'paix', title: 'test', max_participants: 2 },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('Connexion requise')
  })

  test('GET /api/circles/[id] (random uuid) → 404 FR', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles/${DUMMY_UUID}`, { maxRedirects: 0 })
    expect([400, 404]).toContain(r.status())
  })

  test('POST /api/circles/[id]/join sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/join`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/circles/[id]/leave sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/leave`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/circles/[id]/advance-rotation sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/advance-rotation`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/circles/[id]/livekit-token sans auth → 401 ou 503', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/livekit-token`, { maxRedirects: 0 })
    expect([401, 503]).toContain(r.status())
  })

  test('POST /api/circles/[id]/report sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/report`, {
      data: { reported_user_id: DUMMY_UUID, reason: 'spam' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })

  test('POST /api/circles/[id]/messages sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/${DUMMY_UUID}/messages`, {
      data: { kind: 'gratitude', content: 'test' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/circles/forum sans auth → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles/forum?category=paix`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/circles/follow sans auth → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/circles/follow`, {
      data: { followed_id: DUMMY_UUID },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })
})

test.describe('G3 — API publiques', () => {
  test('GET /api/circles (anon listing) → 200', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.circles)).toBe(true)
  })

  test('GET /api/circles?category=paix → 200 filtered', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles?category=paix`)
    expect(r.status()).toBe(200)
  })

  test('GET /api/intention-phrases?category=paix → 200 + phrases', async ({ request }) => {
    const r = await request.get(`${BASE}/api/intention-phrases?category=paix`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
    expect(body.phrases.length).toBeGreaterThanOrEqual(10)
    expect(body.phrases[0]).toHaveProperty('text_fr')
    expect(body.phrases[0]).toHaveProperty('text_en')
  })

  test('GET /api/intention-phrases sans catégorie → 400', async ({ request }) => {
    const r = await request.get(`${BASE}/api/intention-phrases`)
    expect(r.status()).toBe(400)
  })

  test('GET /api/intention-phrases?category=invalid → 400', async ({ request }) => {
    const r = await request.get(`${BASE}/api/intention-phrases?category=nope`)
    expect(r.status()).toBe(400)
  })
})

test.describe('G3 — CRON secret protection', () => {
  test('POST /api/cron/circles-auto-finish sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/circles-auto-finish`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/cron/circles-replays-purge sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/circles-replays-purge`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })
})

test.describe('G3 — PostgREST tables accessibles via anon', () => {
  const TABLES = [
    'circles',
    'circle_participants',
    'circle_rotations',
    'circle_messages',
    'circle_reports',
    'intention_phrases',
    'circle_replays',
    'circle_follows',
  ]
  for (const t of TABLES) {
    test(`${t} → 200 via PostgREST`, async ({ request }) => {
      const r = await request.get(`${SUPABASE_URL}/rest/v1/${t}?limit=1`, {
        headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti' },
      })
      expect(r.status()).toBe(200)
    })
  }

  test('intention_phrases contient 140 entrées seed', async ({ request }) => {
    const r = await request.get(`${SUPABASE_URL}/rest/v1/intention_phrases?select=id`, {
      headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti', Prefer: 'count=exact', Range: '0-0' },
    })
    expect(r.status()).toBe(206)
    const contentRange = r.headers()['content-range'] ?? ''
    expect(contentRange).toContain('/140')
  })
})

test.describe('G3 — Rendering sanity (homepage + links)', () => {
  test('homepage contient reference aux Cercles', async ({ request }) => {
    const r = await request.get(`${BASE}/`)
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html.toLowerCase()).toContain('cercle')
  })
})
