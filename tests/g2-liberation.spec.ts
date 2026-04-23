// MUKTI G2 — tests smoke Libération Addictions
// Vérifie : auth guards, 401 API sans session, 404 invalid modeId/addictionId,
// régression zéro (homepage + login + signup toujours 200).

import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'

test.describe('G2 — Régression zéro', () => {
  test('homepage 200', async ({ request }) => {
    const r = await request.get(`${BASE}/`, { maxRedirects: 0 })
    expect(r.status(), 'homepage doit rester 200').toBe(200)
  })

  test('/login 200', async ({ request }) => {
    const r = await request.get(`${BASE}/login`, { maxRedirects: 0 })
    expect(r.status()).toBe(200)
  })

  test('/signup 200', async ({ request }) => {
    const r = await request.get(`${BASE}/signup`, { maxRedirects: 0 })
    expect(r.status()).toBe(200)
  })

  test('/mentions-legales 200', async ({ request }) => {
    const r = await request.get(`${BASE}/mentions-legales`, { maxRedirects: 0 })
    expect(r.status()).toBe(200)
  })
})

test.describe('G2 — Pages Libération (auth guard)', () => {
  const AUTH_PROTECTED = [
    '/dashboard/liberation',
    '/dashboard/liberation/declare',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000/mode/coupure_40s',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000/mode/multisensoriel',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000/mode/micro_meditation',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000/mode/avatar',
    '/dashboard/liberation/00000000-0000-0000-0000-000000000000/mode/compteur',
  ] as const

  for (const route of AUTH_PROTECTED) {
    test(`auth guard 307 → /login?next= ${route}`, async ({ request }) => {
      const r = await request.get(`${BASE}${route}`, { maxRedirects: 0 })
      expect(r.status(), `${route} doit rediriger vers login`).toBe(307)
      const location = r.headers()['location'] ?? ''
      expect(location).toContain('/login')
      expect(location).toContain(encodeURIComponent(route))
    })
  }
})

test.describe('G2 — API routes (auth required)', () => {
  async function post(req: APIRequestContext, path: string, body: unknown) {
    return req.post(`${BASE}${path}`, {
      data: body,
      headers: { 'Content-Type': 'application/json' },
      maxRedirects: 0,
    })
  }

  test('POST /api/addictions/declare sans auth → 401', async ({ request }) => {
    const r = await post(request, '/api/addictions/declare', { type: 'tabac', severity: 3 })
    expect(r.status()).toBe(401)
    const json = (await r.json()) as { error?: string }
    expect(json.error).toBeTruthy()
    expect(json.error).toContain('Connexion requise')
  })

  test('POST /api/streak/checkin sans auth → 401', async ({ request }) => {
    const r = await post(request, '/api/streak/checkin', {})
    expect(r.status()).toBe(401)
  })

  test('POST /api/streak/relapse sans auth → 401', async ({ request }) => {
    const r = await post(request, '/api/streak/relapse', {})
    expect(r.status()).toBe(401)
  })

  test('POST /api/mode-sessions/log sans auth → 401', async ({ request }) => {
    const r = await post(request, '/api/mode-sessions/log', {})
    expect(r.status()).toBe(401)
  })

  test('POST /api/program/generate sans auth → 401', async ({ request }) => {
    const r = await post(request, '/api/program/generate', {
      addiction_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(r.status()).toBe(401)
    const json = (await r.json()) as { error?: string }
    expect(json.error).toContain('Connexion requise')
  })
})

test.describe('G2 — CRON routes (secret required)', () => {
  test('/api/cron/milestones-unlock sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/milestones-unlock`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('/api/cron/trust-recompute sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/trust-recompute`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })
})

test.describe('G2 — PostgREST schéma mukti', () => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  test.skip(!anonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY requis')

  const G2_TABLES = [
    'addictions',
    'programs',
    'streaks',
    'relapses',
    'mode_sessions',
    'payment_milestones',
    'trust_scores',
    'trust_fingerprints',
  ]

  for (const table of G2_TABLES) {
    test(`table mukti.${table} exposée PostgREST`, async ({ request }) => {
      const r = await request.get(`https://auth.purama.dev/rest/v1/${table}?limit=1`, {
        headers: {
          'Accept-Profile': 'mukti',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      })
      expect(r.status(), `${table} doit être accessible via PostgREST`).toBe(200)
    })
  }
})
