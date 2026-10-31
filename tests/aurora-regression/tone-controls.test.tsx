import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToneControls from '../../src/components/signals/ToneControls'
import ToneStation from '../../src/components/signals/ToneStation'
import ContinuousSoundMode from '../../src/components/cercles/room/modes/ContinuousSoundMode'
import type { ToneProgram } from '../../src/lib/tone-program'

const mocks = vi.hoisted(() => ({ players: [] as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; notify: (status: 'idle' | 'starting' | 'playing' | 'error', error?: string) => void }[] }))
vi.mock('@/lib/pure-tone-player', () => ({
  TONE_INITIAL_GAIN: 0.04, TONE_MAX_GAIN: 0.12,
  createPureTonePlayer: (notify: (status: 'idle' | 'starting' | 'playing' | 'error', error?: string) => void) => {
    const player = { start: vi.fn(async () => { notify('playing'); return true }), stop: vi.fn(() => notify('idle')), setVolume: vi.fn(), dispose: vi.fn(), notify }
    mocks.players.push(player); return player
  },
}))
const program: ToneProgram = { version: 1, hz: 432, seconds: 60 }
const current = () => mocks.players[mocks.players.length - 1]

beforeEach(() => {
  vi.clearAllMocks(); mocks.players.length = 0
  window.history.replaceState(null, '', '/frequences')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => undefined) } })
})

describe('shared tone UI consent and isolation', () => {
  it('mounts silently even under StrictMode', () => {
    render(<StrictMode><ToneControls program={program} /></StrictMode>)
    expect(mocks.players.every(player => player.start.mock.calls.length === 0)).toBe(true)
    expect(screen.getByRole('button', { name: 'Écouter la tonalité' })).toBeTruthy()
  })
  it('starts only by explicit click with the selected data, then stops', async () => {
    render(<ToneControls program={program} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Écouter la tonalité' })))
    expect(current().start).toHaveBeenCalledExactlyOnceWith(program)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la tonalité' }))
    expect(current().stop).toHaveBeenCalledOnce()
  })
  it('offers cancellation while startup is pending', () => {
    render(<ToneControls program={program} />)
    act(() => current().notify('starting'))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le démarrage' }))
    expect(current().stop).toHaveBeenCalledOnce()
  })
  it('changes only local volume', () => {
    render(<ToneControls program={program} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.1' } })
    expect(current().setVolume).toHaveBeenLastCalledWith(0.1)
    expect(current().start).not.toHaveBeenCalled()
  })
  it('displays a blocked audio error rather than claiming playback', () => {
    render(<ToneControls program={program} />)
    act(() => current().notify('error', 'Audio bloqué'))
    expect(screen.getByRole('alert').textContent).toBe('Audio bloqué')
    expect(screen.getByRole('button', { name: 'Écouter la tonalité' })).toBeTruthy()
  })
  it('stops on backgrounding and does not restart when visible again', () => {
    render(<ToneControls program={program} />)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    hidden.mockReturnValue(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(current().stop).toHaveBeenCalledOnce(); expect(current().start).not.toHaveBeenCalled()
  })
  it('stops on pagehide and disposes on unmount', () => {
    const view = render(<ToneControls program={program} />)
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(current().stop).toHaveBeenCalledOnce()
    view.unmount(); expect(current().dispose).toHaveBeenCalledOnce()
  })
  it('loads a shared parameter link without starting audio', () => {
    window.history.replaceState(null, '', '/frequences#v=1&hz=639&seconds=180')
    render(<ToneStation />)
    expect((screen.getByLabelText('Tonalité') as HTMLSelectElement).value).toBe('639')
    expect((screen.getByLabelText('Durée') as HTMLSelectElement).value).toBe('180')
    expect(current().start).not.toHaveBeenCalled()
  })
  it('refuses a link carrying a volume command without creating any player', () => {
    window.history.replaceState(null, '', '/frequences#v=1&hz=432&seconds=60&volume=1')
    render(<ToneStation />)
    expect(screen.getByRole('alert')).toBeTruthy(); expect(mocks.players.length).toBe(0)
  })
  it('shares only the version, frequency and duration, not volume or private data', async () => {
    render(<ToneStation />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.1' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Partager ces paramètres' })))
    const link = new URL((screen.getByLabelText('Lien de partage') as HTMLInputElement).value)
    expect(link.pathname).toBe('/frequences'); expect(link.hash).toBe('#v=1&hz=432&seconds=60'); expect(link.search).toBe('')
    expect(current().start).not.toHaveBeenCalled()
  })
  it('retains a visible copyable link if clipboard permission fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'))
    render(<ToneStation />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Partager ces paramètres' })))
    expect(screen.getByLabelText('Lien de partage')).toBeTruthy()
    expect(screen.queryByText('Lien copié.')).toBeNull()
  })
  it('changing tone disposes the old player and requires a new explicit start', () => {
    render(<ToneStation />); const previous = current()
    fireEvent.change(screen.getByLabelText('Tonalité'), { target: { value: '528' } })
    expect(previous.dispose).toHaveBeenCalledOnce(); expect(current().start).not.toHaveBeenCalled()
  })
  it('hash navigation stops the old program without starting the replacement', () => {
    render(<ToneStation />); const previous = current()
    act(() => { window.history.replaceState(null, '', '/frequences#v=1&hz=741&seconds=300'); window.dispatchEvent(new Event('hashchange')) })
    expect(previous.dispose).toHaveBeenCalledOnce(); expect(current().start).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Tonalité') as HTMLSelectElement).value).toBe('741')
  })
  it('existing circle themes reuse the same player and stop on category changes', async () => {
    const view = render(<ContinuousSoundMode category="paix" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Écouter la tonalité' })))
    const previous = current(); expect(previous.start).toHaveBeenCalledExactlyOnceWith({ version: 1, hz: 432, seconds: 600 })
    view.rerender(<ContinuousSoundMode category="clarte" />)
    expect(previous.dispose).toHaveBeenCalledOnce(); expect(current().start).not.toHaveBeenCalled()
  })
})
