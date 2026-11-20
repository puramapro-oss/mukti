/** DOM integration of the existing mode. Frame, audio output and preferences are explicit test doubles. */
import { StrictMode, useState, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Mode2MultisensorielUltime from '../../src/components/modes/Mode2MultisensorielUltime'

const mocks = vi.hoisted(() => {
  const audio = {
    prepare: vi.fn(async () => {}), start: vi.fn(async () => {}), stop: vi.fn(), dispose: vi.fn(),
    setPhase: vi.fn(), setEnabled: vi.fn(), setVoiceGuidance: vi.fn(), speakPhaseCue: vi.fn(),
    setRitualMix: vi.fn(), setPosition: vi.fn(), getCapabilities: vi.fn(() => ({ audio: true, voice: false })),
  }
  return {
    audio, createAudio: vi.fn(() => audio), completed: vi.fn(), vibrate: vi.fn(() => true),
    rawVibrate: vi.fn(() => true), reduced: false,
    prefs: { silentMode: false, hapticEnabled: true }, synchronousSilent: false,
  }
})

vi.mock('../../src/components/modes/ModeFrame', () => ({
  default: function Frame({ children }: { children: (ctx: { onCompleted: (outcome?: string) => void }) => ReactNode }) {
    const [active, setActive] = useState(false)
    return active ? children({ onCompleted: (outcome) => { mocks.completed(outcome); setActive(false) } })
      : <button type="button" onClick={() => setActive(true)}>Commencer l’activité</button>
  },
}))
vi.mock('@/lib/aurora-audio', () => ({ createAuroraAudio: mocks.createAudio }))
vi.mock('@/hooks/useAccessibilityPrefs', () => ({ useAccessibilityPrefs: () => ({ prefs: mocks.prefs }) }))
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mocks.reduced }))
vi.mock('@/lib/accessibility', () => ({
  loadA11yPrefs: () => ({ ...mocks.prefs, silentMode: mocks.prefs.silentMode || mocks.synchronousSilent }),
  safeVibrate: mocks.vibrate,
}))

let now = 0
let visibility: DocumentVisibilityState = 'visible'
function advance(milliseconds: number) {
  now += milliseconds
  act(() => vi.advanceTimersByTime(milliseconds))
}
function hide() {
  visibility = 'hidden'
  act(() => document.dispatchEvent(new Event('visibilitychange')))
}
function open(strict = false) {
  const element = <Mode2MultisensorielUltime addictionId="addiction-example" />
  const view = render(strict ? <StrictMode>{element}</StrictMode> : element)
  fireEvent.click(screen.getByRole('button', { name: 'Commencer l’activité' }))
  return view
}
async function startAudio() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Activer le son 432 Hz' })) })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  now = 0
  visibility = 'visible'
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: mocks.rawVibrate })
  mocks.prefs.silentMode = false
  mocks.prefs.hapticEnabled = true
  mocks.synchronousSilent = false
  mocks.reduced = false
  mocks.audio.start.mockReset().mockResolvedValue(undefined)
  mocks.audio.stop.mockReset()
  mocks.audio.dispose.mockReset()
  mocks.audio.getCapabilities.mockReset().mockReturnValue({ audio: true, voice: false })
  mocks.createAudio.mockReset().mockReturnValue(mocks.audio)
  mocks.vibrate.mockReset().mockReturnValue(true)
})

describe('multisensory mode — explicit outputs and truthful completion', () => {
  it('keeps the entry and the active default silent, with free breathing and no haptic output', () => {
    render(<Mode2MultisensorielUltime addictionId="addiction-example" />)
    expect(vi.getTimerCount()).toBe(0)
    expect(mocks.createAudio).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Commencer l’activité' }))
    expect(screen.getByText('Respire librement, à ton rythme')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('3:00')
    advance(5000)
    expect(screen.getByRole('timer').textContent).toBe('2:55')
    expect(mocks.createAudio).not.toHaveBeenCalled()
    expect(mocks.vibrate).not.toHaveBeenCalled()
    expect(screen.queryByText(/Retiens|miracle/i)).toBeNull()
  })

  it('uses the existing no-hold AURORA rhythm only after choosing guidance', () => {
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }))
    expect(screen.getByText('Inspire sans forcer')).toBeTruthy()
    advance(4000)
    expect(screen.getByText('Expire sans forcer')).toBeTruthy()
    advance(6000)
    expect(screen.getByText('Inspire sans forcer')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }))
    expect(screen.getByText('Respire librement, à ton rythme')).toBeTruthy()
    expect(screen.queryByText(/Retiens/)).toBeNull()
    expect(mocks.vibrate).not.toHaveBeenCalled()
  })

  it('completes once from monotonic elapsed time without reporting resistance to a craving', () => {
    open(true)
    vi.spyOn(Date, 'now').mockReturnValue(9_000_000_000_000)
    advance(179000)
    expect(screen.getByRole('timer').textContent).toBe('0:01')
    expect(mocks.completed).not.toHaveBeenCalled()
    advance(1000)
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('completed')
    advance(600000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not restart the timer when the parent renders again', () => {
    const view = open()
    advance(60000)
    view.rerender(<Mode2MultisensorielUltime addictionId="addiction-example" />)
    advance(120000)
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('completed')
  })

  it('uses AURORA tone-only output after a click, without requesting speech or music', async () => {
    open()
    await startAudio()
    expect(mocks.createAudio).toHaveBeenCalledExactlyOnceWith({ masterGain: 0.2 })
    expect(mocks.audio.setRitualMix).toHaveBeenCalledWith({ voice: 0, music: 0, tone: 0.25 })
    expect(mocks.audio.setVoiceGuidance).toHaveBeenCalledWith(false)
    expect(mocks.audio.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Couper le son' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Couper le son' }))
    expect(mocks.audio.stop).toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Activer le son 432 Hz' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('checks the synchronous silent preference before creating an audio context', async () => {
    open()
    mocks.synchronousSilent = true
    await startAudio()
    expect(mocks.createAudio).not.toHaveBeenCalled()
    expect(screen.getByRole('timer')).toBeTruthy()
  })

  it('stops active audio when silent mode changes and requires another click after it is disabled', async () => {
    const view = open()
    await startAudio()
    mocks.prefs.silentMode = true
    view.rerender(<Mode2MultisensorielUltime addictionId="addiction-example" />)
    expect(mocks.audio.stop).toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Activer le son 432 Hz' }) as HTMLButtonElement).disabled).toBe(true)
    mocks.prefs.silentMode = false
    view.rerender(<Mode2MultisensorielUltime addictionId="addiction-example" />)
    expect(mocks.audio.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Activer le son 432 Hz' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('cancels an unresolved start and ignores its later completion', async () => {
    let resolve!: () => void
    mocks.audio.start.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    open()
    await startAudio()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le démarrage du son' }))
    expect(mocks.audio.stop).toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    await act(async () => { resolve() })
    expect(screen.queryByRole('button', { name: 'Couper le son' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Activer le son 432 Hz' })).toBeTruthy()
  })

  it('rechecks silent mode after an asynchronous start, without displaying a false playing state', async () => {
    let resolve!: () => void
    mocks.audio.start.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    open()
    await startAudio()
    mocks.synchronousSilent = true
    await act(async () => { resolve() })
    expect(mocks.audio.stop).toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Couper le son' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Annuler le démarrage du son' })).toBeNull()
  })

  it('keeps the text activity usable if Web Audio is unavailable', async () => {
    mocks.audio.getCapabilities.mockReturnValue({ audio: false, voice: false })
    open()
    await startAudio()
    expect(screen.getByText(/Le son n’est pas disponible ici/)).toBeTruthy()
    expect(mocks.audio.start).not.toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    advance(1000)
    expect(screen.getByRole('timer').textContent).toBe('2:59')
  })

  it('reports an audio start failure without falsely showing playback', async () => {
    mocks.audio.start.mockRejectedValue(new Error('browser denied audio'))
    open()
    await startAudio()
    expect(screen.getByRole('alert').textContent).toContain('Le son n’a pas démarré')
    expect(screen.queryByRole('button', { name: 'Couper le son' })).toBeNull()
    expect(mocks.audio.dispose).toHaveBeenCalled()
  })

  it('interrupts immediately when hidden and cannot resume by becoming visible', async () => {
    open()
    await startAudio()
    advance(8000)
    hide()
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    expect(mocks.audio.stop).toHaveBeenCalled()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    advance(180000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
    expect(mocks.audio.start).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('interrupts on pagehide while start is pending and disposes after the late resolution', async () => {
    let resolve!: () => void
    mocks.audio.start.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    open()
    await startAudio()
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    await act(async () => { resolve() })
    expect(mocks.audio.dispose).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Couper le son' })).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up on unmount, even when stopping the audio handle throws', async () => {
    const view = open()
    await startAudio()
    mocks.audio.stop.mockImplementation(() => { throw new Error('stop failure') })
    expect(() => view.unmount()).not.toThrow()
    expect(mocks.audio.dispose).toHaveBeenCalled()
    expect(mocks.rawVibrate).toHaveBeenCalledWith(0)
    advance(180000)
    expect(mocks.completed).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the guided visual static when reduced motion is requested', () => {
    mocks.reduced = true
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }))
    advance(2000)
    const visual = screen.getByTestId('multisensoriel-breath')
    expect(visual.style.transform).toBe('none')
    expect(visual.style.transition).toBe('none')
    expect(screen.getByText('Inspire sans forcer')).toBeTruthy()
  })

  it('requires an explicit haptic choice and cancels it when the preference is revoked', () => {
    const view = open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }))
    expect(mocks.vibrate).not.toHaveBeenCalled()
    const checkbox = screen.getByRole('checkbox', { name: 'Vibrations pendant le guidage' }) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(mocks.vibrate).toHaveBeenCalledExactlyOnceWith(60)
    advance(4000)
    expect(mocks.vibrate).toHaveBeenCalledTimes(2)
    mocks.prefs.hapticEnabled = false
    view.rerender(<Mode2MultisensorielUltime addictionId="addiction-example" />)
    expect(checkbox.checked).toBe(false)
    expect(checkbox.disabled).toBe(true)
    expect(mocks.rawVibrate).toHaveBeenCalledWith(0)
    advance(6000)
    expect(mocks.vibrate).toHaveBeenCalledTimes(2)
  })

  it('does not claim haptic support when the browser refuses the output', () => {
    mocks.vibrate.mockReturnValue(false)
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' }))
    const checkbox = screen.getByRole('checkbox', { name: 'Vibrations pendant le guidage' }) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    expect(checkbox.disabled).toBe(true)
    expect(screen.getByText('Vibrations indisponibles dans ce navigateur.')).toBeTruthy()
  })

  it('records an explicit early stop as interrupted, not completed', () => {
    open()
    advance(3000)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la séance' }))
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    advance(180000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
  })
})
