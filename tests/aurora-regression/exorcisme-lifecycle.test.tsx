import { StrictMode, type PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  router: { push: vi.fn() }, toast: vi.fn(), success: vi.fn(), error: vi.fn(), vibrate: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => dependencies.router }))
vi.mock('sonner', () => ({ toast: Object.assign(dependencies.toast, { success: dependencies.success, error: dependencies.error }) }))
vi.mock('../../src/lib/accessibility', () => ({ safeVibrate: dependencies.vibrate }))
import { useExorcismeSession } from '../../src/components/exorcisme/hooks/useExorcismeSession'
import { useExorcismeDestruction } from '../../src/components/exorcisme/hooks/useExorcismeDestruction'
import { useExorcismeSealing } from '../../src/components/exorcisme/hooks/useExorcismeSealing'
import type { UseExorcismePhaseReturn } from '../../src/components/exorcisme/hooks/useExorcismePhase'
import { mockAnimationClock } from './clock'

const ID = '00000000-0000-4000-8000-000000000001'
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const started = () => response({ ok: true, session_id: ID, possession_text: 'une habitude' }, 201)
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const flush = async () => { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }) }
const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>
function phaseData(): UseExorcismePhaseReturn {
  return { phase: 'revelation', phaseMsRef: { current: {} }, startTsRef: { current: 0 },
    goToPhase: vi.fn(), snapshotPhaseDurations: vi.fn(() => ({ invocation: 1_000, revelation: 2_000 })) }
}
function sessionHook() {
  const phase = phaseData()
  const taps = { current: 4 }, affirmation = { current: 'Je choisis une autre habitude.' }
  const view = renderHook(() => useExorcismeSession(phase, taps, affirmation), { wrapper })
  act(() => view.result.current.setPossessionDraft('une habitude'))
  return { ...view, phase, taps }
}
async function begin(view: ReturnType<typeof sessionHook>) {
  await act(() => view.result.current.handleSubmitPossession())
  expect(view.result.current.session?.id).toBe(ID)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockAnimationClock()
})

describe('ritual start and completion lifecycle', () => {
  it('accepts only one start while a request is pending, including synchronous double taps', async () => {
    const pending = deferred<Response>(), request = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = sessionHook()
    let first!: Promise<void>, second!: Promise<void>
    act(() => { first = view.result.current.handleSubmitPossession(); second = view.result.current.handleSubmitPossession() })
    expect(request).toHaveBeenCalledOnce()
    expect(view.result.current.starting).toBe(true)
    await act(async () => { pending.resolve(started()); await Promise.all([first, second]) })
    expect(view.phase.goToPhase).toHaveBeenCalledOnce()
    expect(dependencies.vibrate).toHaveBeenCalledOnce()
    expect(view.result.current.starting).toBe(false)
  })

  it('invalidates a pending start immediately when the person exits', async () => {
    const pending = deferred<Response>(), request = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = sessionHook()
    act(() => { void view.result.current.handleSubmitPossession() })
    await act(() => view.result.current.exitSession('interrupted', false))
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true)
    await act(async () => pending.resolve(started()))
    await flush()
    expect(view.phase.goToPhase).not.toHaveBeenCalled()
    expect(dependencies.vibrate).not.toHaveBeenCalled()
    expect(view.result.current.sessionRef.current).toBeNull()
    expect(dependencies.router.push).toHaveBeenCalledOnce()
  })

  it('does not restart a ritual after unmount even if the transport ignores cancellation', async () => {
    const pending = deferred<Response>(), request = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = sessionHook()
    act(() => { void view.result.current.handleSubmitPossession() })
    view.unmount()
    await act(async () => pending.resolve(started()))
    await flush()
    expect(view.phase.goToPhase).not.toHaveBeenCalled()
    expect(dependencies.vibrate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { ok: true, session_id: '', possession_text: 'une habitude' },
    { ok: true, session_id: ID, possession_text: {} },
    { ok: false, session_id: ID, possession_text: 'une habitude' },
  ])('rejects an invalid start response: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => response(body)))
    const view = sessionHook()
    await act(() => view.result.current.handleSubmitPossession())
    expect(view.result.current.session).toBeNull()
    expect(view.result.current.startError).toBeTruthy()
    expect(view.phase.goToPhase).not.toHaveBeenCalled()
  })

  it('settles a start at the bounded deadline when the transport never settles', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const view = sessionHook()
    let done!: Promise<void>
    act(() => { done = view.result.current.handleSubmitPossession() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await done })
    expect(view.result.current.starting).toBe(false)
    expect(view.result.current.startError).toMatch(/non confirmé/i)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a failed completion available for retry without claiming success or leaving', async () => {
    const request = vi.fn().mockResolvedValueOnce(started()).mockResolvedValueOnce(response({ error: 'indisponible' }, 503))
    vi.stubGlobal('fetch', request)
    const view = sessionHook(); await begin(view)
    await act(() => view.result.current.exitSession('completed', true))
    expect(view.result.current.saveError).toBeTruthy()
    expect(view.result.current.closing).toBe(true)
    expect(dependencies.success).not.toHaveBeenCalled()
    expect(dependencies.router.push).not.toHaveBeenCalled()
    expect(view.result.current.sessionRef.current).toBeNull()
  })

  it('retries the exact frozen completion once despite later phase/tap changes', async () => {
    const pending = deferred<Response>()
    const request = vi.fn().mockResolvedValueOnce(started()).mockResolvedValueOnce(response({ error: 'indisponible' }, 503)).mockImplementation(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = sessionHook(); await begin(view)
    await act(() => view.result.current.exitSession('completed', true))
    const firstBody = request.mock.calls[1][1].body
    view.taps.current = 99
    vi.mocked(view.phase.snapshotPhaseDurations).mockReturnValue({ invocation: 60_000 })
    let first!: Promise<void>, second!: Promise<void>
    act(() => { first = view.result.current.retrySave(); second = view.result.current.retrySave() })
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[2][1].body).toBe(firstBody)
    await act(async () => { pending.resolve(response({ ok: true, stats: {} })); await Promise.all([first, second]) })
    expect(dependencies.success).toHaveBeenCalledWith('Séance enregistrée.')
    expect(dependencies.router.push).toHaveBeenCalledOnce()
  })

  it('allows explicit exit during an uncertain save and ignores its late confirmation', async () => {
    const pending = deferred<Response>()
    const request = vi.fn().mockResolvedValueOnce(started()).mockImplementation(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = sessionHook(); await begin(view)
    act(() => { void view.result.current.exitSession('completed', true) })
    act(() => view.result.current.leaveWithoutSaving())
    expect(request.mock.calls[1][1].signal.aborted).toBe(true)
    await act(async () => pending.resolve(response({ ok: true, stats: {} })))
    await flush()
    expect(dependencies.success).not.toHaveBeenCalled()
    expect(dependencies.router.push).toHaveBeenCalledOnce()
  })

  it('rejects a completion response without an explicit saved receipt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(started()).mockResolvedValueOnce(response({ stats: {} })))
    const view = sessionHook(); await begin(view)
    await act(() => view.result.current.exitSession('completed', true))
    expect(view.result.current.saveError).toBeTruthy()
    expect(dependencies.success).not.toHaveBeenCalled()
    expect(dependencies.router.push).not.toHaveBeenCalled()
  })
})

describe('ritual transitions and generated guidance', () => {
  function destruction() {
    const session = { current: { id: ID, possessionText: 'une habitude' } }, taps = { current: 0 }
    const affirmation = { current: null as string | null }, goToPhase = vi.fn()
    const view = renderHook(({ active }) => useExorcismeDestruction(session, taps, affirmation, goToPhase, active), {
      wrapper, initialProps: { active: true },
    })
    return { ...view, taps, affirmation, goToPhase }
  }
  function tap(view: ReturnType<typeof destruction>, count = 4) {
    for (let i = 0; i < count; i++) act(() => view.result.current.handleDestructionTap())
  }

  it('keeps repeated taps and React updater replays from duplicating effects', async () => {
    const request = vi.fn(async () => response({ ok: true, affirmation_fr: 'Je choisis une autre habitude.', affirmation_en: 'I choose another habit.' }))
    vi.stubGlobal('fetch', request)
    const view = destruction(); tap(view, 8)
    await flush()
    expect(request).toHaveBeenCalledOnce()
    expect(view.taps.current).toBe(4)
    expect(dependencies.vibrate).toHaveBeenCalledTimes(4)
    await act(() => vi.advanceTimersByTimeAsync(900))
    expect(view.goToPhase).toHaveBeenCalledOnce()
  })

  it.each(['unmount', 'deactivate'])('cancels pending effects on %s', async (action) => {
    const pending = deferred<Response>(), request = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', request)
    const view = destruction(); tap(view)
    if (action === 'unmount') view.unmount(); else view.rerender({ active: false })
    await act(async () => pending.resolve(response({ ok: true, affirmation_fr: 'Late guidance' })))
    await act(() => vi.advanceTimersByTimeAsync(15_000))
    expect(view.affirmation.current).toBeNull()
    expect(view.goToPhase).not.toHaveBeenCalled()
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the declared fallback for malformed generated guidance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, affirmation_fr: {} })))
    const view = destruction(); tap(view); await flush()
    expect(view.result.current.affirmationError).toBe('generator_unavailable')
    expect(typeof view.affirmation.current).toBe('string')
    expect(view.result.current.affirmationLoading).toBe(false)
  })

  it('schedules sealing once and cancels it on unmount', () => {
    const exit = vi.fn(async () => {})
    const view = renderHook(() => useExorcismeSealing(exit), { wrapper })
    act(() => { view.result.current.handleSeal(); view.result.current.handleSeal() })
    expect(dependencies.vibrate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(1)
    view.unmount(); act(() => vi.advanceTimersByTime(600))
    expect(exit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('runs one live sealing completion after the cinematic delay', async () => {
    const exit = vi.fn(async () => {})
    const view = renderHook(() => useExorcismeSealing(exit), { wrapper })
    act(() => { view.result.current.handleSeal(); view.result.current.handleSeal() })
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(exit).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledWith('completed', true)
  })
})
