import { test, expect } from '@playwright/test'

test.describe('P5 — Story sharing (Satori + API)', () => {
  test('GET /api/og/story default → 200 PNG 1080×1920', async ({ request }) => {
    const res = await request.get('/api/og/story')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
    const buffer = await res.body()
    expect(buffer.byteLength).toBeGreaterThan(2000)
  })

  test('GET /api/og/story?type=gains&value=+1248€&headline=Test → 200 PNG', async ({ request }) => {
    const res = await request.get('/api/og/story?type=gains&value=%2B1+248+%E2%82%AC&headline=Test+story&sub=preuve')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  for (const type of ['streak', 'palier', 'mission', 'gains', 'classement', 'achievement', 'scan']) {
    test(`GET /api/og/story?type=${type} → 200 PNG`, async ({ request }) => {
      const res = await request.get(`/api/og/story?type=${type}`)
      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('image/png')
    })
  }

  test('GET /api/og/story?type=invalid_type fallbacks to gains → 200 PNG', async ({ request }) => {
    const res = await request.get('/api/og/story?type=invalid_type')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  test('POST /api/story/share unauth → 401', async ({ request }) => {
    const res = await request.post('/api/story/share', {
      data: { type: 'gains', headline: 'test', value: '+1€' },
    })
    expect(res.status()).toBe(401)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  test('POST /api/story/share unauth + invalid type → 401 (auth check first)', async ({ request }) => {
    const res = await request.post('/api/story/share', {
      data: { type: 'not_a_type' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/og/story responds < 5s', async ({ request }) => {
    const start = Date.now()
    const res = await request.get('/api/og/story?type=gains')
    const elapsed = Date.now() - start
    expect(res.status()).toBe(200)
    expect(elapsed).toBeLessThan(5000)
  })
})
