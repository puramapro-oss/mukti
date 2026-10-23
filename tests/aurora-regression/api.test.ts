import { expect, it, vi } from 'vitest'
import { auroraRequest } from '../../src/lib/aurora-session-api'

it.each([null, [], 'not an object'])('rejects a non-object JSON body: %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))))
  await expect(auroraRequest('/api/aurora/session', {}, new AbortController())).rejects.toThrow('invalide')
})

it('does not send an already cancelled request', async () => {
  const controller = new AbortController()
  controller.abort()
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await expect(auroraRequest('/api/aurora/session', {}, controller)).rejects.toThrow('Aborted')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('rejects a late response even if the transport ignores cancellation', async () => {
  vi.useFakeTimers()
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r })))
  const pending = auroraRequest('/api/aurora/session', {}, new AbortController())
  const rejection = expect(pending).rejects.toThrow('Aborted')
  await vi.advanceTimersByTimeAsync(10_000)
  resolve(new Response(JSON.stringify({ ok: true })))
  await rejection
  expect(vi.getTimerCount()).toBe(0)
})
