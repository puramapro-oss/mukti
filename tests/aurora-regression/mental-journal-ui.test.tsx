import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MentalJournalRecorder from '../../src/components/mode20/MentalJournalRecorder'
import { JOURNAL_CONSENT_VERSION, type MentalJournalEntry } from '../../src/lib/mental-journal-contract'

const entry: MentalJournalEntry = {
  id: '10000000-0000-4000-8000-000000000001', transcript: 'Texte synthétique conservé.', transcript_lang: 'fr',
  audio_duration_sec: null, entry_source: 'text', reflection: null, reflection_status: 'not_requested',
  created_at: '2026-11-10T12:00:00.000Z',
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function installMicrophone(options: { mp4?: boolean; throwOnConstruct?: boolean; unsupported?: boolean } = {}) {
  const stopTrack = vi.fn()
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
  const permission = vi.fn(async () => stream)
  vi.stubGlobal('navigator', { userAgent: navigator.userAgent, mediaDevices: { getUserMedia: permission } })
  const instances: MockRecorder[] = []
  class MockRecorder {
    state: RecordingState = 'inactive'
    mimeType: string
    onstop: (() => void) | null = null
    onerror: (() => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    static isTypeSupported(type: string) { return !options.unsupported && (options.mp4 ? type === 'audio/mp4' : type === 'audio/webm;codecs=opus') }
    constructor(_stream: MediaStream, settings: MediaRecorderOptions) {
      if (options.throwOnConstruct) throw new Error('Synthetic unsupported device')
      this.mimeType = settings.mimeType ?? 'audio/webm'
      instances.push(this)
    }
    start = vi.fn(() => { this.state = 'recording' })
    stop = vi.fn(() => {
      this.state = 'inactive'
      const data = new Uint8Array(1024)
      data.set([0x1a, 0x45, 0xdf, 0xa3])
      this.ondataavailable?.({ data: new Blob([data], { type: this.mimeType }) })
      this.onstop?.()
    })
  }
  vi.stubGlobal('MediaRecorder', MockRecorder)
  const time = vi.spyOn(performance, 'now').mockReturnValue(0)
  return { stopTrack, stream, permission, instances, time }
}

function installFileReader() {
  class MockReader {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    aborted = false
    readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,${btoa('synthetic-audio')}`
      queueMicrotask(() => { if (!this.aborted) this.onload?.() })
    }
    abort() { this.aborted = true; this.onabort?.() }
  }
  vi.stubGlobal('FileReader', MockReader)
}

beforeEach(() => { vi.clearAllMocks() })

describe('Journal text, disclosure and ownership actions', () => {
  it('shows retained writings without legacy inferred values or warnings', () => {
    const legacy = { ...entry, entry_source: 'legacy' as const, relapse_risk: 0.99, mood_score: 2, insights_fr: ['Ancienne inférence'] }
    render(<MentalJournalRecorder initialEntries={[legacy]} />)
    expect(screen.getByText(entry.transcript!)).toBeTruthy()
    expect(screen.queryByText(/Risque 99|Ancienne inférence|Mood/)).toBeNull()
    expect(screen.getByText('Garder un lien humain')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('saves a typed journal without AI consent by default', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response({ entry, warning: null }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: entry.transcript } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' })))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.reflection_consent).toBeNull()
    expect(body.client_entry_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(screen.getByText('Ton journal est enregistré.')).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })
  it('sends the current reflection consent only after a deliberate choice', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response({ entry, warning: null }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Note synthétique.' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Je souhaite une réflexion facultative/ }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' })))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reflection_consent).toBe(JOURNAL_CONSENT_VERSION)
    expect((screen.getByRole('checkbox', { name: /Je souhaite une réflexion facultative/ }) as HTMLInputElement).checked).toBe(false)
  })
  it('makes one request for rapid repeated save clicks', async () => {
    const pending = deferred<Response>()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Note synthétique.' } })
    const button = screen.getByRole('button', { name: 'Enregistrer mon texte' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => pending.resolve(response({ entry, warning: null }, 201)))
  })
  it('keeps the draft and its retry id after a failed response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: 'Stockage indisponible.' }, 503)).mockResolvedValueOnce(response({ entry, warning: null }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Brouillon synthétique.' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' })))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Brouillon synthétique.')
    expect(screen.getByRole('alert').textContent).toContain('Stockage indisponible')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' })))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).client_entry_id).toBe(JSON.parse(fetchMock.mock.calls[1][1].body as string).client_entry_id)
  })
  it('does not claim success for a malformed success response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ entry: { id: entry.id } }, 201)))
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Brouillon synthétique.' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' })))
    expect(screen.getByRole('alert').textContent).toMatch(/invalide/)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Brouillon synthétique.')
  })
  it('ignores a late response after cancellation and retains the draft', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Brouillon synthétique.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mon texte' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’attente' }))
    await act(async () => pending.resolve(response({ entry, warning: null }, 201)))
    expect(screen.getByRole('alert').textContent).toMatch(/historique/)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Brouillon synthétique.')
    expect(screen.queryByText('Ton journal est enregistré.')).toBeNull()
  })
  it('asks for a concrete deletion confirmation and keeps the entry on failure', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response({ error: 'Suppression indisponible.' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[entry]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cette entrée' }))
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' })))
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    expect(screen.getByText(entry.transcript!)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Suppression indisponible/)
  })
  it('removes an entry only after server confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ ok: true, id: entry.id })))
    render(<MentalJournalRecorder initialEntries={[entry]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cette entrée' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' })))
    expect(screen.queryByText(entry.transcript!)).toBeNull()
    expect(screen.getByText('Entrée supprimée de ton journal.')).toBeTruthy()
  })
})

describe('Journal microphone lifecycle and audio consent', () => {
  it('stops the microphone, keeps audio local and submits the measured duration after consent', async () => {
    const microphone = installMicrophone()
    installFileReader()
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response({ entry: { ...entry, entry_source: 'audio', audio_duration_sec: 3 }, warning: null }, 201))
    vi.stubGlobal('fetch', fetchMock)
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    microphone.time.mockReturnValue(2300)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’enregistrement' }))
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
    const upload = screen.getByRole('button', { name: 'Transcrire et enregistrer' }) as HTMLButtonElement
    expect(upload.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /J’accepte d’envoyer cet audio/ }))
    await act(async () => fireEvent.click(upload))
    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.declared_duration_sec).toBe(3)
    expect(body.audio_mime_type).toBe('audio/webm;codecs=opus')
    expect(body.transcription_consent).toBe(JOURNAL_CONSENT_VERSION)
    expect(body.reflection_consent).toBeNull()
  })
  it('automatically stops after 180 seconds without uploading', async () => {
    vi.useFakeTimers()
    const microphone = installMicrophone()
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    microphone.time.mockReturnValue(180000)
    act(() => vi.advanceTimersByTime(250))
    expect(microphone.instances[0].stop).toHaveBeenCalledOnce()
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(screen.getByText('Audio prêt · 180 s')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('selects a supported MP4 format instead of assuming WebM', async () => {
    const microphone = installMicrophone({ mp4: true })
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    expect(microphone.instances[0].mimeType).toBe('audio/mp4')
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’enregistrement' }))
    expect(screen.getByText('Audio prêt · 1 s')).toBeTruthy()
  })
  it('does not ask for microphone access when no supported format is available', async () => {
    const microphone = installMicrophone({ unsupported: true })
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    expect(microphone.permission).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/format audio/)
  })
  it('falls back to writing when MediaRecorder lacks capability detection', async () => {
    const microphone = installMicrophone()
    vi.stubGlobal('MediaRecorder', class LegacyRecorder {})
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    expect(microphone.permission).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/écrire ton journal/)
  })
  it('releases granted tracks when MediaRecorder construction fails', async () => {
    const microphone = installMicrophone({ throwOnConstruct: true })
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
  it('releases the recorder and tracks on unmount without uploading', async () => {
    const microphone = installMicrophone()
    const view = render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    view.unmount()
    expect(microphone.instances[0].stop).toHaveBeenCalledOnce()
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('closes a stream whose permission arrives after navigation away', async () => {
    const microphone = installMicrophone()
    const pending = deferred<MediaStream>()
    microphone.permission.mockReturnValueOnce(pending.promise)
    const view = render(<MentalJournalRecorder initialEntries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' }))
    view.unmount()
    await act(async () => pending.resolve(microphone.stream))
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(microphone.instances).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('stops on a hidden page and does not upload', async () => {
    const microphone = installMicrophone()
    render(<MentalJournalRecorder initialEntries={[]} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un audio' })))
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not duplicate a pending microphone request and allows cancellation', async () => {
    const microphone = installMicrophone()
    const pending = deferred<MediaStream>()
    microphone.permission.mockReturnValueOnce(pending.promise)
    render(<MentalJournalRecorder initialEntries={[]} />)
    const button = screen.getByRole('button', { name: 'Enregistrer un audio' })
    act(() => { fireEvent.click(button); fireEvent.click(button) })
    expect(microphone.permission).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la demande de micro' }))
    await act(async () => pending.resolve(microphone.stream))
    expect(microphone.stopTrack).toHaveBeenCalledOnce()
    expect(microphone.instances).toHaveLength(0)
  })
})
