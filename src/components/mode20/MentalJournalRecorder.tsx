'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Trash2, RefreshCw } from 'lucide-react'
import {
  JOURNAL_AUDIO_MIME_TYPES, JOURNAL_CONSENT_VERSION, JOURNAL_MAX_AUDIO_BYTES,
  JOURNAL_MAX_TEXT_LENGTH, MENTAL_JOURNAL_MAX_AUDIO_SEC, MentalJournalEntrySchema,
  type MentalJournalEntry,
} from '@/lib/mental-journal-contract'
import { SOS_RESOURCES_FR } from '@/lib/constants/emergency'

interface Props { initialEntries: MentalJournalEntry[]; initialError?: string | null }
type CaptureState = 'idle' | 'requesting' | 'recording' | 'stopping'
interface AudioDraft { blob: Blob; duration: number; id: string; mime: string }

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Réponse du journal invalide.')
  return value as Record<string, unknown>
}

async function journalRequest(url: string, method: string, body: unknown, signal: AbortSignal) {
  if (signal.aborted) throw new Error('Requête interrompue.')
  const response = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal, cache: 'no-store',
  })
  if (signal.aborted) throw new Error('Requête interrompue. Vérifie ton historique avant de réessayer.')
  const result = objectBody(await response.json())
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Le journal est momentanément indisponible.')
  return result
}

function audioBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Requête interrompue.')); return }
    const reader = new FileReader()
    const cleanup = () => signal.removeEventListener('abort', cancel)
    const cancel = () => { reader.abort(); cleanup(); reject(new Error('Requête interrompue.')) }
    reader.onerror = () => { cleanup(); reject(new Error("L'audio ne peut pas être lu. Réessaie l'enregistrement.")) }
    reader.onabort = () => { cleanup(); reject(new Error('Requête interrompue.')) }
    reader.onload = () => {
      cleanup()
      const value = typeof reader.result === 'string' ? reader.result : ''
      const comma = value.indexOf(',')
      if (comma < 0) reject(new Error('Audio invalide.'))
      else resolve(value.slice(comma + 1))
    }
    signal.addEventListener('abort', cancel, { once: true })
    reader.readAsDataURL(blob)
  })
}

export default function MentalJournalRecorder({ initialEntries, initialError = null }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [text, setText] = useState('')
  const [reflectionConsent, setReflectionConsent] = useState(false)
  const [transcriptionConsent, setTranscriptionConsent] = useState(false)
  const [capture, setCapture] = useState<CaptureState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioDraft, setAudioDraft] = useState<AudioDraft | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const generationRef = useRef(0)
  const captureBusyRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)
  const textRequestRef = useRef<{ signature: string; id: string } | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const disposeCapture = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* Already stopped by the device. */ }
      }
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    captureBusyRef.current = false
  }, [clearTimer])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    clearTimer()
    setCapture('stopping')
    try { recorder.stop() } catch {
      disposeCapture()
      setCapture('idle')
      setError("L'enregistrement a été interrompu. Tu peux réessayer ou écrire ton journal.")
    }
  }, [clearTimer, disposeCapture])

  useEffect(() => {
    mountedRef.current = true
    const onVisibility = () => { if (document.hidden) stopRecording() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      document.removeEventListener('visibilitychange', onVisibility)
      disposeCapture()
      requestRef.current?.abort()
    }
  }, [disposeCapture, stopRecording])

  function cancelRecording() {
    generationRef.current += 1
    disposeCapture()
    setCapture('idle')
    setElapsed(0)
  }

  async function startRecording() {
    if (captureBusyRef.current || pendingRef.current || audioDraft) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      setError("Ce navigateur ne permet pas l'enregistrement audio. Tu peux écrire ton journal.")
      return
    }
    const mime = JOURNAL_AUDIO_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type))
    if (!mime) { setError("Le format audio de ce navigateur n'est pas pris en charge. Tu peux écrire ton journal."); return }
    captureBusyRef.current = true
    const generation = ++generationRef.current
    setCapture('requesting')
    setError(null)
    setNotice(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current || generation !== generationRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 })
      recorderRef.current = recorder
      const chunks: Blob[] = []
      let bytes = 0
      const startedAt = performance.now()
      const fail = (message: string) => {
        if (!mountedRef.current || generation !== generationRef.current) return
        generationRef.current += 1
        disposeCapture()
        setCapture('idle')
        setError(message)
      }
      recorder.ondataavailable = event => {
        if (generation !== generationRef.current || !mountedRef.current) return
        bytes += event.data.size
        if (bytes > JOURNAL_MAX_AUDIO_BYTES) {
          fail('Audio trop volumineux (maximum 3 Mo). Enregistre un passage plus court.')
        } else if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onerror = () => fail("Le micro a été interrompu. Tu peux réessayer ou écrire ton journal.")
      recorder.onstop = () => {
        if (!mountedRef.current || generation !== generationRef.current) return
        const duration = Math.min(MENTAL_JOURNAL_MAX_AUDIO_SEC, Math.max(1, Math.ceil((performance.now() - startedAt) / 1000)))
        const actualMime = recorder.mimeType || mime
        const blob = new Blob(chunks, { type: actualMime })
        disposeCapture()
        setCapture('idle')
        setElapsed(duration)
        if (blob.size < 512) { setError('Audio trop court. Tu peux réessayer ou écrire ton journal.'); return }
        if (!JOURNAL_AUDIO_MIME_TYPES.some(type => type === actualMime)) {
          setError("Le format de l'audio reçu n'est pas pris en charge. Tu peux écrire ton journal.")
          return
        }
        setAudioDraft({ blob, duration, id: crypto.randomUUID(), mime: actualMime })
        setTranscriptionConsent(false)
        setNotice("Audio prêt sur cet écran. Il sera envoyé uniquement avec ton accord et le bouton de transcription.")
      }
      recorder.start(1000)
      setElapsed(0)
      setCapture('recording')
      intervalRef.current = window.setInterval(() => {
        const seconds = Math.floor((performance.now() - startedAt) / 1000)
        setElapsed(Math.min(seconds, MENTAL_JOURNAL_MAX_AUDIO_SEC))
        if (seconds >= MENTAL_JOURNAL_MAX_AUDIO_SEC) stopRecording()
      }, 250)
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return
      disposeCapture()
      setCapture('idle')
      setError('Micro inaccessible. Vérifie les permissions de ton navigateur ou écris ton journal.')
    }
  }

  async function runRequest(operation: (signal: AbortSignal) => Promise<void>) {
    if (pendingRef.current || captureBusyRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    setNotice(null)
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 95000)
    try {
      await operation(controller.signal)
    } catch (failure) {
      if (mountedRef.current) setError(controller.signal.aborted
        ? 'Attente interrompue. Recharge ton historique avant de réessayer ; une entrée a peut-être été enregistrée.'
        : failure instanceof Error ? failure.message : 'Le journal est momentanément indisponible.')
    } finally {
      window.clearTimeout(timeout)
      if (requestRef.current === controller) requestRef.current = null
      pendingRef.current = false
      if (mountedRef.current) setPending(false)
    }
  }

  function acceptSaved(result: Record<string, unknown>, signal: AbortSignal) {
    if (!mountedRef.current || signal.aborted) throw new Error('Requête interrompue.')
    const parsed = MentalJournalEntrySchema.safeParse(result.entry)
    if (!parsed.success) throw new Error("La réponse d'enregistrement est invalide. Vérifie ton historique avant de réessayer.")
    setEntries(previous => [parsed.data, ...previous.filter(entry => entry.id !== parsed.data.id)].slice(0, 30))
    setNotice(typeof result.warning === 'string' ? result.warning : 'Ton journal est enregistré.')
  }

  function saveText() {
    if (!text.trim()) { setError('Écris quelques mots avant de sauvegarder.'); return }
    void runRequest(async signal => {
      const signature = JSON.stringify([text.trim(), reflectionConsent])
      if (textRequestRef.current?.signature !== signature) textRequestRef.current = { signature, id: crypto.randomUUID() }
      const result = await journalRequest('/api/mental-journal/entries', 'POST', {
        client_entry_id: textRequestRef.current.id, text: text.trim(), lang_hint: 'fr',
        reflection_consent: reflectionConsent ? JOURNAL_CONSENT_VERSION : null,
      }, signal)
      acceptSaved(result, signal)
      setText('')
      setReflectionConsent(false)
      textRequestRef.current = null
    })
  }

  function saveAudio() {
    if (!audioDraft || !transcriptionConsent) return
    const draft = audioDraft
    void runRequest(async signal => {
      const encoded = await audioBase64(draft.blob, signal)
      const result = await journalRequest('/api/mental-journal/analyze', 'POST', {
        client_entry_id: draft.id, audio_base64: encoded, audio_mime_type: draft.mime,
        declared_duration_sec: draft.duration, lang_hint: 'fr', transcription_consent: JOURNAL_CONSENT_VERSION,
        reflection_consent: reflectionConsent ? JOURNAL_CONSENT_VERSION : null,
      }, signal)
      acceptSaved(result, signal)
      setAudioDraft(null)
      setTranscriptionConsent(false)
      setReflectionConsent(false)
    })
  }

  function refreshEntries() {
    void runRequest(async signal => {
      const result = await journalRequest('/api/mental-journal/entries?limit=30', 'GET', undefined, signal)
      const parsed = MentalJournalEntrySchema.array().safeParse(result.entries)
      if (!parsed.success) throw new Error("L'historique reçu est invalide.")
      if (mountedRef.current && !signal.aborted) { setEntries(parsed.data); setNotice('Historique actualisé.') }
    })
  }

  function removeEntry(id: string) {
    void runRequest(async signal => {
      const result = await journalRequest('/api/mental-journal/entries', 'DELETE', { id }, signal)
      if (result.ok !== true || result.id !== id) throw new Error('La suppression ne peut pas être confirmée.')
      if (mountedRef.current && !signal.aborted) {
        setEntries(previous => previous.filter(entry => entry.id !== id))
        setConfirmDelete(null)
        setNotice('Entrée supprimée de ton journal.')
      }
    })
  }

  const busy = pending || capture !== 'idle'
  const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>}
      {notice && <p role="status" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/85">{notice}</p>}
      <section aria-labelledby="journal-write-title" data-testid="journal-recorder" className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div>
          <h2 id="journal-write-title" className="text-lg font-medium">Ton espace pour écrire</h2>
          <p className="mt-2 text-sm text-white/70">Quelques mots suffisent. Tu peux garder une trace sans demander de réflexion à l’IA.</p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-white/85">Ce que tu souhaites noter</span>
          <textarea value={text} onChange={event => setText(event.target.value)} maxLength={JOURNAL_MAX_TEXT_LENGTH}
            disabled={busy} rows={5} className="w-full rounded-xl border border-white/20 bg-black/20 p-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-violet-300"
            aria-describedby="journal-text-limit" />
        </label>
        <p id="journal-text-limit" className="text-xs text-white/60">{text.length} / {JOURNAL_MAX_TEXT_LENGTH} caractères. Le brouillon reste sur cet écran jusqu’à l’enregistrement ; il disparaît si tu quittes la page.</p>
        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/80">
          <input type="checkbox" checked={reflectionConsent} disabled={busy} onChange={event => setReflectionConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
          <span>Je souhaite une réflexion facultative par IA : mon texte, ou sa transcription si je choisis l’audio, sera envoyé à Anthropic pour sélectionner des extraits de mes propres mots et des questions de relecture. Ce choix peut se tromper ; il ne mesure pas ma santé et ne déclenche aucun contact automatique.</span>
        </label>
        <button type="button" onClick={saveText} disabled={busy || !text.trim()} className={`${buttonClass} bg-violet-600/40`}>Enregistrer mon texte</button>
        <div className="border-t border-white/10 pt-5">
          <h3 className="font-medium">Ou dicter une entrée</h3>
          <p className="mt-2 text-sm text-white/70">Enregistre jusqu’à trois minutes. L’arrêt prépare l’audio sur cet écran et libère le micro.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {capture === 'recording' ? (
              <button type="button" onClick={stopRecording} data-testid="journal-stop-btn" className={buttonClass}><Square aria-hidden="true" className="h-4 w-4" />Arrêter l’enregistrement</button>
            ) : capture === 'requesting' ? (
              <button type="button" onClick={cancelRecording} className={buttonClass}>Annuler la demande de micro</button>
            ) : (
              <button type="button" onClick={startRecording} disabled={busy || audioDraft !== null} data-testid="journal-start-btn" className={buttonClass}><Mic aria-hidden="true" className="h-4 w-4" />Enregistrer un audio</button>
            )}
            {capture !== 'idle' && <span role="status" className="text-sm text-white/70">{capture === 'requesting' ? 'Autorisation du micro…' : capture === 'stopping' ? 'Préparation de l’audio…' : `Enregistrement : ${elapsed} / ${MENTAL_JOURNAL_MAX_AUDIO_SEC} s`}</span>}
          </div>
          {audioDraft && <div className="mt-4 space-y-3 rounded-xl border border-white/10 p-4">
            <p className="text-sm text-white/85">Audio prêt · {audioDraft.duration} s</p>
            <label className="flex items-start gap-3 text-sm text-white/80">
              <input type="checkbox" checked={transcriptionConsent} disabled={busy} onChange={event => setTranscriptionConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
              <span>J’accepte d’envoyer cet audio à OpenAI pour sa transcription. Le texte sera enregistré dans mon journal. MUKTI ne conserve pas le fichier audio ; le traitement du prestataire suit sa politique de confidentialité.</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveAudio} disabled={busy || !transcriptionConsent} className={`${buttonClass} bg-violet-600/40`}>Transcrire et enregistrer</button>
              <button type="button" disabled={busy} onClick={() => { setAudioDraft(null); setTranscriptionConsent(false); setNotice('Audio effacé de cet écran.'); }} className={buttonClass}>Effacer cet audio</button>
            </div>
          </div>}
        </div>
        {pending && <div className="flex flex-wrap items-center gap-3" role="status"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /><span className="text-sm">En cours…</span><button type="button" onClick={() => requestRef.current?.abort()} className={buttonClass}>Annuler l’attente</button></div>}
      </section>

      <section aria-labelledby="journal-human-title" className="rounded-3xl border border-sky-200/15 bg-sky-300/5 p-5">
        <h2 id="journal-human-title" className="font-medium">Garder un lien humain</h2>
        <p className="mt-2 text-sm text-white/75">Tu peux parler à une personne de confiance ou à un professionnel, quel que soit le contenu de ton journal. Le journal n’est pas surveillé par un professionnel.</p>
        <details className="mt-3">
          <summary className="cursor-pointer py-2 text-sm text-sky-100">Voir les ressources humaines en France</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {SOS_RESOURCES_FR.filter(resource => ['15', '112', '3114', '0 800 23 13 13'].includes(resource.number)).map(resource => (
              <li key={resource.number}><a className="inline-block py-2 text-sky-100 underline underline-offset-4" href={`tel:${resource.number.replace(/\s/g, '')}`}>{resource.name} · {resource.number}</a></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-white/65">En dehors de la France, contacte les ressources locales. Ces liens n’appellent personne tant que tu ne les choisis pas.</p>
        </details>
      </section>

      <section aria-labelledby="journal-history-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="journal-history-title" className="text-lg font-medium">Tes 30 dernières entrées</h2>
          <button type="button" onClick={refreshEntries} disabled={busy} className={buttonClass}><RefreshCw aria-hidden="true" className="h-4 w-4" />Actualiser l’historique</button>
        </div>
        {entries.length === 0 && !initialError && <p className="text-sm text-white/65">Aucune entrée affichée pour le moment.</p>}
        {entries.map(entry => (
          <article key={entry.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/60">{new Date(entry.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}{entry.entry_source === 'audio' ? ' · Dictée' : entry.entry_source === 'legacy' ? ' · Entrée conservée' : ' · Texte'}</p>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(entry.id)} aria-label="Supprimer cette entrée" className={buttonClass}><Trash2 aria-hidden="true" className="h-4 w-4" />Supprimer</button>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">{entry.transcript ?? 'Texte indisponible pour cette ancienne entrée.'}</p>
            {entry.reflection && <div className="space-y-2 border-t border-white/10 pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-violet-200">Réflexion facultative proposée par IA</h3>
              <p className="text-sm text-white/80">{entry.reflection.summary}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-white/75">{entry.reflection.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
              <p className="text-xs text-white/60">À relire avec ton propre jugement ; ce contenu n’est pas une évaluation clinique.</p>
            </div>}
            {entry.reflection_status === 'unavailable' && <p className="text-xs text-white/60">Ton texte est conservé ; la réflexion facultative n’a pas été disponible.</p>}
            {confirmDelete === entry.id && <div className="space-y-3 rounded-xl border border-rose-300/30 p-3" role="group" aria-label="Confirmer la suppression">
              <p className="text-sm text-white/85">Supprimer cette entrée et sa réflexion du journal ? Cette action est définitive.</p>
              <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => removeEntry(entry.id)} className={buttonClass}>Confirmer la suppression</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(null)} className={buttonClass}>Conserver l’entrée</button></div>
            </div>}
          </article>
        ))}
      </section>
    </div>
  )
}
