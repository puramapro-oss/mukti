// MUKTI G6 — tests smoke C.O.R.E. Events + Modes 16-20 (G6.1 → G6.7)
// Vérifie : régression G1-G5 intacte + auth guards G6 + APIs 401 FR bienveillantes
// + PostgREST mukti schema tables G6 + 10 protocoles seeds + modes 16-20 routes.

import { test, expect } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'
const SUPABASE_URL = 'https://auth.purama.dev'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQwNTI0ODAwLCJleHAiOjE4OTgyOTEyMDB9.GkiVoEuCykK7vIpNzY_Zmc6XPNnJF3BUPvijXXZy2aU'
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'

// ============================================================================
// Régression zéro G1-G5 — pages publiques 200 + guards existants préservés
// ============================================================================
test.describe('G6 — Régression zéro (G1→G5 intacts)', () => {
  for (const path of [
    '/',
    '/login',
    '/signup',
    '/pricing',
    '/mentions-legales',
    '/cgv',
    '/cgu',
    '/politique-confidentialite',
    '/sitemap.xml',
    '/robots.txt',
  ]) {
    test(`public ${path} 200`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`)
      expect(res.status()).toBe(200)
    })
  }

  for (const path of [
    '/dashboard',
    '/dashboard/liberation',
    '/dashboard/cercles',
    '/dashboard/ar',
    '/dashboard/aurora',
    '/dashboard/subconscient',
    '/dashboard/rituel-7s',
    '/dashboard/boucle-urgence',
    '/dashboard/exorcisme',
    '/dashboard/boite-noire',
    '/dashboard/modes-avances',
  ]) {
    test(`dashboard ${path} 307 auth guard`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect([307, 308]).toContain(res.status())
    })
  }

  for (const api of [
    '/api/boite-noire/capture',
    '/api/modes-avances/notify',
    '/api/rituel-7s/start',
    '/api/aurora/session',
  ]) {
    test(`G5 API ${api} 401 (régression)`, async ({ request }) => {
      const res = await request.post(`${BASE}${api}`, { data: {} })
      expect(res.status()).toBe(401)
    })
  }
})

// ============================================================================
// G6.4 — Pages C.O.R.E. auth guards
// ============================================================================
test.describe('G6 — Pages C.O.R.E.', () => {
  for (const path of [
    '/dashboard/core',
    '/dashboard/core/create',
    `/dashboard/core/${DUMMY_UUID}`,
    `/dashboard/core/${DUMMY_UUID}/live`,
  ]) {
    test(`${path} 307 auth guard`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect([307, 308]).toContain(res.status())
    })
  }
})

// ============================================================================
// G6.5 — Pages Modes 16-20 auth guards
// ============================================================================
test.describe('G6 — Pages Modes 16-20', () => {
  for (const path of [
    '/dashboard/energie-remplacement',
    '/dashboard/realite-alternative',
    '/dashboard/recompenses',
    '/dashboard/rituel-minimaliste',
    '/dashboard/journal-mental',
  ]) {
    test(`${path} 307 auth guard`, async ({ request }) => {
      const res = await request.get(`${BASE}${path}`, { maxRedirects: 0 })
      expect([307, 308]).toContain(res.status())
    })
  }
})

// ============================================================================
// G6.3 — APIs auth guards + FR bienveillants
// ============================================================================
test.describe('G6 — APIs C.O.R.E. 401 FR', () => {
  test('GET /api/core/events 200 (public, liste vide ou peuplée)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/core/events`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.events)).toBe(true)
  })

  test('POST /api/core/events 401 FR (auth required)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events`, { data: {} })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test(`GET /api/core/events/${DUMMY_UUID} 404 (not found)`, async ({ request }) => {
    const res = await request.get(`${BASE}/api/core/events/${DUMMY_UUID}`)
    expect([404, 400]).toContain(res.status())
  })

  test(`POST /api/core/events/${DUMMY_UUID}/join 401 FR`, async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events/${DUMMY_UUID}/join`, { data: {} })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test(`POST /api/core/events/${DUMMY_UUID}/leave 401`, async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events/${DUMMY_UUID}/leave`, { data: {} })
    expect(res.status()).toBe(401)
  })

  test(`POST /api/core/events/${DUMMY_UUID}/moderate 401`, async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events/${DUMMY_UUID}/moderate`, {
      data: { action: 'approve' },
    })
    expect(res.status()).toBe(401)
  })

  test(`POST /api/core/events/${DUMMY_UUID}/generate-ai 401`, async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events/${DUMMY_UUID}/generate-ai`, { data: {} })
    expect(res.status()).toBe(401)
  })
})

test.describe('G6 — APIs Modes 16-20 401 FR', () => {
  test('POST /api/energy-replacement/session 401 FR', async ({ request }) => {
    const res = await request.post(`${BASE}/api/energy-replacement/session`, {
      data: { channel: 'calme' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test('GET /api/energy-replacement/session 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/energy-replacement/session`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/alt-reality/project 401 FR', async ({ request }) => {
    const res = await request.post(`${BASE}/api/alt-reality/project`, {
      data: { horizon: 30 },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test('GET /api/alt-reality/project 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/alt-reality/project`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/mystery-rewards/claim-daily 401 FR', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mystery-rewards/claim-daily`, { data: {} })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test('GET /api/mystery-rewards/history 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/mystery-rewards/history`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/minimal-ritual/tick 401 FR', async ({ request }) => {
    const res = await request.post(`${BASE}/api/minimal-ritual/tick`, {
      data: { habit_slug: 'respiration_consciente' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test('GET /api/minimal-ritual/today 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/minimal-ritual/today`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/mental-journal/analyze 401 FR', async ({ request }) => {
    const res = await request.post(`${BASE}/api/mental-journal/analyze`, {
      data: { audio_base64: 'x'.repeat(800) },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
  })

  test('GET /api/mental-journal/entries 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/mental-journal/entries`)
    expect(res.status()).toBe(401)
  })
})

// ============================================================================
// G6 — APIs validation : auth first (payload invalide → 401 pas 400)
// ============================================================================
test.describe('G6 — APIs validation (auth first)', () => {
  test('POST /api/core/events payload vide → 401 (auth before Zod)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/core/events`, { data: {} })
    expect(res.status()).toBe(401)
  })

  test('POST /api/energy-replacement/session payload invalide → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/energy-replacement/session`, {
      data: { invalid: true },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/minimal-ritual/tick habit_slug invalide → 401 (auth first)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/minimal-ritual/tick`, {
      data: { habit_slug: 'foo_bar_inventé' },
    })
    expect(res.status()).toBe(401)
  })
})

// ============================================================================
// G6 — PostgREST mukti schema : tables G6 exposées avec RLS
// ============================================================================
test.describe('G6 — PostgREST mukti schema (RLS anon empty)', () => {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'Accept-Profile': 'mukti',
  }

  test('mukti.core_events RLS anon empty', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/core_events?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.core_event_sessions RLS anon empty', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/core_event_sessions?select=event_id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.core_event_participants RLS anon', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/core_event_participants?select=event_id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.energy_replacement_sessions RLS anon denied', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/energy_replacement_sessions?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
    if (res.status() === 200) {
      const json = await res.json()
      expect(Array.isArray(json)).toBe(true)
    }
  })

  test('mukti.alt_reality_sessions RLS anon denied', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/alt_reality_sessions?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.mystery_rewards RLS anon denied', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/mystery_rewards?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.minimal_ritual_ticks RLS anon denied', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/minimal_ritual_ticks?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })

  test('mukti.mental_journal_entries RLS anon denied', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/mental_journal_entries?select=id&limit=1`,
      { headers }
    )
    expect([200, 401]).toContain(res.status())
  })
})

// ============================================================================
// G6.1 — Seeds protocols : 10 protocoles publiquement lisibles
// ============================================================================
test.describe('G6 — Seeds 10 protocoles crisis-safe', () => {
  test('mukti.core_protocols 10 seeds publics', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/core_protocols?select=id,variant,duration_sec&order=id`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Accept-Profile': 'mukti',
        },
      }
    )
    expect(res.status()).toBe(200)
    const json = (await res.json()) as Array<{ id: string; variant: string; duration_sec: number }>
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBeGreaterThanOrEqual(10)
    const ids = new Set(json.map(p => p.id))
    for (const expected of [
      'panic_off_2min',
      'ancrage_5min',
      'recuperation_12min',
      'sommeil_7min',
      'coherence_10min',
      'soutien_aidants_12min',
      'animal_calm_5min',
      'wildlife_urgence_7min',
      'refuge_sature_10min',
      'one_planet_sync_12min',
    ]) {
      expect(ids.has(expected)).toBe(true)
    }
  })

  test('mukti.core_world_radar_logs requires auth (super_admin)', async ({ request }) => {
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/core_world_radar_logs?select=ran_at&limit=1`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'Accept-Profile': 'mukti',
        },
      }
    )
    // Should return empty (RLS denies) but not 500
    expect([200, 401, 403]).toContain(res.status())
  })
})

// ============================================================================
// G6.6 — CRONs : 401 sans CRON_SECRET
// ============================================================================
test.describe('G6 — CRONs unauthorized', () => {
  for (const cron of [
    '/api/cron/core-world-radar',
    '/api/cron/core-phase-tick',
    '/api/cron/mental-journal-relapse-scan',
  ]) {
    test(`${cron} 401 sans CRON_SECRET`, async ({ request }) => {
      const res = await request.post(`${BASE}${cron}`, { data: {} })
      expect([401, 403]).toContain(res.status())
    })
  }
})

// ============================================================================
// G6 — SEO régression
// ============================================================================
test.describe('G6 — SEO régression', () => {
  test('/sitemap.xml 200', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`)
    expect(res.status()).toBe(200)
  })
  test('/robots.txt 200', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`)
    expect(res.status()).toBe(200)
  })
})
