// MUKTI G5 — tests smoke AURORA + Reprogrammation + Modes avancés (G5.1 → G5.8)
// Vérifie : régression G1-G4 intacte + auth guards G5 + APIs 401 FR bienveillantes
// + PostgREST mukti schema tables G5 + advanced modes constants.

import { test, expect } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'
const SUPABASE_URL = 'https://auth.purama.dev'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'

// ============================================================================
// Régression zéro G1+G2+G3+G4 — pages publiques 200 + guards existants préservés
// ============================================================================
test.describe('G5 — Régression zéro (G1→G4 intacts)', () => {
  for (const path of [
    '/',
    '/login',
    '/signup',
    '/mentions-legales',
    '/cgu',
    '/cgv',
    '/pricing',
    '/politique-confidentialite',
  ]) {
    test(`${path} 200`, async ({ request }) => {
      const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect(r.status(), `${path} doit rester 200`).toBe(200)
    })
  }

  test('/dashboard/liberation 307 (G2 préservé)', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/liberation`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
    expect(r.headers().location).toContain('/login?next=')
  })

  test('/dashboard/cercles 307 (G3 préservé)', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/cercles`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
  })

  test('/dashboard/ar 307 (G4 préservé)', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/ar`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
  })

  test('/api/circles GET anon 200 (G3 publique OK)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles`)
    expect(r.status()).toBe(200)
  })

  test('/api/intention-phrases?category=paix 200 (G3)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/intention-phrases?category=paix`)
    expect(r.status()).toBe(200)
  })

  test('/api/ar/species 200 (G4 publique)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/species`)
    expect(r.status()).toBe(200)
  })

  test('/api/ar/beacons 200 (G4 publique)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/beacons`)
    expect(r.status()).toBe(200)
  })
})

// ============================================================================
// G5.1 — G5.5 AURORA OMEGA + Reprogrammation (pages + APIs)
// ============================================================================
test.describe('G5.1-G5.5 — AURORA + Reprogrammation guards', () => {
  const guardedPages = [
    '/dashboard/aurora',
    '/dashboard/subconscient',
    '/dashboard/subconscient/nuit',
    '/dashboard/subconscient/journee',
    '/dashboard/subconscient/mes-affirmations',
  ]
  for (const path of guardedPages) {
    test(`${path} 307 (auth guard)`, async ({ request }) => {
      const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect(r.status()).toBe(307)
      expect(r.headers().location).toContain('/login?next=')
    })
  }

  const guardedApis401 = [
    { method: 'GET' as const, path: '/api/affirmations/custom' },
    { method: 'PATCH' as const, path: '/api/reprogramming/notifs-preferences' },
  ]
  for (const { method, path } of guardedApis401) {
    test(`${method} ${path} 401 FR bienveillant`, async ({ request }) => {
      const r = await request.fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        data: method === 'GET' ? undefined : JSON.stringify({}),
      })
      expect(r.status()).toBe(401)
      const body = await r.json()
      expect(typeof body.error).toBe('string')
      expect(body.error.length).toBeGreaterThan(5)
      // FR (pas juste "Unauthorized")
      expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
    })
  }
})

// ============================================================================
// G5.6 Rituel 7 Secondes (page + 3 APIs)
// ============================================================================
test.describe('G5.6 — Rituel 7 Secondes', () => {
  test('/dashboard/rituel-7s 307 auth guard', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/rituel-7s`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
  })

  test('POST /api/rituel-7s/start 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/rituel-7s/start`, {
      data: { trigger: 'page' },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('Connexion')
  })

  test('POST /api/rituel-7s/complete 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/rituel-7s/complete`, {
      data: { session_id: DUMMY_UUID, outcome: 'completed', duration_sec: 7 },
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/rituel-7s/streak 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/rituel-7s/streak`)
    expect(r.status()).toBe(401)
  })
})

// ============================================================================
// G5.7 Boucle Urgence + Exorcisme (3 pages + 7 APIs)
// ============================================================================
test.describe('G5.7 — Boucle Urgence + Exorcisme', () => {
  for (const path of [
    '/dashboard/boucle-urgence',
    '/dashboard/exorcisme',
    '/dashboard/exorcisme/seance',
  ]) {
    test(`${path} 307 auth guard`, async ({ request }) => {
      const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect(r.status()).toBe(307)
    })
  }

  test('POST /api/boucle-urgence/start 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/boucle-urgence/start`, {
      data: { trigger: 'page', duration_sec: 180 },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('camouflage')
  })

  test('POST /api/boucle-urgence/complete 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/boucle-urgence/complete`, {
      data: { session_id: DUMMY_UUID, outcome: 'completed', duration_sec: 180 },
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/boucle-urgence/stats 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/boucle-urgence/stats`)
    expect(r.status()).toBe(401)
  })

  test('POST /api/exorcisme/start 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/exorcisme/start`, {
      data: { possession_text: 'test déclencheur' },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('séance')
  })

  test('POST /api/exorcisme/affirmation 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/exorcisme/affirmation`, {
      data: { session_id: DUMMY_UUID, possession_text: 'test' },
    })
    expect(r.status()).toBe(401)
  })

  test('POST /api/exorcisme/complete 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/exorcisme/complete`, {
      data: { session_id: DUMMY_UUID, outcome: 'completed', duration_sec: 120 },
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/exorcisme/stats 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/exorcisme/stats`)
    expect(r.status()).toBe(401)
  })
})

// ============================================================================
// G5.8 Boîte Noire + Modes avancés (3 pages + 4 APIs)
// ============================================================================
test.describe('G5.8 — Boîte Noire + Modes avancés', () => {
  for (const path of [
    '/dashboard/boite-noire',
    `/dashboard/boite-noire/${DUMMY_UUID}`,
    '/dashboard/modes-avances',
  ]) {
    test(`${path} 307 auth guard`, async ({ request }) => {
      const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect(r.status()).toBe(307)
    })
  }

  test('POST /api/boite-noire/capture 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/boite-noire/capture`, {
      data: {
        addiction_id: DUMMY_UUID,
        what_trigger: 'test',
        intensity: 5,
      },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('Connexion')
  })

  test('GET /api/boite-noire/entries 401', async ({ request }) => {
    const r = await request.get(
      `${BASE}/api/boite-noire/entries?addiction_id=${DUMMY_UUID}`
    )
    expect(r.status()).toBe(401)
  })

  test('POST /api/boite-noire/detect 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/boite-noire/detect`, {
      data: { addiction_id: DUMMY_UUID },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('schéma')
  })

  test('POST /api/modes-avances/notify 401 FR', async ({ request }) => {
    const r = await request.post(`${BASE}/api/modes-avances/notify`, {
      data: { mode_id: 'parfum_virtuel' },
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('notifié')
  })
})

// ============================================================================
// G5 PostgREST — tables mukti schema accessibles (RLS anon refuse → 401)
// ============================================================================
test.describe('G5 — PostgREST mukti schema (RLS anon = 401)', () => {
  const g5Tables = [
    'aurora_sessions',
    'aurora_streaks',
    'reprogramming_sessions',
    'boite_noire_entries',
    'affirmation_custom',
  ]
  for (const tbl of g5Tables) {
    test(`mukti.${tbl} RLS anon denied`, async ({ request }) => {
      const r = await request.get(
        `${SUPABASE_URL}/rest/v1/${tbl}?select=*&limit=1`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Accept-Profile': 'mukti',
          },
        }
      )
      // Anon doit être refusé (RLS strict) — 401 ou vide 200 avec [] (RLS row-level)
      // On exige juste status 200/401 (pas 500) ET body non-exfiltrant
      expect([200, 401]).toContain(r.status())
      if (r.status() === 200) {
        const body = await r.json()
        expect(Array.isArray(body)).toBe(true)
        expect(body.length).toBe(0) // RLS doit masquer tout data
      }
    })
  }
})

// ============================================================================
// Régression G5.6/G5.7 APIs — validation Zod (400 bad request anon-before-auth)
// Note : 401 gagne toujours sur 400 puisque auth est checkée en premier.
// ============================================================================
test.describe('G5 — APIs validation (auth check first)', () => {
  test('POST /api/boite-noire/capture payload vide → 401 (auth first)', async ({ request }) => {
    const r = await request.post(`${BASE}/api/boite-noire/capture`, { data: {} })
    expect(r.status()).toBe(401)
  })

  test('POST /api/modes-avances/notify payload invalide → 401 (auth first)', async ({ request }) => {
    const r = await request.post(`${BASE}/api/modes-avances/notify`, {
      data: { mode_id: 'inexistant' },
    })
    expect(r.status()).toBe(401)
  })
})

// ============================================================================
// Sitemap + robots — régression SEO G1 préservée
// ============================================================================
test.describe('G5 — SEO régression', () => {
  test('/sitemap.xml 200', async ({ request }) => {
    const r = await request.get(`${BASE}/sitemap.xml`)
    expect(r.status()).toBe(200)
  })

  test('/robots.txt 200', async ({ request }) => {
    const r = await request.get(`${BASE}/robots.txt`)
    expect(r.status()).toBe(200)
  })
})
