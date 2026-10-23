import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuroraSessionFull from '../../src/components/aurora/AuroraSessionFull'
import AuroraCanvasInner from '../../src/components/aurora/AuroraCanvasInner'
import { mockAnimationClock } from './clock'

const mocks = vi.hoisted(() => ({
  audio: { prepare: vi.fn(async () => {}), start: vi.fn(async () => {}), stop: vi.fn(),
    dispose: vi.fn(), setPhase: vi.fn(), setEnabled: vi.fn(), setVoiceGuidance: vi.fn(), speakPhaseCue: vi.fn() },
  haptic: { pulse: vi.fn(), cancel: vi.fn(), setEnabled: vi.fn(), isSupported: () => true },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/aurora-audio', () => ({ createAuroraAudio: () => mocks.audio }))
vi.mock('@/lib/aurora-haptic', () => ({ createAuroraHaptic: () => mocks.haptic }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../src/components/aurora/AuroraCanvas', () => ({
  default: ({ animationEnabled }: { animationEnabled?: boolean }) => (
    <div data-testid="visual-playback">{animationEnabled ? 'animated' : 'still'}</div>
  ),
}))
vi.mock('../../src/components/aurora/PulseOfSafety', () => ({ default: () => <div data-testid="breath-pulse" /> }))
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ frameloop }: { frameloop?: string }) => <div data-testid="webgl-scene" data-frameloop={frameloop} />,
}))
vi.mock('../../src/components/aurora/FractalMesh', () => ({ default: () => null }))
vi.mock('../../src/components/aurora/EventHorizon', () => ({ default: () => null }))
vi.mock('../../src/components/aurora/ParticleField', () => ({ default: () => null }))
vi.mock('../../src/components/aurora/ProgressRing5Phases', () => ({
  default: () => null, phaseLabelShort: (name: string) => name,
}))

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
function deferredResponse() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((r) => { resolve = r })
  return { promise, resolve }
}
beforeEach(() => { vi.clearAllMocks() })

describe('AURORA session controls and persistence', () => {
  it('sends only one start request for rapid repeated clicks', async () => {
    mockAnimationClock()
    const pending = deferredResponse()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<AuroraSessionFull variant="calm" />)
    const button = screen.getByRole('button', { name: 'Démarrer la session' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledOnce()
    view.unmount()
    await act(async () => pending.resolve(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
  })
  it('does not start sound when the server refuses the session', async () => {
    mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'Connexion requise' }, 401)))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(screen.getByText('Connexion requise')).toBeTruthy()
  })
  it('never restarts after unmount when a start response arrives late', async () => {
    const clock = mockAnimationClock()
    const pending = deferredResponse()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const view = render(<AuroraSessionFull variant="calm" />)
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' }))
    view.unmount()
    mocks.audio.start.mockClear()
    await act(async () => pending.resolve(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.start).not.toHaveBeenCalled()
  })
  it('pauses audio and vibration, then restores the current breath on resume', async () => {
    const clock = mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    clock.frame(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(mocks.audio.stop).toHaveBeenCalledOnce()
    expect(mocks.haptic.cancel).toHaveBeenCalledOnce()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reprendre la session' })))
    expect(mocks.audio.start).toHaveBeenCalledTimes(2)
    expect(mocks.audio.setPhase).toHaveBeenLastCalledWith('inspire')
  })
  it('reports an unsuccessful save instead of silently claiming success', async () => {
    const clock = mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' }))
      .mockResolvedValueOnce(response({ error: 'Échec sauvegarde' }, 500)))
    render(<AuroraSessionFull variant="ignite" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    for (const time of [0, 8000, 28000, 88000, 108000, 128000]) clock.frame(time)
    await act(async () => {})
    expect(mocks.toast.success).not.toHaveBeenCalled()
    expect(screen.getByText(/enregistrement|sauvegarde/i)).toBeTruthy()
  })

  it.each([
    { ok: true }, { ok: true, session_id: '' }, { ok: true, session_id: '../other' },
    { ok: false, session_id: '00000000-0000-4000-8000-000000000001' },
  ])('rejects an invalid start response: %j', async (data) => {
    mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response(data)))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('can cancel a pending start without restarting on the late response', async () => {
    const clock = mockAnimationClock()
    const pending = deferredResponse()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<AuroraSessionFull variant="calm" />)
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }))
    await act(async () => pending.resolve(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    expect(clock.frames.size).toBe(0)
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('pauses on backgrounding and requires an explicit resume', async () => {
    const clock = mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    clock.frame(1000)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('button', { name: 'Reprendre la session' })).toBeTruthy()
    expect(clock.frames.size).toBe(0)
    hidden.mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(mocks.audio.start).toHaveBeenCalledOnce()
    expect(clock.frames.size).toBe(0)
  })

  it('persists a stopped session once and disables start while saving', async () => {
    const clock = mockAnimationClock()
    const save = deferredResponse()
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' }))
      .mockImplementationOnce(() => save.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    clock.frame(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).total_duration_sec).toBe(1)
    await act(async () => save.resolve(response({ ok: true, level_reached: 'brume', streak_days: 1 })))
    expect(screen.getByText('brume')).toBeTruthy()
    expect(mocks.toast.info).toHaveBeenCalledWith('Session arrêtée et enregistrée.')
  })

  it('ignores a late audio resume after the user stops', async () => {
    const clock = mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    clock.frame(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    let resolve!: () => void
    mocks.audio.start.mockImplementationOnce(() => new Promise<void>((r) => { resolve = r }))
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre la session' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }))
    await act(async () => resolve())
    expect(clock.frames.size).toBe(0)
    expect(screen.queryByRole('button', { name: 'Mettre en pause' })).toBeNull()
  })

  it('times out a stalled start and restores the start control', async () => {
    vi.useFakeTimers()
    mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))
    render(<AuroraSessionFull variant="calm" />)
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' }))
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(screen.getByRole('alert').textContent).toContain('ne répond pas')
    expect((screen.getByRole('button', { name: 'Démarrer la session' }) as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.audio.start).not.toHaveBeenCalled()
  })

  it('replaces breathing instructions and the pulse while paused, then restores them on resume', async () => {
    mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' })))
    render(<AuroraSessionFull variant="calm" />)
    expect(screen.getByTestId('visual-playback').textContent).toBe('still')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    expect(screen.getByText('Inspire')).toBeTruthy()
    expect(screen.getByTestId('visual-playback').textContent).toBe('animated')
    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }))
    expect(screen.getByRole('status').textContent).toBe('En pause')
    expect(screen.queryByText('Inspire')).toBeNull()
    expect(screen.queryByTestId('breath-pulse')).toBeNull()
    expect(screen.getByTestId('visual-playback').textContent).toBe('still')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reprendre la session' })))
    expect(screen.getByText('Inspire')).toBeTruthy()
    expect(screen.getByTestId('breath-pulse')).toBeTruthy()
    expect(screen.getByTestId('visual-playback').textContent).toBe('animated')
  })

  it('distinguishes a stopped session and a pending save from the ready state', async () => {
    mockAnimationClock()
    const save = deferredResponse()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' }))
      .mockImplementationOnce(() => save.promise))
    render(<AuroraSessionFull variant="calm" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }))
    expect(screen.getByRole('status').textContent).toBe('Enregistrement…')
    expect(screen.getByTestId('visual-playback').textContent).toBe('still')
    await act(async () => save.resolve(response({ ok: true, level_reached: null, streak_days: 0 })))
    expect(screen.getByRole('status').textContent).toBe('Session arrêtée')
    expect(screen.queryByText('Brume')).toBeNull()
    expect(screen.getByText('Aucun niveau atteint')).toBeTruthy()
  })

  it('keeps completion and failed recording distinct', async () => {
    const clock = mockAnimationClock()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ ok: true, session_id: '00000000-0000-4000-8000-000000000001' }))
      .mockResolvedValueOnce(response({ error: 'Sauvegarde refusée' }, 500)))
    render(<AuroraSessionFull variant="ignite" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session' })))
    for (const time of [0, 8000, 28000, 88000, 108000, 128000]) clock.frame(time)
    await act(async () => {})
    expect(screen.getByRole('status').textContent).toBe('Session terminée')
    expect(screen.getByRole('alert').textContent).toContain('enregistrement non confirmé')
    expect(screen.getByTestId('visual-playback').textContent).toBe('still')
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })
})

describe('AURORA rendering policy', () => {
  const breathState = { phase: 'inspire' as const, progress: 0.5, elapsedSec: 1, phaseDurationSec: 2 }

  it('stops continuous rendering when animation is paused and restores it on resume', () => {
    const view = render(<AuroraCanvasInner breathState={breathState} color="#7C3AED" animationEnabled />)
    expect(screen.getByTestId('webgl-scene').getAttribute('data-frameloop')).toBe('always')
    view.rerender(<AuroraCanvasInner breathState={breathState} color="#7C3AED" animationEnabled={false} />)
    expect(screen.getByTestId('webgl-scene').getAttribute('data-frameloop')).toBe('demand')
    view.rerender(<AuroraCanvasInner breathState={breathState} color="#7C3AED" animationEnabled />)
    expect(screen.getByTestId('webgl-scene').getAttribute('data-frameloop')).toBe('always')
  })

  it('uses a static scene when reduced motion is requested and reacts to preference changes', async () => {
    let matches = true
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return matches },
      addEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_type: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
    })))
    const view = render(<AuroraCanvasInner breathState={breathState} color="#7C3AED" />)
    await act(async () => {})
    expect(screen.queryByTestId('webgl-scene')).toBeNull()
    act(() => { matches = false; for (const fn of listeners) fn({ matches } as MediaQueryListEvent) })
    expect(screen.getByTestId('webgl-scene')).toBeTruthy()
    act(() => { matches = true; for (const fn of listeners) fn({ matches } as MediaQueryListEvent) })
    expect(screen.queryByTestId('webgl-scene')).toBeNull()
    view.unmount()
    expect(listeners.size).toBe(0)
  })
})
