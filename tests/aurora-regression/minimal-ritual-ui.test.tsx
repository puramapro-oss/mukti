import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import MinimalHabitsList from '../../src/components/mode19/MinimalHabitsList'
import { MINIMAL_RITUAL_HABITS } from '../../src/lib/constants/core-events'
import { localDay } from '../../src/lib/wellbeing-date'
import type { HabitStatus } from '../../src/lib/minimal-ritual'

const notices = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notices }))

const slug = 'respiration_consciente'
const day = localDay(new Date(), 'Europe/Paris')
const initialRows = (): HabitStatus[] => MINIMAL_RITUAL_HABITS.map(habit => ({
  slug: habit.slug, recorded_today: false, ticked_today: false, participation_mode: null,
  streak_days: 0, progress_days: 0, practice_days: 0, rest_days: 0,
}))
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
})
const snapshot = (habits: HabitStatus[]) => ({ day, time_zone: 'Europe/Paris', habits })

beforeEach(() => {
  vi.clearAllMocks()
})

it('keeps an unsuccessful write unrecorded, including a server error', async () => {
  const rows = initialRows()
  rows[0] = { ...rows[0]!, progress_days: 7, practice_days: 6, rest_days: 1 }
  vi.stubGlobal('fetch', vi.fn(async () => response({ recorded: false, ticked: false, already: false, error: 'Enregistrement non confirmé.' }, 503)))
  render(<MinimalHabitsList initialStatus={rows} initialDay={day} />)
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.error).toHaveBeenCalledWith('Enregistrement non confirmé.'))
  expect(notices.success).not.toHaveBeenCalled()
  expect(screen.getByTestId('minimal-progress-' + slug).textContent).toContain('7 jours reconnus')
  expect((screen.getByTestId('minimal-habit-' + slug) as HTMLButtonElement).disabled).toBe(false)
})

it('uses the persisted summary for an idempotent retry instead of incrementing local progress', async () => {
  const rows = initialRows()
  rows[0] = { ...rows[0]!, progress_days: 7, practice_days: 6, rest_days: 1 }
  const saved = rows.map(row => row.slug === slug
    ? { ...row, recorded_today: true, ticked_today: true, participation_mode: 'standard' as const } : row)
  vi.stubGlobal('fetch', vi.fn(async () => response({
    recorded: true, ticked: true, already: true, participation_mode: 'standard', ...snapshot(saved),
  })))
  render(<MinimalHabitsList initialStatus={rows} initialDay={day} />)
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.success).toHaveBeenCalled())
  expect(screen.getByTestId('minimal-progress-' + slug).textContent).toContain('7 jours reconnus')
  expect(screen.queryByTestId('minimal-habit-' + slug)).toBeNull()
  expect(screen.getByRole('status').textContent).toContain('déjà enregistré')
})

it('records a chosen rest without reporting any completed exercise', async () => {
  const rows = initialRows()
  const saved = rows.map(row => row.slug === slug
    ? { ...row, recorded_today: true, ticked_today: false, participation_mode: 'rest' as const, progress_days: 1, rest_days: 1 } : row)
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({
    recorded: true, ticked: false, already: false, participation_mode: 'rest', ...snapshot(saved),
  }))
  vi.stubGlobal('fetch', request)
  render(<MinimalHabitsList initialStatus={rows} initialDay={day} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Repos — 1 respiration consciente' }))
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.success).toHaveBeenCalled())
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({
    habit_slug: slug, participation_mode: 'rest',
  })
  expect(screen.getByText(/Aujourd’hui : 0 geste déclaré/).textContent).toContain('1 choix de repos')
  expect(within(screen.getByTestId('minimal-card-' + slug)).getByText('Repos enregistré')).toBeTruthy()
  expect(screen.queryByText('Geste déclaré')).toBeNull()
})

it('provides an adapted option and submits it as a distinct mode', async () => {
  const rows = initialRows()
  const saved = rows.map(row => row.slug === slug
    ? { ...row, recorded_today: true, ticked_today: true, participation_mode: 'adapted' as const, progress_days: 1, practice_days: 1 } : row)
  const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response({
    recorded: true, ticked: true, already: false, participation_mode: 'adapted', ...snapshot(saved),
  }))
  vi.stubGlobal('fetch', request)
  render(<MinimalHabitsList initialStatus={rows} initialDay={day} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Version adaptée — 1 respiration consciente' }))
  expect(screen.getByText(/Observe simplement une respiration naturelle/)).toBeTruthy()
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.success).toHaveBeenCalled())
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string).participation_mode).toBe('adapted')
  expect(screen.getByText('Geste adapté déclaré')).toBeTruthy()
})

it('does not accept a 200 response that lacks a trustworthy participation receipt', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({ ticked: true, already: true })))
  render(<MinimalHabitsList initialStatus={initialRows()} initialDay={day} />)
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.error).toHaveBeenCalled())
  expect(notices.success).not.toHaveBeenCalled()
  expect(screen.getByTestId('minimal-habit-' + slug)).toBeTruthy()
})

it('does not disguise a failed initial read as eight unticked choices', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response(snapshot(initialRows()))))
  render(<MinimalHabitsList initialStatus={[]} initialDay={day} initialError="Lecture indisponible." />)
  expect(screen.getByRole('alert').textContent).toBe('Lecture indisponible.')
  expect(screen.queryByTestId('minimal-habit-' + slug)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer la lecture' }))
  await waitFor(() => expect(screen.getByTestId('minimal-habit-' + slug)).toBeTruthy())
  expect(screen.queryByRole('alert')).toBeNull()
})

it('distinguishes a confirmed write from an unavailable updated summary', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({
    recorded: true, ticked: false, already: false, participation_mode: 'rest',
    day, time_zone: 'Europe/Paris',
    status_warning: 'Ton choix est enregistré. Le récapitulatif est momentanément indisponible.',
  })))
  render(<MinimalHabitsList initialStatus={initialRows()} initialDay={day} />)
  fireEvent.click(screen.getByRole('radio', { name: 'Repos — 1 respiration consciente' }))
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  await waitFor(() => expect(notices.success).toHaveBeenCalled())
  expect(screen.getByRole('alert').textContent).toContain('récapitulatif est momentanément indisponible')
  expect(screen.getByRole('status').textContent).toContain('Aucun exercice')
  expect(screen.queryByText(/Aujourd’hui :/)).toBeNull()
})

it('blocks concurrent clicks while a participation is being saved', async () => {
  let resolve!: (value: Response) => void
  const request = vi.fn(() => new Promise<Response>(done => { resolve = done }))
  vi.stubGlobal('fetch', request)
  render(<MinimalHabitsList initialStatus={initialRows()} initialDay={day} />)
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  fireEvent.click(screen.getByTestId('minimal-habit-' + slug))
  fireEvent.click(screen.getByTestId('minimal-habit-merci_corps'))
  expect(request).toHaveBeenCalledTimes(1)
  resolve(response({ error: 'Enregistrement non confirmé.' }, 503))
  await waitFor(() => expect(notices.error).toHaveBeenCalled())
})
