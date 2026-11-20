import { expect, it, vi } from 'vitest'
import { wellbeingRequest } from '../../src/lib/wellbeing-request'

it('does not call fetch for an already cancelled mutation', async () => {
  const controller = new AbortController()
  controller.abort()
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  await expect(wellbeingRequest('/test', { method: 'POST' }, controller.signal)).rejects.toThrow('non confirmé')
  expect(request).not.toHaveBeenCalled()
})

it('settles a timeout even if the transport ignores cancellation completely', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
  const promise = wellbeingRequest('/test', { method: 'PUT' })
  const rejection = expect(promise).rejects.toThrow('Délai dépassé')
  await vi.advanceTimersByTimeAsync(10_000)
  await rejection
  expect(vi.getTimerCount()).toBe(0)
})

it('does not accept a late JSON body after cancellation', async () => {
  vi.useFakeTimers()
  let resolveBody!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: () => new Promise(resolve => { resolveBody = resolve }),
  } as unknown as Response)))
  const controller = new AbortController()
  const promise = wellbeingRequest('/test', { method: 'POST' }, controller.signal)
  const rejection = expect(promise).rejects.toThrow('interrompue')
  await Promise.resolve()
  controller.abort()
  await rejection
  resolveBody({ ok: true })
  await Promise.resolve()
  expect(vi.getTimerCount()).toBe(0)
})

it.each([null, [], 'invalid', { ok: false }])('rejects an invalid response body %j', async body => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))))
  await expect(wellbeingRequest('/test')).rejects.toThrow('Réponse invalide')
})

it('uses private same-origin requests and accepts an explicit success', async () => {
  const request = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true, value: 3 })))
  vi.stubGlobal('fetch', request)
  await expect(wellbeingRequest('/test')).resolves.toEqual({ ok: true, value: 3 })
  expect(request.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
})

it('reports malformed JSON and network failures without infrastructure details', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce(new Response('<html>upstream failed</html>', { status: 502 }))
    .mockRejectedValueOnce(new Error('private internal hostname'))
  vi.stubGlobal('fetch', request)
  await expect(wellbeingRequest('/test')).rejects.toThrow('Réponse invalide')
  await expect(wellbeingRequest('/test', { method: 'POST' })).rejects.toThrow('Connexion interrompue. Enregistrement non confirmé.')
})
