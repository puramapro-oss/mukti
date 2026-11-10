import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import WellbeingFeedback from '../../src/components/wellbeing/WellbeingFeedback'
import WellbeingCheckin from '../../src/components/wellbeing/WellbeingCheckin'
import type { FeedbackSession } from '../../src/lib/wellbeing'
import type { WellbeingContext } from '../../src/lib/wellbeing-state'
import type { ComponentProps } from 'react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentProps<'a'>) => <a href={href} {...props}>{children}</a>,
}))

const fixedNow = new Date('2026-11-10T10:00:00.000Z')
const idA = '00000000-0000-4000-8000-000000000001'
const idB = '00000000-0000-4000-8000-000000000002'
const session = (id = idA, variant: FeedbackSession['variant'] = 'calm'): FeedbackSession => ({
  id, variant, completed_at: '2026-11-10T09:00:00.000Z',
  later_available_at: '2026-11-10T13:00:00.000Z', feedback: [],
})
const feed = (sessions: FeedbackSession[] = [session()]) => ({ ok: true, sessions, paused_variants: [] as string[] })
const context = (changes: Partial<WellbeingContext> = {}): WellbeingContext => ({
  physical: 'available', cognitive: 'available', sensory: 'limited', social: 'limited', minutes: 20,
  day: '2026-11-10', time_zone: 'Europe/Paris', updated_at: '2026-11-10T09:30:00.000Z', ...changes,
})
const contextReply = (value: WellbeingContext | null = context(), day = '2026-11-10') => ({
  ok: true, context: value, day, time_zone: 'Europe/Paris',
})
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const feedbackConsent = () => screen.getByRole('checkbox', { name: /J’accepte d’enregistrer ce retour/ }) as HTMLInputElement
const checkinConsent = () => screen.getByRole('checkbox', { name: /J’accepte d’enregistrer ces réponses/ }) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(fixedNow)
})

it('requires fresh answers and consent when a reload selects another session', async () => {
  let currentFeed = feed()
  const request = vi.fn(async (_url: string, _init?: RequestInit) => response(currentFeed))
  vi.stubGlobal('fetch', request)
  render(<WellbeingFeedback />)
  await screen.findByRole('button', { name: 'Enregistrer mon retour' })
  fireEvent.click(screen.getByRole('radio', { name: 'Mieux' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'J’ai ressenti un inconfort' }))
  fireEvent.click(feedbackConsent())

  currentFeed = feed([session(idB, 'focus'), session()])
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
  await waitFor(() => expect(screen.getByText(/focus ·/)).toBeTruthy())
  expect(feedbackConsent().checked).toBe(false)
  expect((screen.getByRole('radio', { name: 'Je ne sais pas' }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('checkbox', { name: 'J’ai ressenti un inconfort' }) as HTMLInputElement).checked).toBe(false)
  fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer mon retour' }).closest('form')!)
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
})

it('requires a new consent when the same session reaches the later stage', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response(feed())))
  render(<WellbeingFeedback />)
  await screen.findByRole('button', { name: 'Enregistrer mon retour' })
  fireEvent.click(screen.getByRole('radio', { name: 'Moins bien' }))
  fireEvent.click(feedbackConsent())
  vi.setSystemTime(new Date('2026-11-10T14:00:00.000Z'))
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.getByText(/calm ·.*retour ultérieur/)).toBeTruthy())
  expect(feedbackConsent().checked).toBe(false)
  expect((screen.getByRole('radio', { name: 'Je ne sais pas' }) as HTMLInputElement).checked).toBe(true)
})

it('blocks duplicate feedback submissions synchronously', async () => {
  const write = deferred<Response>()
  let currentFeed = feed()
  const request = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST' ? write.promise : response(currentFeed))
  vi.stubGlobal('fetch', request)
  render(<WellbeingFeedback />)
  await screen.findByRole('button', { name: 'Enregistrer mon retour' })
  fireEvent.click(feedbackConsent())
  const form = screen.getByRole('button', { name: 'Enregistrer mon retour' }).closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(request.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  currentFeed = feed([{ ...session(), feedback: [{ stage: 'immediate', feeling: 'unsure', discomfort: false, created_at: fixedNow.toISOString() }] }])
  await act(async () => { write.resolve(response({ ok: true })); await Promise.resolve() })
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Retour enregistré'))
})

it('preserves the current feedback draft after an unconfirmed write', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? response({ error: 'Retour non enregistré. Réessaie.' }, 503) : response(feed())))
  render(<WellbeingFeedback />)
  await screen.findByRole('button', { name: 'Enregistrer mon retour' })
  fireEvent.click(screen.getByRole('radio', { name: 'Moins bien' }))
  fireEvent.click(feedbackConsent())
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon retour' }))
  await screen.findByRole('alert')
  expect(feedbackConsent().checked).toBe(true)
  expect((screen.getByRole('radio', { name: 'Moins bien' }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('button', { name: 'Enregistrer mon retour' }) as HTMLButtonElement).disabled).toBe(false)
})

it('ignores a late success belonging to a previous session prop', async () => {
  const write = deferred<Response>()
  const request = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? write.promise : response(feed([session(), session(idB, 'focus')])))
  vi.stubGlobal('fetch', request)
  const view = render(<WellbeingFeedback sessionId={idA} />)
  await screen.findByRole('button', { name: 'Enregistrer mon retour' })
  fireEvent.click(feedbackConsent())
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon retour' }))
  view.rerender(<WellbeingFeedback sessionId={idB} />)
  await screen.findByText(/focus ·/)
  await act(async () => { write.resolve(response({ ok: true })); await Promise.resolve() })
  expect(feedbackConsent().checked).toBe(false)
  expect(screen.queryByText('Retour enregistré.')).toBeNull()
  expect((screen.getByRole('button', { name: 'Enregistrer mon retour' }) as HTMLButtonElement).disabled).toBe(true)
})

it('treats an incomplete feedback GET as an error without rendering a malformed form', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true })))
  render(<WellbeingFeedback />)
  expect((await screen.findByRole('alert')).textContent).toContain('Retours indisponibles')
  expect(screen.queryByRole('button', { name: 'Enregistrer mon retour' })).toBeNull()
})

it('preserves an edited check-in after failure and a later background refresh', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return response({ error: 'Enregistrement non confirmé.' }, 503)
    return response(url.includes('/context') ? contextReply() : feed())
  }))
  render(<WellbeingCheckin />)
  const minutes = screen.getByRole('spinbutton') as HTMLInputElement
  await waitFor(() => expect(minutes.value).toBe('20'))
  fireEvent.change(minutes, { target: { value: '9' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Énergie physique' }), { target: { value: 'rest' } })
  fireEvent.click(checkinConsent())
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }))
  await screen.findByRole('alert')
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(minutes.value).toBe('9')
  expect((screen.getByRole('combobox', { name: 'Énergie physique' }) as HTMLSelectElement).value).toBe('rest')
  expect(checkinConsent().checked).toBe(true)
  expect(screen.getByText('Modifications non enregistrées.')).toBeTruthy()
})

it('does not send two check-ins or reload stale values during a pending save', async () => {
  const write = deferred<Response>()
  let currentContext = contextReply()
  const request = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') return write.promise
    return response(url.includes('/context') ? currentContext : feed())
  })
  vi.stubGlobal('fetch', request)
  render(<WellbeingCheckin />)
  const minutes = screen.getByRole('spinbutton') as HTMLInputElement
  await waitFor(() => expect(minutes.value).toBe('20'))
  fireEvent.change(minutes, { target: { value: '9' } })
  fireEvent.click(checkinConsent())
  const form = screen.getByRole('button', { name: 'Enregistrer mes choix' }).closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  const beforeFocus = request.mock.calls.length
  fireEvent(window, new Event('focus'))
  expect(request.mock.calls).toHaveLength(beforeFocus)
  expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
  currentContext = contextReply(context({ minutes: 9 }))
  await act(async () => { write.resolve(response(currentContext)); await Promise.resolve() })
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('enregistrés'))
  expect(minutes.value).toBe('9')
})

it('does not resurrect deleted availability from an older in-flight read', async () => {
  const oldRead = deferred<Response>()
  let contextReads = 0
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return response({ ok: true })
    if (url.includes('/feedback')) return response(feed())
    contextReads += 1
    if (contextReads === 2) return oldRead.promise
    return response(contextReads === 1 ? contextReply() : contextReply(null))
  }))
  render(<WellbeingCheckin />)
  const minutes = screen.getByRole('spinbutton') as HTMLInputElement
  await waitFor(() => expect(minutes.value).toBe('20'))
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
  await waitFor(() => expect(contextReads).toBe(2))
  fireEvent.click(screen.getByRole('button', { name: 'Effacer mes disponibilités' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Disponibilités effacées.'))
  await act(async () => { oldRead.resolve(response(contextReply())); await Promise.resolve() })
  expect(minutes.value).toBe('5')
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it.each(['context', 'pauses'])('rejects an incomplete %s reply without suggestions', async invalid => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.includes('/context')
    ? invalid === 'context' ? { ok: true } : contextReply()
    : invalid === 'pauses' ? { ok: true } : feed())))
  render(<WellbeingCheckin />)
  expect((await screen.findByRole('alert')).textContent).toContain('Lecture indisponible')
  expect(screen.queryAllByRole('link')).toHaveLength(0)
})

it('preserves the draft but requires consent again when the calendar day changes', async () => {
  let currentContext = contextReply()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => response(url.includes('/context') ? currentContext : feed())))
  render(<WellbeingCheckin />)
  const minutes = screen.getByRole('spinbutton') as HTMLInputElement
  await waitFor(() => expect(minutes.value).toBe('20'))
  fireEvent.change(minutes, { target: { value: '9' } })
  fireEvent.click(checkinConsent())
  vi.setSystemTime(new Date('2026-11-11T10:00:00.000Z'))
  currentContext = contextReply(null, '2026-11-11')
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
  await waitFor(() => expect(screen.getByText(/Journée 2026-11-11/)).toBeTruthy())
  expect(minutes.value).toBe('9')
  expect(checkinConsent().checked).toBe(false)
  expect((screen.getByRole('button', { name: 'Enregistrer mes choix' }) as HTMLButtonElement).disabled).toBe(true)
})

it('keeps the check-in draft if a PUT response has no confirmed context', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => response(init?.method === 'PUT'
    ? { ok: true } : url.includes('/context') ? contextReply() : feed())))
  render(<WellbeingCheckin />)
  const minutes = screen.getByRole('spinbutton') as HTMLInputElement
  await waitFor(() => expect(minutes.value).toBe('20'))
  fireEvent.change(minutes, { target: { value: '9' } })
  fireEvent.click(checkinConsent())
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }))
  await screen.findByRole('alert')
  expect(minutes.value).toBe('9')
  expect(checkinConsent().checked).toBe(true)
  expect(screen.queryByText(/Tes choix du jour sont enregistrés/)).toBeNull()
})
