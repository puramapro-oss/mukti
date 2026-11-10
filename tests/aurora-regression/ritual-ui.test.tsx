/** DOM integration checks in jsdom; these do not exercise a real browser or audio device. */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuroraSessionFull from '../../src/components/aurora/AuroraSessionFull'
import type { AuroraVariant } from '../../src/lib/constants/aurora'
import { mockAnimationClock } from './clock'

const mocks = vi.hoisted(() => {
  const audio = {
    prepare: vi.fn(async () => {}), start: vi.fn(async () => {}), stop: vi.fn(),
    dispose: vi.fn(), setPhase: vi.fn(), setEnabled: vi.fn(), setVoiceGuidance: vi.fn(),
    speakPhaseCue: vi.fn(), setRitualMix: vi.fn(), setPosition: vi.fn(),
    getCapabilities: vi.fn(() => ({ audio: true, voice: true })),
  }
  return {
    audio,
    createAudio: vi.fn(() => audio),
    haptic: { pulse: vi.fn(), cancel: vi.fn(), setEnabled: vi.fn(), isSupported: () => true },
    fetch: vi.fn(() => { throw new Error('This ritual UI test must not make a network request') }),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
})

vi.mock('@/lib/aurora-audio', () => ({ createAuroraAudio: mocks.createAudio }))
vi.mock('@/lib/aurora-haptic', () => ({ createAuroraHaptic: () => mocks.haptic }))
vi.mock('sonner', () => ({ toast: mocks.toast }))
vi.mock('../../src/components/aurora/AuroraCanvas', () => ({ default: () => <div data-testid="canvas-placeholder" /> }))
vi.mock('../../src/components/aurora/PulseOfSafety', () => ({ default: () => <div data-testid="breath-placeholder" /> }))
vi.mock('../../src/components/aurora/ProgressRing5Phases', () => ({
  default: () => null, phaseLabelShort: (name: string) => name,
}))

const draft = {
  intention: 'Avancer sur mon projet',
  outcome: 'Un premier brouillon utile',
  obstacle: 'Je remets le début à plus tard',
  response: 'J’ouvre mon document',
  action: 'Écrire la première phrase',
  context: 'Demain matin, à mon bureau',
}
type Field = keyof typeof draft
const labels: Record<Field, RegExp> = {
  intention: /^Une intention qui compte pour toi/,
  outcome: /^Un résultat souhaité et observable/,
  obstacle: /^Un obstacle concret/,
  response: /^Si cet obstacle arrive/,
  action: /^Mon prochain petit pas/,
  context: /^Quand et où je prévois ce pas/,
}

function field(key: Field): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: labels[key] }) as HTMLTextAreaElement
}
function fill(values: typeof draft = draft) {
  for (const key of Object.keys(values) as Field[]) {
    fireEvent.change(field(key), { target: { value: values[key] } })
  }
}
function open(variant: AuroraVariant = 'focus') {
  const view = render(<AuroraSessionFull variant={variant} />)
  fireEvent.click(screen.getByRole('button', { name: /^Préparer un rituel/ }))
  return view
}
function prepare() {
  fireEvent.click(screen.getByRole('button', { name: 'Préparer le texte' }))
}
function confirmation(): HTMLInputElement {
  return screen.getByRole('checkbox', { name: /^J’ai relu ce texte/ }) as HTMLInputElement
}
function startButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Commencer mon rituel' }) as HTMLButtonElement
}
async function startTextOnly() {
  fireEvent.click(screen.getByRole('button', { name: 'Texte seul' }))
  fireEvent.click(confirmation())
  await act(async () => { fireEvent.click(startButton()) })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('AURORA ritual UI — simulated DOM integration', () => {
  it('requires review and confirmation, then starts text-only guidance without audio or an API call', async () => {
    const clock = mockAnimationClock()
    open()
    expect(screen.getByRole('heading', { name: 'De l’intention à l’action' })).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
    expect(startButton().disabled).toBe(true)
    fill()
    prepare()
    const preview = screen.getByRole('region', { name: '2. Vérifier ton texte' })
    expect(within(preview).getAllByRole('listitem')).toHaveLength(8)
    expect(preview.textContent).toContain(draft.intention)
    expect(preview.textContent).toContain(draft.action)
    expect(confirmation().checked).toBe(false)
    expect(startButton().disabled).toBe(true)
    fireEvent.click(startButton())
    expect(clock.frames.size).toBe(0)
    expect(mocks.fetch).not.toHaveBeenCalled()
    await startTextOnly()
    const heading = screen.getByRole('heading', { name: /^Étape 1 sur 8 · Installation/ })
    expect(document.activeElement).toBe(heading)
    const announced = heading.closest('[role="status"]')!
    expect(announced.getAttribute('aria-live')).toBe('polite')
    expect(announced.getAttribute('aria-atomic')).toBe('true')
    expect(announced.textContent).toContain('Respire naturellement')
    expect(screen.queryByTestId('canvas-placeholder')).toBeNull()
    expect(screen.queryByTestId('breath-placeholder')).toBeNull()
    expect(screen.getByRole('timer').textContent).toBe('0:00 / 4:08')
    clock.frame(1000)
    expect(screen.getByRole('timer').textContent).toBe('0:01 / 4:08')
    expect(mocks.createAudio).not.toHaveBeenCalled()
    expect(mocks.audio.speakPhaseCue).not.toHaveBeenCalled()
    expect(mocks.haptic.pulse).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('invalidates approval after field or duration changes, preserves the draft, and recovers from a short duration', async () => {
    mockAnimationClock()
    open()
    const values = {
      ...draft,
      response: 'J’ouvre mon document et j’écris quelques phrases simples, sans chercher la perfection, pour disposer d’un premier brouillon à améliorer ensuite.',
    }
    fill(values)
    prepare()
    fireEvent.click(confirmation())
    expect(startButton().disabled).toBe(false)
    fireEvent.change(field('intention'), { target: { value: 'Dessiner mon projet' } })
    expect(screen.queryByRole('region', { name: '2. Vérifier ton texte' })).toBeNull()
    expect(startButton().disabled).toBe(true)
    expect(field('action').value).toBe(values.action)
    expect(field('response').value).toBe(values.response)
    prepare()
    expect(confirmation().checked).toBe(false)
    fireEvent.click(confirmation())
    fireEvent.change(screen.getByRole('combobox', { name: 'Durée du rituel' }), { target: { value: 'ignite' } })
    expect(startButton().disabled).toBe(true)
    expect(screen.queryByRole('checkbox', { name: /^J’ai relu ce texte/ })).toBeNull()
    prepare()
    expect(screen.getByRole('alert').textContent).toContain('Texte trop long')
    expect(field('intention').value).toBe('Dessiner mon projet')
    for (const key of ['outcome', 'obstacle', 'response', 'action', 'context'] as Field[]) {
      expect(field(key).value).toBe(values[key])
    }
    fireEvent.change(screen.getByRole('combobox', { name: 'Durée du rituel' }), { target: { value: 'calm' } })
    expect(screen.queryByRole('alert')).toBeNull()
    prepare()
    expect(confirmation().checked).toBe(false)
    expect(startButton().disabled).toBe(true)
    await startTextOnly()
    expect(screen.getByRole('timer').textContent).toBe('0:00 / 7:48')
    expect((screen.getByRole('progressbar', { name: 'Avancement du rituel' }) as HTMLProgressElement).max).toBe(468)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('preserves the in-memory draft and settings across a return to breathing without preserving approval', () => {
    mockAnimationClock()
    open()
    fill()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ton approche' }), { target: { value: 'spirituel' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Durée du rituel' }), { target: { value: 'calm' } })
    prepare()
    fireEvent.click(confirmation())
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à la respiration' }))
    expect(screen.queryByRole('heading', { name: 'De l’intention à l’action' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Préparer un rituel/ }))
    for (const key of Object.keys(draft) as Field[]) expect(field(key).value).toBe(draft[key])
    expect((screen.getByRole('combobox', { name: 'Ton approche' }) as HTMLSelectElement).value).toBe('spirituel')
    expect((screen.getByRole('combobox', { name: 'Durée du rituel' }) as HTMLSelectElement).value).toBe('calm')
    expect(startButton().disabled).toBe(true)
    prepare()
    expect(confirmation().checked).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('shows a stopped ritual with an action still planned and no breathing score, level, or completion claim', async () => {
    const clock = mockAnimationClock()
    open()
    fill()
    prepare()
    await startTextOnly()
    clock.frame(5000)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter le rituel' }))
    expect(screen.getByRole('heading', { name: 'Parcours arrêté' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Ton action reste prévue' })).toBeTruthy()
    expect(screen.getByText(draft.action)).toBeTruthy()
    expect(screen.getByText(`Quand et où : ${draft.context}`)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Parcours terminé' })).toBeNull()
    expect(screen.queryByText(/Niveau|Streak|Régularité du guidage|cohérence/i)).toBeNull()
    expect(screen.queryByText(/Action accomplie|Objectif atteint/)).toBeNull()
    expect(clock.frames.size).toBe(0)
    clock.frame(300000)
    expect(screen.getByRole('timer').textContent).toBe('0:05 / 4:08')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.toast.success).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à AURORA' }))
    fireEvent.click(screen.getByRole('button', { name: /^Préparer un rituel/ }))
    expect(field('action').value).toBe(draft.action)
    expect(screen.queryByRole('heading', { name: 'Parcours arrêté' })).toBeNull()
    prepare()
    expect(confirmation().checked).toBe(false)
  })

  it('accepts 160 Unicode code points without native truncation and rejects 161 while retaining the text', () => {
    mockAnimationClock()
    open('sleep')
    fill()
    const intention = field('intention')
    expect(intention.hasAttribute('maxlength')).toBe(false)
    fireEvent.change(intention, { target: { value: '🌱'.repeat(160) } })
    expect(intention.value).toBe('🌱'.repeat(160))
    expect(document.getElementById(intention.getAttribute('aria-describedby')!)!.textContent).toBe('160/160 caractères')
    prepare()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('region', { name: '2. Vérifier ton texte' })).toBeTruthy()
    fireEvent.change(intention, { target: { value: '🌱'.repeat(161) } })
    prepare()
    expect(screen.getByRole('alert').textContent).toContain('160 caractères')
    expect(intention.value).toBe('🌱'.repeat(161))
    expect(field('action').value).toBe(draft.action)
    expect(startButton().disabled).toBe(true)
    expect(screen.queryByRole('region', { name: '2. Vérifier ton texte' })).toBeNull()
  })

  it('exports a UTF-8 Blob containing the planned action and privacy wording without implying a completed download', async () => {
    vi.useFakeTimers()
    mockAnimationClock()
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:aurora-ritual-test')
    const revokeObjectURL = vi.fn()
    const NativeURL = URL
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    })
    const downloads: { href: string; name: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, name: this.download })
    })
    open()
    fill()
    prepare()
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mon texte et mon action' }))
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/plain;charset=utf-8')
    const content = new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    await act(async () => { await vi.runAllTimersAsync() })
    const text = await content
    expect(text).toContain('Durée prévue : 4 min 8 s (248 secondes)')
    expect(text).toContain(`Intention : ${draft.intention}`)
    expect(text).toContain(`Action prévue : ${draft.action}`)
    expect(text).toContain('Statut de l’action : prévue.')
    expect(text).toContain('Confidentialité')
    expect(text).toContain('Il ne valide ni une écoute ni la réalisation d’un objectif')
    expect(text).not.toContain('Action accomplie')
    expect(downloads).toEqual([{ href: 'blob:aurora-ritual-test', name: 'mon-rituel-intention-action.txt' }])
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:aurora-ritual-test')
    expect(screen.getByText('Téléchargement demandé. Vérifie le fichier dans tes téléchargements.')).toBeTruthy()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
