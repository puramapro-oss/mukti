/** DOM integration of the existing micro-meditation; the outer frame and preference hook are explicit doubles. */
import { StrictMode, useState, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Mode3MicroMeditation from '../../src/components/modes/Mode3MicroMeditation'

const mocks = vi.hoisted(() => ({ completed: vi.fn(), reduced: false }))
vi.mock('../../src/components/modes/ModeFrame', () => ({
  default: function Frame({ children }: { children: (ctx: { onCompleted: (outcome?: string) => void }) => ReactNode }) {
    const [active, setActive] = useState(false)
    return active ? children({ onCompleted: (outcome) => { mocks.completed(outcome); setActive(false) } })
      : <button type="button" onClick={() => setActive(true)}>Commencer l’activité</button>
  },
}))
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mocks.reduced }))

let now = 0
let visibility: DocumentVisibilityState = 'visible'
function advance(milliseconds: number) {
  now += milliseconds
  act(() => vi.advanceTimersByTime(milliseconds))
}
function open(affirmation: string | null = null, strict = false) {
  const component = <Mode3MicroMeditation addictionId="addiction-example" affirmation={affirmation} />
  const view = render(strict ? <StrictMode>{component}</StrictMode> : component)
  fireEvent.click(screen.getByRole('button', { name: 'Commencer l’activité' }))
  return view
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  now = 0
  visibility = 'visible'
  mocks.reduced = false
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})

describe('micro-meditation — lifecycle and accessible guidance', () => {
  it('starts only after the outer frame action and defaults to free breathing', () => {
    render(<Mode3MicroMeditation addictionId="addiction-example" affirmation={null} />)
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Commencer l’activité' }))
    expect(screen.getByText('Respire librement, à ton rythme')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('30 s restantes')
    expect(screen.queryByText(/Retiens|guéri|miracle/i)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('finishes at 30 active seconds, once, even under React StrictMode and a wall-clock change', () => {
    open(null, true)
    vi.spyOn(Date, 'now').mockReturnValue(1)
    advance(29000)
    expect(screen.getByRole('timer').textContent).toBe('1 s restantes')
    expect(mocks.completed).not.toHaveBeenCalled()
    advance(1000)
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('completed')
    advance(30000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not reset the session clock when the affirmation or callback changes', () => {
    const view = open('Un premier texte')
    advance(10000)
    view.rerender(<Mode3MicroMeditation addictionId="addiction-example" affirmation="Un autre texte" />)
    expect(screen.getByText('« Un autre texte »')).toBeTruthy()
    advance(20000)
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('completed')
  })

  it('renders an affirmation as text rather than executable markup', () => {
    open('<img src=x onerror=alert(1)>')
    expect(screen.getByText('« <img src=x onerror=alert(1)> »')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('makes guidance optional and honors reduced motion while keeping phase text', () => {
    mocks.reduced = true
    open()
    const control = screen.getByRole('checkbox', { name: 'Guidage respiratoire doux, sans rétention' })
    fireEvent.click(control)
    expect(screen.getByText('Inspire sans forcer')).toBeTruthy()
    advance(3000)
    expect(screen.getByText('Expire sans forcer')).toBeTruthy()
    const visual = screen.getByTestId('micro-meditation-breath')
    expect(visual.style.transform).toBe('none')
    expect(visual.style.transition).toBe('none')
    fireEvent.click(control)
    expect(screen.getByText('Respire librement, à ton rythme')).toBeTruthy()
  })

  it('interrupts when hidden and never completes after visibility returns', () => {
    open()
    advance(5000)
    visibility = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    advance(30000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('interrupts on pagehide and ignores later completion ticks', () => {
    open()
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    advance(30000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
  })

  it('does not report completion after unmount', () => {
    const view = open()
    advance(29000)
    view.unmount()
    advance(10000)
    expect(mocks.completed).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('records the stop button as interrupted', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la séance' }))
    expect(mocks.completed).toHaveBeenCalledExactlyOnceWith('interrupted')
    advance(30000)
    expect(mocks.completed).toHaveBeenCalledTimes(1)
  })
})
