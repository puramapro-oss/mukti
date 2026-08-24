// MUKTI G6 — tests smoke C.O.R.E. Events + Modes 16-20 (G6.1 → G6.7)
// PART 1/2 : Régression G1-G5 + Pages + APIs auth guards
// Vérifie : régression G1-G5 intacte + auth guards G6 + APIs 401 FR bienveillantes

import { test, expect } from '@playwright/test'

const BASE = 'https://mukti.purama.dev'
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
