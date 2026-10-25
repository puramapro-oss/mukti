import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NightPlayer from '../../src/components/reprogrammation/NightPlayer'
import { mockAnimationClock } from './clock'

// Real component, request adapter, session hook, volume clock and ramp calculation.
// Network responses and physical audio output are deliberately simulated.
const mocks = vi.hoisted(() => ({
  nature: { start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), setSound: vi.fn(), setVolume: vi.fn() },
  speak: vi.fn(),
  toast: { success: vi.fn() },
}))
vi.mock('@/lib/nature-sounds', () => ({ createNatureSoundEngine: () => mocks.nature }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../src/components/reprogrammation/nightPlayerHelpers', () => ({ speakAffirmation: mocks.speak }))
vi.mock('../../src/components/reprogrammation/NightPlayerSettings', () => ({
  default: ({ setRampEnabled }: { setRampEnabled: (enabled: boolean) => void }) => (
    <button type="button" onClick={() => setRampEnabled(false)}>Volume fixe de test</button>
  ),
}))

const valid = {
  ok: true,
  session_id: '00000000-0000-4000-8000-000000000010',
  affirmations: [{ id: 'custom-00000000-0000-4000-8000-000000000001', text_fr: 'Je choisis une pause.', text_en: null, source: 'user' }],
}
function response(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
}
async function start() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Démarrer la session nuit' })))
}
async function stop() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Terminer la session' })))
}
function endCalls() {
  return vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/end'))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => response(String(url).endsWith('/start') ? valid : { ok: true })))
})

describe('NightPlayer with its real clock', () => {
  it('ramps down then stops and saves exactly once at the existing 30-minute deadline', async () => {
    const clock = mockAnimationClock()
    render(<StrictMode><NightPlayer /></StrictMode>)
    await start()
    clock.frame(0)
    expect(mocks.nature.setVolume).toHaveBeenLastCalledWith(0.55)
    clock.frame(900_000)
    expect(mocks.nature.setVolume.mock.lastCall?.[0]).toBeCloseTo(0.275)
    await act(async () => clock.frame(1_800_000))
    expect(mocks.nature.setVolume).toHaveBeenLastCalledWith(0)
    expect(mocks.nature.stop).toHaveBeenCalledTimes(1)
    expect(endCalls()).toHaveLength(1)
    expect(JSON.parse(String(endCalls()[0][1]?.body))).toEqual({
      session_id: valid.session_id,
      affirmations_played: ['00000000-0000-4000-8000-000000000001'],
    })
    clock.frame(2_000_000)
    expect(endCalls()).toHaveLength(1)
    expect(clock.frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the fixed-volume option running until the user explicitly stops', async () => {
    const clock = mockAnimationClock()
    render(<NightPlayer />)
    fireEvent.click(screen.getByRole('button', { name: 'Volume fixe de test' }))
    await start()
    clock.frame(1_800_000)
    expect(mocks.nature.setVolume).toHaveBeenLastCalledWith(0.45)
    expect(endCalls()).toHaveLength(0)
    await stop()
    expect(endCalls()).toHaveLength(1)
    expect(clock.frames.size).toBe(0)
  })

  it('a completed clock cannot immediately finish an explicitly restarted session', async () => {
    const clock = mockAnimationClock()
    render(<NightPlayer />)
    await start()
    await act(async () => clock.frame(1_800_000))
    expect(endCalls()).toHaveLength(1)
    await start()
    clock.frame(1_800_001)
    expect(endCalls()).toHaveLength(1)
    expect(mocks.nature.setVolume.mock.lastCall?.[0]).toBeGreaterThan(0.54)
    expect(screen.getByRole('button', { name: 'Terminer la session' })).toBeTruthy()
    await stop()
    expect(endCalls()).toHaveLength(2)
  })

  it('unmount invalidates a captured clock callback before it can change output or save', async () => {
    const clock = mockAnimationClock()
    const view = render(<NightPlayer />)
    await start()
    const pending = [...clock.frames.values()]
    view.unmount()
    const volumeCalls = mocks.nature.setVolume.mock.calls.length
    clock.set(1_800_000)
    await act(async () => pending.forEach(callback => callback(1_800_000)))
    expect(mocks.nature.setVolume).toHaveBeenCalledTimes(volumeCalls)
    expect(endCalls()).toHaveLength(0)
    expect(clock.frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
