import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NightPlayer from '../../src/components/reprogrammation/NightPlayer'

const mocks = vi.hoisted(() => ({
  nature: { start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), setSound: vi.fn(), setVolume: vi.fn() },
  speak: vi.fn(),
  cancel: vi.fn(),
  toast: { success: vi.fn() },
}))
vi.mock('@/lib/nature-sounds', () => ({ createNatureSoundEngine: () => mocks.nature }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../src/components/reprogrammation/nightPlayerHelpers', () => ({ speakAffirmation: mocks.speak }))
vi.mock('../../src/components/reprogrammation/useNightPlayerVolume', () => ({
  useNightPlayerVolume: () => ({ volumePct: 0.5, rampProgress: 0, rampRemainingSec: 1800 }),
}))
vi.mock('../../src/components/reprogrammation/NightPlayerRampProgress', () => ({ default: () => null }))
vi.mock('../../src/components/reprogrammation/NightPlayerSettings', () => ({ default: () => null }))

const valid = {
  ok: true,
  session_id: '00000000-0000-4000-8000-000000000010',
  affirmations: [{ id: '00000000-0000-4000-8000-000000000001', text_fr: 'Je peux faire une pause.', text_en: null, source: 'purama' }],
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
async function start() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session nuit' })))
}
async function stop() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Terminer la session' })))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('speechSynthesis', { cancel: mocks.cancel })
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => response(String(url).endsWith('/start') ? valid : { ok: true })))
})

describe('NightPlayer request and output lifecycle', () => {
  it('issues only one pending start even for two clicks in the same event turn', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const view = render(<NightPlayer />)
    const button = screen.getByRole('button', { name: 'Démarrer la session nuit' })
    await act(async () => { fireEvent.click(button); fireEvent.click(button) })
    expect(fetch).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => pending.resolve(response(valid)))
  })

  it('does not start output after unmount when the transport ignores cancellation', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    const view = render(<StrictMode><NightPlayer /></StrictMode>)
    await start(); view.unmount()
    await act(async () => pending.resolve(response(valid)))
    expect(mocks.nature.start).not.toHaveBeenCalled()
    expect(mocks.speak).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('offers cancellation while starting and ignores a subsequent successful response', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValue(pending.promise)
    render(<NightPlayer />); await start()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Annuler le démarrage' })))
    await act(async () => pending.resolve(response(valid)))
    expect(mocks.nature.start).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Démarrer la session nuit' })).toBeTruthy()
  })

  it('bounds a stalled start without automatically retrying the server mutation', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}))
    render(<NightPlayer />); await start()
    await act(async () => vi.advanceTimersByTimeAsync(10_001))
    expect(screen.getByRole('alert').textContent).toMatch(/démarrage|connexion|réessaie/i)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(mocks.nature.start).not.toHaveBeenCalled()
  })

  for (const data of [
    { ...valid, ok: false },
    { ...valid, session_id: '' },
    { ...valid, session_id: '../other' },
    { ...valid, affirmations: [{ ...valid.affirmations[0], text_fr: 123 }] },
    { ...valid, affirmations: [{ ...valid.affirmations[0], text_fr: '   ' }] },
    { ...valid, affirmations: [{ ...valid.affirmations[0], id: '' }] },
    { ...valid, affirmations: [{ ...valid.affirmations[0], source: 'invented' }] },
  ]) {
    it(`rejects contradictory or malformed start data ${JSON.stringify(data)}`, async () => {
      vi.mocked(fetch).mockResolvedValue(response(data))
      render(<NightPlayer />); await start()
      expect(mocks.nature.start).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  }

  for (const [status, data] of [[500, { ok: true }], [200, { ok: false }], [200, {}]] as const) {
    it(`never confirms an unsuccessful save: ${status} ${JSON.stringify(data)}`, async () => {
      vi.mocked(fetch).mockImplementation(async (url) => response(String(url).endsWith('/start') ? valid : data, String(url).endsWith('/start') ? 200 : status))
      render(<NightPlayer />); await start(); await stop()
      expect(mocks.nature.stop).toHaveBeenCalled()
      expect(mocks.toast.success).not.toHaveBeenCalled()
      expect(screen.getByRole('alert').textContent).toMatch(/enregistr|confirm/i)
    })
  }

  it('deduplicates end requests and prevents restart until saving has settled', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockImplementation(async (url) => String(url).endsWith('/start') ? response(valid) : pending.promise)
    render(<NightPlayer />); await start()
    const button = screen.getByRole('button', { name: 'Terminer la session' })
    await act(async () => { fireEvent.click(button); fireEvent.click(button) })
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/end'))).toHaveLength(1)
    expect((screen.getByRole('button', { name: 'Démarrer la session nuit' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => pending.resolve(response({ ok: true })))
    expect((screen.getByRole('button', { name: 'Démarrer la session nuit' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('bounds a stalled save and does not claim confirmation', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => String(url).endsWith('/start') ? response(valid) : new Promise<Response>(() => {}))
    render(<NightPlayer />); await start(); await stop()
    await act(async () => vi.advanceTimersByTimeAsync(10_001))
    expect(screen.getByRole('alert').textContent).toMatch(/enregistr|confirm/i)
    expect(mocks.toast.success).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Démarrer la session nuit' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not announce a late save after the player has unmounted', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockImplementation(async (url) => String(url).endsWith('/start') ? response(valid) : pending.promise)
    const view = render(<NightPlayer />); await start(); await stop(); view.unmount()
    await act(async () => pending.resolve(response({ ok: true })))
    expect(mocks.toast.success).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops nature output even when cancelling optional speech throws', async () => {
    render(<NightPlayer />); await start()
    mocks.cancel.mockImplementation(() => { throw new Error('speech unavailable') })
    await stop()
    expect(mocks.nature.stop).toHaveBeenCalled()
    mocks.cancel.mockReset()
  })
})
