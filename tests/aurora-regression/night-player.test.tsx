import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NightPlayer from '@/components/reprogrammation/NightPlayer'
import { mockAnimationClock } from './clock'

const mocks = vi.hoisted(() => ({
  nature: {
    start: vi.fn(), stop: vi.fn(), setVolume: vi.fn(), setSound: vi.fn(), dispose: vi.fn(),
  },
  speech: { cancel: vi.fn(), speak: vi.fn<(utterance: { text: string }) => void>() },
}))
vi.mock('@/lib/nature-sounds', () => ({ createNatureSoundEngine: () => mocks.nature }))

function affirmation(id: string, text: string) {
  return { id, text_fr: text, text_en: null, source: 'purama' as const }
}

function mockSessions(...playlists: ReturnType<typeof affirmation>[][]) {
  let starts = 0
  const ended: unknown[] = []
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    let data: unknown
    if (url === '/api/reprogramming/start') {
      const affirmations = playlists[starts++]
      if (!affirmations) throw new Error('Unexpected session start')
      data = { ok: true, session_id: `night-${starts}`, affirmations }
    } else if (url === '/api/reprogramming/end') {
      ended.push(JSON.parse(String(init?.body)) as unknown)
      data = { ok: true }
    } else {
      throw new Error(`Unexpected request: ${String(url)}`)
    }
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { ended, fetchMock }
}

async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}

async function advance(timeMs: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(timeMs) })
}

function spokenTexts() {
  return mocks.speech.speak.mock.calls.map(([utterance]) => utterance.text)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockAnimationClock()
  vi.stubGlobal('speechSynthesis', mocks.speech)
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    lang = ''
    rate = 1
    pitch = 1
    volume = 1
    constructor(public text: string) {}
  })
})

describe('NightPlayer session playback', () => {
  it('starts at the first affirmation and speaks each timed rotation once in StrictMode', async () => {
    const { fetchMock } = mockSessions([
      affirmation('first', 'Je prends le temps de me poser.'),
      affirmation('second', 'Je relâche mes épaules.'),
      affirmation('third', 'Je laisse venir le repos.'),
    ])
    render(<StrictMode><NightPlayer /></StrictMode>)
    await click('Réglages')
    await click('Voix')
    await click('Démarrer la session nuit')

    expect(screen.getByText('Je prends le temps de me poser.')).toBeTruthy()
    expect(screen.getByText('Affirmation 1 / 3')).toBeTruthy()
    expect(screen.getByText('1 lue')).toBeTruthy()
    expect(spokenTexts()).toEqual(['Je prends le temps de me poser.'])
    expect(mocks.nature.start).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()

    await advance(11_999)
    expect(screen.getByText('Affirmation 1 / 3')).toBeTruthy()
    expect(mocks.speech.speak).toHaveBeenCalledOnce()
    await advance(1)
    expect(screen.getByText('Je relâche mes épaules.')).toBeTruthy()
    expect(screen.getByText('Affirmation 2 / 3')).toBeTruthy()
    expect(screen.getByText('2 lues')).toBeTruthy()
    await advance(12_000)
    expect(screen.getByText('Je laisse venir le repos.')).toBeTruthy()
    expect(screen.getByText('Affirmation 3 / 3')).toBeTruthy()
    expect(screen.getByText('3 lues')).toBeTruthy()
    expect(spokenTexts()).toEqual([
      'Je prends le temps de me poser.', 'Je relâche mes épaules.', 'Je laisse venir le repos.',
    ])
  })

  it('counts and saves unique identifiers, then resets the position and count for a new session', async () => {
    const { ended } = mockSessions([
      affirmation('custom-shared', 'Première lecture.'),
      affirmation('shared', 'Autre version du même texte.'),
      affirmation('other', 'Un autre texte.'),
    ], [
      affirmation('fresh-first', 'Nouveau départ.'),
      affirmation('fresh-second', 'La suite de cette session.'),
      affirmation('fresh-third', 'Dernière étape.'),
    ])
    render(<NightPlayer />)
    await click('Démarrer la session nuit')
    await advance(12_000)
    expect(screen.getByText('Autre version du même texte.')).toBeTruthy()
    expect(screen.getByText('1 lue')).toBeTruthy()
    await advance(12_000)
    expect(screen.getByText('2 lues')).toBeTruthy()
    await advance(24_000)
    expect(screen.getByText('Affirmation 2 / 3')).toBeTruthy()
    expect(screen.getByText('2 lues')).toBeTruthy()
    await click('Terminer la session')
    expect(ended).toEqual([{ session_id: 'night-1', affirmations_played: ['shared', 'other'] }])

    await click('Démarrer la session nuit')
    expect(screen.getByText('Nouveau départ.')).toBeTruthy()
    expect(screen.getByText('Affirmation 1 / 3')).toBeTruthy()
    expect(screen.getByText('1 lue')).toBeTruthy()
    await advance(12_000)
    expect(screen.getByText('La suite de cette session.')).toBeTruthy()
    expect(screen.getByText('Affirmation 2 / 3')).toBeTruthy()
    expect(screen.getByText('2 lues')).toBeTruthy()
    await click('Terminer la session')
    expect(ended).toEqual([
      { session_id: 'night-1', affirmations_played: ['shared', 'other'] },
      { session_id: 'night-2', affirmations_played: ['fresh-first', 'fresh-second'] },
    ])
    expect(mocks.nature.start).toHaveBeenCalledTimes(2)
    expect(mocks.speech.speak).not.toHaveBeenCalled()
  })

  it('stops audio and speech, saves once and prevents later readings after termination', async () => {
    const { ended, fetchMock } = mockSessions([
      affirmation('first', 'Première lecture.'),
      affirmation('second', 'Deuxième lecture.'),
      affirmation('third', 'Troisième lecture.'),
    ])
    render(<NightPlayer />)
    await click('Réglages')
    await click('Voix')
    await click('Démarrer la session nuit')
    await advance(12_000)
    expect(spokenTexts()).toEqual(['Première lecture.', 'Deuxième lecture.'])
    mocks.speech.cancel.mockClear()

    await click('Terminer la session')
    expect(mocks.nature.stop).toHaveBeenCalledOnce()
    expect(mocks.speech.cancel).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Démarrer la session nuit' })).toBeTruthy()
    expect(screen.queryByText('Deuxième lecture.')).toBeNull()

    await advance(60_000)
    expect(spokenTexts()).toEqual(['Première lecture.', 'Deuxième lecture.'])
    expect(screen.queryByText('Troisième lecture.')).toBeNull()
    expect(mocks.nature.start).toHaveBeenCalledOnce()
    expect(mocks.nature.stop).toHaveBeenCalledOnce()
    expect(mocks.speech.cancel).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(ended).toEqual([{ session_id: 'night-1', affirmations_played: ['first', 'second'] }])
  })
})
