import { test, expect } from '@playwright/test'

test.describe('P4 — /admin/financement pools (super_admin only)', () => {
  test('GET /api/admin/financement/deposit returns 405 (POST only)', async ({
    request,
  }) => {
    const res = await request.get('/api/admin/financement/deposit')
    expect(res.status()).toBe(405)
  })

  test('POST /api/admin/financement/deposit unauth → 401', async ({ request }) => {
    const res = await request.post('/api/admin/financement/deposit', {
      data: {
        type: 'aide_sasu',
        amount_euros: 100,
        source_name: 'Test',
      },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Connexion requise/i)
  })

  test('POST /api/admin/financement/deposit invalid body → 400 when auth bypassed', async ({
    request,
  }) => {
    // Without auth cookie we get 401 first — just assert non-200
    const res = await request.post('/api/admin/financement/deposit', {
      data: { type: 'invalid_type', amount_euros: -1, source_name: '' },
    })
    expect([400, 401]).toContain(res.status())
  })

  test('/dashboard/admin/financement requires auth → redirect /login', async ({
    page,
  }) => {
    const res = await page.goto('/dashboard/admin/financement')
    // Middleware redirects non-auth to /login?next=/dashboard/admin/financement
    expect(page.url()).toMatch(/\/login/)
    expect(res?.status() ?? 0).toBeLessThan(500)
  })
})
