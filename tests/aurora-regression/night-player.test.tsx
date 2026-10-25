import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NightPlayer from '../../src/components/reprogrammation/NightPlayer'

const mocks = vi.hoisted(() => ({
  nature: { start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), setSound: vi.fn(), setVolume: vi.fn() },
  speak: vi.fn(),
  toast: { success: vi.fn() },
}))
vi.mock('@/lib/nature-sounds', () => ({ createNatureSoundEngine: () => mocks.nature }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../src/components/reprogrammation/nightPlayerHelpers', () => ({ speakAffirmation: mocks.speak }))
vi.mock('../../src/components/reprogrammation/useNightPlayerVolume', () => ({
  useNightPlayerVolume: () => ({ volumePct: 0.5, rampProgress: 0, rampRemainingSec: 1800 }),
}))
vi.mock('../../src/components/reprogrammation/NightPlayerRampProgress', () => ({ default: () => null }))
vi.mock('../../src/components/reprogrammation/NightPlayerSettings', () => ({
  default: ({ setVoiceEnabled }: { setVoiceEnabled: (enabled: boolean) => void }) => (
    <button type="button" onClick={() => setVoiceEnabled(true)}>Autoriser la voix de test</button>
  ),
}))

const affirmations = [
  { id: '00000000-0000-4000-8000-000000000001', text_fr: 'Je prends un moment calme.', text_en: null, source: 'purama' },
  { id: '00000000-0000-4000-8000-000000000002', text_fr: 'Je peux choisir de faire une pause.', text_en: null, source: 'purama' },
]
function response(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => response(
    String(url).endsWith('/start')
      ? { ok: true, session_id: '00000000-0000-4000-8000-000000000010', affirmations }
      : { ok: true },
  )))
})

async function start(withVoice = false) {
  if (withVoice) fireEvent.click(screen.getByRole('button', { name: 'Autoriser la voix de test' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session nuit' })))
}
async function tick() {
  await act(async () => vi.advanceTimersByTimeAsync(12_000))
}

describe('NightPlayer counters and voice scheduling', () => {
  it('renders the first unique count, then updates it without counting a loop twice', async () => {
    render(<NightPlayer />)
    await start()
    expect(screen.getByText('1 lue')).toBeTruthy()
    await tick()
    expect(screen.getByText('2 lues')).toBeTruthy()
    await tick()
    expect(screen.getByText('2 lues')).toBeTruthy()
    expect(screen.getByText('Affirmation 1 / 2')).toBeTruthy()
  })

  it('does not replay a voice cue when StrictMode checks state updaters', async () => {
    render(<StrictMode><NightPlayer /></StrictMode>)
    await start(true)
    expect(mocks.speak).toHaveBeenCalledTimes(1)
    await tick()
    expect(mocks.speak).toHaveBeenCalledTimes(2)
    expect(mocks.speak).toHaveBeenLastCalledWith(affirmations[1], true, 0.6)
    await tick()
    expect(mocks.speak).toHaveBeenCalledTimes(3)
  })

  it('stops further rotation when the user ends the session', async () => {
    render(<NightPlayer />)
    await start(true)
    await tick()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Terminer la session' })))
    const count = mocks.speak.mock.calls.length
    await tick()
    expect(mocks.speak).toHaveBeenCalledTimes(count)
    expect(mocks.nature.stop).toHaveBeenCalledOnce()
  })

  it('resets both the visible count and cursor for an explicitly restarted session', async () => {
    render(<NightPlayer />)
    await start()
    await tick()
    expect(screen.getByText('2 lues')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Terminer la session' })))
    await start()
    expect(screen.getByText('1 lue')).toBeTruthy()
    expect(screen.getByText('Affirmation 1 / 2')).toBeTruthy()
  })

  it('releases rotation on unmount without producing additional cues', async () => {
    const view = render(<StrictMode><NightPlayer /></StrictMode>)
    await start(true)
    view.unmount()
    const count = mocks.speak.mock.calls.length
    await tick()
    expect(mocks.speak).toHaveBeenCalledTimes(count)
    expect(vi.getTimerCount()).toBe(0)
  })
})
