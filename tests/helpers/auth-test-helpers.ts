import { expect, type APIRequestContext } from '@playwright/test'

export async function expectAuthGuard(request: APIRequestContext, url: string) {
  const res = await request.get(url, { maxRedirects: 0 })
  expect([307, 308]).toContain(res.status())
}

export async function expect401(request: APIRequestContext, url: string, method: 'GET' | 'POST' = 'GET', data?: unknown) {
  const res = method === 'GET'
    ? await request.get(url)
    : await request.post(url, { data })
  expect(res.status()).toBe(401)
}

export async function expect401WithFrenchError(request: APIRequestContext, url: string, data?: unknown) {
  const res = await request.post(url, { data })
  expect(res.status()).toBe(401)
  const body = await res.json()
  expect(body.error).toMatch(/[éèêàçù]|Connexion|requis/i)
}

export async function expect200(request: APIRequestContext, url: string) {
  const res = await request.get(url)
  expect(res.status()).toBe(200)
}

export async function expectEmptyArrayWithAuth(
  request: APIRequestContext,
  url: string,
  anonKey: string
) {
  const res = await request.get(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Prefer: 'return=representation',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body)).toBe(true)
  expect(body.length).toBe(0)
}
