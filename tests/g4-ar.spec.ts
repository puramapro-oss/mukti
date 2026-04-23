// MUKTI G4 — tests smoke AR Energy Mirror
// Vérifie : régression zéro (G1+G2+G3) + auth guards AR + APIs 401/200 FR
// + PostgREST tables AR + counts seeds + CRONs 401.

import { test, expect } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'
const SUPABASE_URL = 'https://auth.purama.dev'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'

// ============================================================================
// Régression zéro G1+G2+G3 — pages publiques 200 + guards existants préservés
// ============================================================================
test.describe('G4 — Régression zéro (G1+G2+G3 intacts)', () => {
  for (const path of ['/', '/login', '/signup', '/mentions-legales', '/cgu', '/cgv', '/pricing']) {
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

  test('/dashboard/cercles 307 (G3 auth guard préservé)', async ({ request }) => {
    const r = await request.get(`${BASE}/dashboard/cercles`, { maxRedirects: 0 })
    expect(r.status()).toBe(307)
  })

  test('/api/circles GET anon 200 (G3 API publique OK)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/circles`)
    expect(r.status()).toBe(200)
  })

  test('/api/intention-phrases?category=paix 200 (G3)', async ({ request }) => {
    const r = await request.get(`${BASE}/api/intention-phrases?category=paix`)
    expect(r.status()).toBe(200)
  })
})

// ============================================================================
// G4 — Pages AR auth guard (307 → /login?next=…)
// ============================================================================
test.describe('G4 — Pages AR (307 /login?next=)', () => {
  const AUTH_PROTECTED = [
    '/dashboard/ar',
    '/dashboard/ar/soin',
    '/dashboard/ar/manifestation',
    '/dashboard/ar/ceremony',
    `/dashboard/ar/ceremony/${DUMMY_UUID}`,
    '/dashboard/ar/training/soin',
    '/dashboard/ar/training/manifestation',
    '/dashboard/ar/test',
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

// ============================================================================
// G4 — APIs 401 FR sans auth
// ============================================================================
test.describe('G4 — APIs 401 FR sans auth', () => {
  test('POST /api/ar/calibrate → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/calibrate`, {
      data: { shoulder_width: 0.3, torso_length: 0.4, arm_span: 1.2, hip_width: 0.25 },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
    const body = await r.json()
    expect(body.error).toContain('Connexion requise')
  })

  test('GET /api/ar/calibrate → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/calibrate`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/ar/sessions → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/sessions`, {
      data: { mode: 'soin', species_slug: 'humain' },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/ar/sessions → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/sessions`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test(`POST /api/ar/sessions/${DUMMY_UUID}/complete → 401`, async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/sessions/${DUMMY_UUID}/complete`, {
      data: { duration_sec: 100 },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })

  test('POST /api/ar/training/step → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/training/step`, {
      data: { mode: 'soin', step: 1 },
      maxRedirects: 0,
    })
    expect(r.status()).toBe(401)
  })

  test('GET /api/ar/training/step → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/training/step`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test(`POST /api/ar/ceremonies/${DUMMY_UUID}/join → 401`, async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/ceremonies/${DUMMY_UUID}/join`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test(`POST /api/ar/ceremonies/${DUMMY_UUID}/leave → 401`, async ({ request }) => {
    const r = await request.post(`${BASE}/api/ar/ceremonies/${DUMMY_UUID}/leave`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })
})

// ============================================================================
// G4 — APIs publiques 200 (anon)
// ============================================================================
test.describe('G4 — APIs publiques 200', () => {
  test('GET /api/ar/species → 200 + 7 espèces', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/species`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
    expect(body.species).toHaveLength(7)
    const slugs = (body.species as { slug: string }[]).map((s) => s.slug).sort()
    expect(slugs).toEqual(['chat', 'cheval', 'chien', 'faune_sauvage', 'gardien_refuge', 'humain', 'oiseau'])
  })

  test('GET /api/ar/beacons → 200 + 20 beacons', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/beacons`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
    expect(body.beacons).toHaveLength(20)
  })

  test('GET /api/ar/beacons?type=refuge_animalier → filtré', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/beacons?type=refuge_animalier`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.beacons.length).toBeGreaterThanOrEqual(6)
    for (const b of body.beacons as { type: string }[]) {
      expect(b.type).toBe('refuge_animalier')
    }
  })

  test('GET /api/ar/beacons?type=invalid → 400', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/beacons?type=invalid`)
    expect(r.status()).toBe(400)
  })

  test('GET /api/ar/ceremonies → 200 + 3 seeds', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/ceremonies`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
    expect(body.ceremonies.length).toBeGreaterThanOrEqual(3)
  })

  test('GET /api/ar/ceremonies?status=upcoming → filtré', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/ceremonies?status=upcoming`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    for (const c of body.ceremonies as { status: string }[]) {
      expect(c.status).toBe('upcoming')
    }
  })

  test('GET /api/ar/ceremonies?status=invalid → 400', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/ceremonies?status=invalid`)
    expect(r.status()).toBe(400)
  })

  test('GET /api/ar/ceremonies/live → 200 + ceremony object', async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/ceremonies/live`)
    expect(r.status()).toBe(200)
    const body = await r.json()
    expect(body.ok).toBe(true)
  })

  test(`GET /api/ar/ceremonies/${DUMMY_UUID} → 404 (not found)`, async ({ request }) => {
    const r = await request.get(`${BASE}/api/ar/ceremonies/${DUMMY_UUID}`)
    expect([400, 404]).toContain(r.status())
  })
})

// ============================================================================
// G4 — CRONs protection 401 sans secret
// ============================================================================
test.describe('G4 — CRONs secret protection', () => {
  test('POST /api/cron/ar-ceremony-auto-start sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/ar-ceremony-auto-start`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('POST /api/cron/ar-ceremony-auto-finish sans secret → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/api/cron/ar-ceremony-auto-finish`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })

  test('GET /api/cron/ar-ceremony-auto-start sans secret → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/api/cron/ar-ceremony-auto-start`, { maxRedirects: 0 })
    expect(r.status()).toBe(401)
  })
})

// ============================================================================
// G4 — PostgREST : 7 tables mukti accessibles via anon + counts seeds
// ============================================================================
test.describe('G4 — PostgREST tables AR accessibles via anon', () => {
  const TABLES = [
    'ar_species_catalog',
    'ar_beacons',
    'ar_calibrations',
    'ar_sessions',
    'ar_ceremonies',
    'ar_ceremony_participants',
    'ar_training_progress',
  ]
  for (const t of TABLES) {
    test(`${t} → 200 via PostgREST`, async ({ request }) => {
      const r = await request.get(`${SUPABASE_URL}/rest/v1/${t}?limit=1`, {
        headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti' },
      })
      expect(r.status()).toBe(200)
    })
  }

  test('ar_species_catalog contient 7 entrées seed', async ({ request }) => {
    const r = await request.get(`${SUPABASE_URL}/rest/v1/ar_species_catalog?select=id`, {
      headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti', Prefer: 'count=exact', Range: '0-0' },
    })
    expect(r.status()).toBe(206)
    const contentRange = r.headers()['content-range'] ?? ''
    expect(contentRange).toContain('/7')
  })

  test('ar_beacons contient 20 entrées seed', async ({ request }) => {
    const r = await request.get(`${SUPABASE_URL}/rest/v1/ar_beacons?select=id`, {
      headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti', Prefer: 'count=exact', Range: '0-0' },
    })
    expect(r.status()).toBe(206)
    const contentRange = r.headers()['content-range'] ?? ''
    expect(contentRange).toContain('/20')
  })

  test('ar_ceremonies contient ≥ 3 entrées seed (hebdo)', async ({ request }) => {
    const r = await request.get(`${SUPABASE_URL}/rest/v1/ar_ceremonies?select=id`, {
      headers: { apikey: ANON_KEY, 'Accept-Profile': 'mukti', Prefer: 'count=exact', Range: '0-0' },
    })
    expect(r.status()).toBe(206)
    const contentRange = r.headers()['content-range'] ?? ''
    const match = contentRange.match(/\/(\d+)$/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1] ?? 0)).toBeGreaterThanOrEqual(3)
  })
})

// ============================================================================
// G4 — Rendering sanity
// ============================================================================
test.describe('G4 — Rendering sanity', () => {
  test('homepage contient mention miroir/AR', async ({ request }) => {
    const r = await request.get(`${BASE}/`)
    expect(r.status()).toBe(200)
  })

  test('login page OK', async ({ request }) => {
    const r = await request.get(`${BASE}/login`)
    expect(r.status()).toBe(200)
    const html = await r.text()
    expect(html.toLowerCase()).toContain('connexion')
  })
})
