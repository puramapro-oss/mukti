import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'

const dependencies = vi.hoisted(() => ({ router: { back: vi.fn(), replace: vi.fn() }, success: vi.fn(), error: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => dependencies.router }))
vi.mock('sonner', () => ({ toast: { success: dependencies.success, error: dependencies.error } }))
import ModeFrame from '../../src/components/modes/ModeFrame'

const START = new Date('2026-11-12T08:00:00.000Z')
const ID = '00000000-0000-4000-8000-000000000001'
const ADDICTION = '00000000-0000-4000-8000-000000000002'
const RETURN_PATH = `/dashboard/liberation/${ADDICTION}`
type Payload = Record<string, unknown>
type Complete = Parameters<ComponentProps<typeof ModeFrame>['children']>[0]['onCompleted']
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
})
const sentBody = (request: RequestInit | undefined): Payload => JSON.parse(String(request?.body)) as Payload
const confirmation = (payload: Payload, changes: Payload = {}) => response({ ok: true, session: {
  ...payload, id: payload.client_session_id,
  urge_before: payload.urge_before ?? null, urge_after: payload.urge_after ?? null, ...changes,
} })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const activity = ({ onCompleted }: { onCompleted: Complete }) =>
  <button onClick={() => onCompleted('completed')}>Terminer l’activité</button>
const frame = (children = activity, addictionId = ADDICTION) =>
  <ModeFrame modeId="multisensoriel" addictionId={addictionId} durationSec={180}>{children}</ModeFrame>
const begin = () => {
  fireEvent.click(screen.getByTestId('urge-before-8'))
  fireEvent.click(screen.getByTestId('mode-start'))
}
const finish = (seconds = 30) => {
  vi.setSystemTime(new Date(START.getTime() + seconds * 1000))
  fireEvent.click(screen.getByRole('button', { name: 'Terminer l’activité' }))
  fireEvent.click(screen.getByTestId('urge-after-4'))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(START)
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(ID)
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - START.getTime())
})

it('records the frozen active interval, never the time spent answering the return form', async () => {
  const request = vi.fn(async (_url: string, init?: RequestInit) => confirmation(sentBody(init)))
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish(45)
  vi.setSystemTime(new Date(START.getTime() + 600_000))
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByTestId('mode-submit'))
  await waitFor(() => expect(dependencies.router.replace).toHaveBeenCalledTimes(1))
  expect(sentBody(request.mock.calls[0][1])).toEqual({
    client_session_id: ID, mode: 'multisensoriel', addiction_id: ADDICTION,
    started_at: START.toISOString(), completed_at: '2026-11-12T08:00:45.000Z',
    duration_sec: 45, outcome: 'completed', urge_before: 8, urge_after: 4,
  })
  expect(dependencies.success).toHaveBeenCalledWith('Session enregistrée.')
  expect(dependencies.router.replace).toHaveBeenCalledWith(RETURN_PATH)
  expect(dependencies.router.back).not.toHaveBeenCalled()
})

it('keeps onCompleted stable across renders and accepts only the first completion', async () => {
  const callbacks: Complete[] = []
  const child = (props: { onCompleted: Complete }) => { callbacks.push(props.onCompleted); return activity(props) }
  const request = vi.fn(async (_url: string, init?: RequestInit) => confirmation(sentBody(init)))
  vi.stubGlobal('fetch', request)
  const view = render(frame(child)); begin()
  const first = callbacks[0]
  view.rerender(frame(child))
  expect(callbacks.at(-1)).toBe(first)
  vi.setSystemTime(new Date(START.getTime() + 12_000))
  act(() => { first('interrupted'); first('resisted') })
  vi.setSystemTime(new Date(START.getTime() + 60_000))
  act(() => first('resisted'))
  fireEvent.click(screen.getByTestId('mode-submit'))
  await waitFor(() => expect(dependencies.router.replace).toHaveBeenCalledTimes(1))
  expect(sentBody(request.mock.calls[0][1])).toMatchObject({ duration_sec: 12, outcome: 'interrupted' })
})

it('keeps elapsed duration monotonic when the system clock changes during a session', async () => {
  let elapsed = 500
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
  const request = vi.fn(async (_url: string, init?: RequestInit) => confirmation(sentBody(init)))
  vi.stubGlobal('fetch', request)
  render(frame()); begin()
  elapsed += 30_000
  vi.setSystemTime(new Date('2026-11-12T09:00:00.000Z'))
  fireEvent.click(screen.getByRole('button', { name: 'Terminer l’activité' }))
  fireEvent.click(screen.getByTestId('mode-submit'))
  await waitFor(() => expect(dependencies.router.replace).toHaveBeenCalledTimes(1))
  expect(sentBody(request.mock.calls[0][1])).toMatchObject({
    duration_sec: 30, started_at: START.toISOString(), completed_at: '2026-11-12T09:00:00.000Z',
  })
})

it('blocks a second save synchronously and keeps its answers fixed while the first is pending', async () => {
  const write = deferred<Response>()
  const request = vi.fn((_url: string, _init?: RequestInit) => write.promise)
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish()
  const button = screen.getByTestId('mode-submit')
  act(() => { fireEvent.click(button); fireEvent.click(button) })
  expect(request).toHaveBeenCalledTimes(1)
  expect((screen.getByTestId('urge-after-4') as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { write.resolve(confirmation(sentBody(request.mock.calls[0][1]))); await Promise.resolve() })
  expect(dependencies.router.replace).toHaveBeenCalledTimes(1)
})

it('retains the form on a network failure and retries the exact ID, times and answers without local storage', async () => {
  const writeStorage = vi.spyOn(Storage.prototype, 'setItem')
  let fail = true
  const request = vi.fn(async (_url: string, init?: RequestInit) => {
    if (fail) throw new Error('network unavailable')
    return confirmation(sentBody(init))
  })
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish(90)
  fireEvent.click(screen.getByTestId('mode-submit'))
  expect((await screen.findByRole('alert')).textContent).toContain('Enregistrement non confirmé')
  expect(dependencies.router.replace).not.toHaveBeenCalled()
  expect(screen.getByTestId('urge-after-4').getAttribute('aria-checked')).toBe('true')
  expect(screen.queryByText(/gardée localement/)).toBeNull()
  expect(writeStorage).not.toHaveBeenCalled()
  fail = false
  vi.setSystemTime(new Date(START.getTime() + 900_000))
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer l’enregistrement' }))
  await waitFor(() => expect(dependencies.router.replace).toHaveBeenCalledTimes(1))
  expect(request.mock.calls[1][1]?.body).toBe(request.mock.calls[0][1]?.body)
  expect(dependencies.success).toHaveBeenCalledTimes(1)
})

it.each([
  ['HTTP failure', () => response({ error: 'Database unavailable' }, 503)],
  ['invalid JSON', () => new Response('not-json', { status: 200 })],
  ['missing receipt', () => response({ ok: true })],
  ['wrong session', (body: Payload) => confirmation(body, { id: 'different-session' })],
  ['wrong outcome', (body: Payload) => confirmation(body, { outcome: 'resisted' })],
] as const)('does not leave or claim success after %s', async (_name, reply) => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => reply(sentBody(init))))
  render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  await screen.findByRole('alert')
  expect(dependencies.router.replace).not.toHaveBeenCalled()
  expect(dependencies.success).not.toHaveBeenCalled()
  expect((screen.getByTestId('mode-submit') as HTMLButtonElement).disabled).toBe(false)
})

it('bounds a noncooperative request, ignores its late success, and permits an explicit identical retry', async () => {
  vi.useRealTimers(); vi.useFakeTimers(); vi.setSystemTime(START)
  const oldWrite = deferred<Response>()
  const newWrite = deferred<Response>()
  let calls = 0
  const request = vi.fn((_url: string, _init?: RequestInit) => ++calls === 1 ? oldWrite.promise : newWrite.promise)
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  await act(async () => { await vi.advanceTimersByTimeAsync(10_001) })
  expect(screen.getByRole('alert').textContent).toContain('Enregistrement non confirmé')
  expect(request).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true)
  fireEvent.click(screen.getByTestId('mode-submit'))
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1][1]?.body).toBe(request.mock.calls[0][1]?.body)
  await act(async () => { oldWrite.resolve(confirmation(sentBody(request.mock.calls[0][1]))); await Promise.resolve() })
  expect(dependencies.router.replace).not.toHaveBeenCalled()
  expect(dependencies.success).not.toHaveBeenCalled()
  await act(async () => { newWrite.resolve(confirmation(sentBody(request.mock.calls[1][1]))); await Promise.resolve() })
  expect(dependencies.router.replace).toHaveBeenCalledTimes(1)
  expect(dependencies.success).toHaveBeenCalledTimes(1)
})

it('allows an explicit departure during a pending save and ignores its eventual reply', async () => {
  const write = deferred<Response>()
  const request = vi.fn((_url: string, _init?: RequestInit) => write.promise)
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  expect(screen.getByText(/Quitter ne garantit pas/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Quitter cette page' }))
  expect(dependencies.router.replace).toHaveBeenCalledTimes(1)
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => { write.resolve(confirmation(sentBody(request.mock.calls[0][1]))); await Promise.resolve() })
  expect(dependencies.router.replace).toHaveBeenCalledTimes(1)
  expect(dependencies.success).not.toHaveBeenCalled()
})

it('cancels on unmount without a false saved state or delayed navigation', async () => {
  const write = deferred<Response>()
  const request = vi.fn((_url: string, _init?: RequestInit) => write.promise)
  vi.stubGlobal('fetch', request)
  const view = render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  view.unmount()
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => { write.resolve(confirmation(sentBody(request.mock.calls[0][1]))); await Promise.resolve() })
  expect(dependencies.router.replace).not.toHaveBeenCalled()
  expect(dependencies.success).not.toHaveBeenCalled()
})

it('starts a fresh form for a changed target and rejects old callbacks and responses', async () => {
  const write = deferred<Response>()
  const request = vi.fn((_url: string, _init?: RequestInit) => write.promise)
  vi.stubGlobal('fetch', request)
  let oldComplete!: Complete
  const child = (props: { onCompleted: Complete }) => { oldComplete = props.onCompleted; return activity(props) }
  const view = render(frame(child)); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  view.rerender(frame(activity, '00000000-0000-4000-8000-000000000099'))
  act(() => oldComplete('resisted'))
  await act(async () => { write.resolve(confirmation(sentBody(request.mock.calls[0][1]))); await Promise.resolve() })
  expect(screen.getByText('Avant de commencer')).toBeTruthy()
  expect((screen.getByTestId('mode-start') as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByTestId('mode-submit')).toBeNull()
  expect(dependencies.router.replace).not.toHaveBeenCalled()
})

it('does not send or invent an ID when a browser cannot provide cryptographic randomness', async () => {
  vi.stubGlobal('crypto', {})
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  expect(screen.getByRole('alert').textContent).toContain('indisponible sur ce navigateur')
  expect(request).not.toHaveBeenCalled()
  expect(dependencies.router.replace).not.toHaveBeenCalled()
  expect((screen.getByTestId('urge-after-4') as HTMLButtonElement).disabled).toBe(false)
})

it('uses a cryptographic UUID fallback when randomUUID itself is unavailable', async () => {
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(23); return bytes } })
  const request = vi.fn(async (_url: string, init?: RequestInit) => confirmation(sentBody(init)))
  vi.stubGlobal('fetch', request)
  render(frame()); begin(); finish()
  fireEvent.click(screen.getByTestId('mode-submit'))
  await waitFor(() => expect(dependencies.router.replace).toHaveBeenCalledTimes(1))
  expect(sentBody(request.mock.calls[0][1]).client_session_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

it.each(['Quitter le mode', 'Finalement pas maintenant'])(
  'returns directly to the addiction from entry via %s without relying on browser history', name => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    render(frame())
    const exit = screen.getByRole('button', { name })
    act(() => { fireEvent.click(exit); fireEvent.click(exit) })
    expect(dependencies.router.replace).toHaveBeenCalledExactlyOnceWith(RETURN_PATH)
    expect(dependencies.router.back).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  },
)

it.each(['../outside', '//example.test', 'javascript:alert(1)', `${ADDICTION}?next=/outside`])(
  'returns to the local liberation list for a non-UUID target %s', addictionId => {
    render(frame(activity, addictionId))
    fireEvent.click(screen.getByRole('button', { name: 'Quitter le mode' }))
    expect(dependencies.router.replace).toHaveBeenCalledExactlyOnceWith('/dashboard/liberation')
    expect(dependencies.router.back).not.toHaveBeenCalled()
  },
)

it('canonicalizes a valid uppercase UUID in its local return destination', () => {
  render(frame(activity, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'))
  fireEvent.click(screen.getByRole('button', { name: 'Quitter le mode' }))
  expect(dependencies.router.replace).toHaveBeenCalledExactlyOnceWith(
    '/dashboard/liberation/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  )
})

it('can leave without sending anything and restores the previous body scrolling setting', () => {
  document.body.style.overflow = 'clip'
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  const view = render(frame()); begin(); finish()
  fireEvent.click(screen.getByRole('button', { name: 'Sortir sans enregistrer' }))
  expect(dependencies.router.replace).toHaveBeenCalledExactlyOnceWith(RETURN_PATH)
  expect(dependencies.router.back).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
  view.unmount()
  expect(document.body.style.overflow).toBe('clip')
  document.body.style.overflow = ''
})
