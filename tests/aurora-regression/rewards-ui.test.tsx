import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MysteryChest from '../../src/components/mode18/MysteryChest'
import { RECOGNITION_FORMAT, type RecognitionOverview } from '../../src/lib/daily-recognition'

const recognition = {
  id: '11111111-1111-4111-8111-111111111111',
  recognition_date: '2026-11-10', recognized_at: '2026-11-10T12:00:00.000Z',
}
const empty: RecognitionOverview = {
  format: RECOGNITION_FORMAT, time_zone: 'UTC', today: '2026-11-10',
  recognition: null, recognitions: [], legacy_rewards: [],
}
const recorded = { ...empty, recognition, recognitions: [recognition] }
const acknowledgement = {
  ok: true, format: RECOGNITION_FORMAT, time_zone: 'UTC', recognition,
  already_recorded: false, already_claimed: false, reward: null, financial_value: false,
}
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

function deferredResponse() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(r => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'))
})

describe('free recognition screen', () => {
  it('accepts rest and no activity, with no balance or random reward promise', async () => {
    const fetchMock = vi.fn(async () => response(acknowledgement))
    vi.stubGlobal('fetch', fetchMock)
    render(<MysteryChest initialOverview={empty} />)
    expect(screen.getByText(/Une pratique, du repos ou une journée sans activité/)).toBeTruthy()
    expect(screen.getByText(/gratuite, sans valeur financière/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reconnaître ma journée' })))
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Journée enregistrée' })).toBeTruthy()
    expect(within(screen.getByTestId('daily-recognition-history')).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText(/JACKPOT|streak|multiplicateur|Révélation en cours/)).toBeNull()
  })

  it('submits only once for rapid repeated clicks', async () => {
    const pending = deferredResponse()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<MysteryChest initialOverview={empty} />)
    const button = screen.getByRole('button', { name: 'Reconnaître ma journée' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => pending.resolve(response(acknowledgement)))
    expect(within(screen.getByTestId('daily-recognition-history')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('keeps a failed write visible and offers a retry without claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'Enregistrement indisponible.' }, 503)))
    render(<MysteryChest initialOverview={empty} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reconnaître ma journée' })))
    expect(screen.getByRole('alert').textContent).toContain('indisponible')
    expect(screen.queryByRole('button', { name: 'Journée enregistrée' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Reconnaître ma journée' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('rejects an old financial-shaped response instead of inventing a daily acknowledgement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ reward: { reward_type: 'points', reward_amount: 5000 } })))
    render(<MysteryChest initialOverview={empty} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reconnaître ma journée' })))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Journée enregistrée' })).toBeNull()
    expect(screen.queryByText('5000')).toBeNull()
  })

  it('does not describe an unavailable history as empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(acknowledgement)))
    render(<MysteryChest initialOverview={null} initialError="Historique indisponible." />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reconnaître ma journée' })))
    expect(screen.getByText(/L’historique n’a pas encore pu être chargé/)).toBeTruthy()
    expect(screen.queryByText('Aucune journée enregistrée pour le moment.')).toBeNull()
  })

  it('refreshes a day recorded in another tab using a read only request', async () => {
    const fetchMock = vi.fn(async () => response({ ok: true, ...recorded }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MysteryChest initialOverview={empty} />)
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(fetchMock).toHaveBeenCalledWith('/api/mystery-rewards/history', expect.objectContaining({ method: 'GET' }))
    expect(screen.getByRole('button', { name: 'Journée enregistrée' })).toBeTruthy()
  })

  it('refreshes at the UTC boundary and retains the previous day without a streak reset', async () => {
    vi.setSystemTime(new Date('2026-11-10T23:59:59.500Z'))
    vi.stubGlobal('fetch', vi.fn(async () => response({
      ok: true, ...empty, today: '2026-11-11', recognitions: [recognition],
    })))
    render(<MysteryChest initialOverview={recorded} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect((screen.getByRole('button', { name: 'Reconnaître ma journée' }) as HTMLButtonElement).disabled).toBe(false)
    expect(within(screen.getByTestId('daily-recognition-history')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows historical quantities without claiming delivery or promoting their rarity', () => {
    render(<MysteryChest initialOverview={{ ...empty, legacy_rewards: [{
      id: 'legacy', claim_date: '2026-10-01', tier: 'jackpot', reward_type: 'points',
      reward_amount: 5000, streak_day: 30, claimed_at: '2026-10-01T12:00:00Z', delivery_status: 'unknown',
    }] }} />)
    expect(screen.getByText('Valeur enregistrée : 5000')).toBeTruthy()
    expect(screen.getByText('Délivrance non vérifiée')).toBeTruthy()
    expect(screen.queryByText(/JACKPOT|streak|multiplicateur/)).toBeNull()
  })

  it('cleans up timers and ignores a response after unmount', async () => {
    const pending = deferredResponse()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<MysteryChest initialOverview={empty} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reconnaître ma journée' }))
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    view.unmount()
    expect(init.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => pending.resolve(response(acknowledgement)))
    window.dispatchEvent(new Event('focus'))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
