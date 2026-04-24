'use client'

// MUKTI — Mode 20 Journal Mental : audio recorder + Whisper + Claude analyse.

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mic, Square, Loader2, Activity, AlertTriangle } from 'lucide-react'
import { MENTAL_JOURNAL_MAX_AUDIO_SEC, MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD } from '@/lib/constants'

interface Entry {
  id: string
  transcript: string | null
  mood_score: number | null
  energy_score: number | null
  anxiety_score: number | null
  relapse_risk: number | null
  insights_fr: string[] | null
  created_at: string
}

interface Props {
  initialEntries: Entry[]
}

export default function MentalJournalRecorder({ initialEntries }: Props) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [recording, setRecording] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [pending, startTransition] = useTransition()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const intervalRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => stopInterval()
  }, [])

  function stopInterval() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  async function startRecording() {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        handleBlob(blob)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
      setElapsedSec(0)
      intervalRef.current = window.setInterval(() => {
        setElapsedSec(prev => {
          const next = prev + 1
          if (next >= MENTAL_JOURNAL_MAX_AUDIO_SEC) {
            stopRecording()
            return next
          }
          return next
        })
      }, 1000)
    } catch {
      toast.error('Micro non accessible. Vérifie tes permissions.')
    }
  }

  function stopRecording() {
    if (!recording) return
    recorderRef.current?.stop()
    setRecording(false)
    stopInterval()
  }

  function handleBlob(blob: Blob) {
    if (blob.size < 512) {
      toast.error('Audio trop court — parle un peu plus.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = typeof reader.result === 'string' ? reader.result : ''
      submitAudio(b64, elapsedSec)
    }
    reader.readAsDataURL(blob)
  }

  function submitAudio(audio_base64: string, duration: number) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/mental-journal/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64,
            declared_duration_sec: duration,
            lang_hint: 'fr',
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          toast.error(json.error ?? 'Analyse impossible.')
          return
        }
        setEntries(prev => [json.entry as Entry, ...prev].slice(0, 7))
        if ((json.entry as Entry).relapse_risk != null && (json.entry as Entry).relapse_risk! > MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD) {
          toast.warning('Attention — ton risque de rechute est élevé. MUKTI va t\'accompagner.')
        } else {
          toast.success('Journal analysé. Merci pour ce moment.')
        }
      } catch {
        toast.error('Connexion interrompue.')
      }
    })
  }

  const latest = entries[0]

  return (
    <div className="space-y-6">
      <div
        data-testid="journal-recorder"
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center gap-5">
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              data-testid="journal-stop-btn"
              className="flex h-28 w-28 items-center justify-center rounded-full bg-rose-500 shadow-[0_0_60px_-10px_rgba(244,63,94,0.6)] transition-transform hover:scale-105"
            >
              <Square className="h-12 w-12 fill-white text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={pending}
              data-testid="journal-start-btn"
              className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] shadow-[0_0_60px_-10px_rgba(124,58,237,0.6)] transition-transform hover:scale-105 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-12 w-12 animate-spin text-white" />
              ) : (
                <Mic className="h-12 w-12 text-white" />
              )}
            </button>
          )}
          <div className="text-center">
            <div className="text-sm font-medium text-white">
              {recording
                ? `Enregistrement · ${Math.floor(elapsedSec / 60)
                    .toString()
                    .padStart(2, '0')}:${(elapsedSec % 60).toString().padStart(2, '0')}`
                : pending
                  ? 'Analyse Whisper + IA…'
                  : 'Appuie et parle 1 à 3 minutes'}
            </div>
            <div className="mt-1 text-xs text-white/55">
              Max {MENTAL_JOURNAL_MAX_AUDIO_SEC}s · transcription + analyse mood automatiques
            </div>
          </div>
        </div>
      </div>

      {latest && (
        <div
          data-testid="journal-latest-card"
          className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
              Dernière entrée
            </div>
            {latest.relapse_risk != null && (
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                  latest.relapse_risk > MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD
                    ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                    : latest.relapse_risk > 0.4
                      ? 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FEF3C7]'
                      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {latest.relapse_risk > MENTAL_JOURNAL_RELAPSE_ALERT_THRESHOLD && (
                  <AlertTriangle className="h-3 w-3" />
                )}
                Risque {Math.round(latest.relapse_risk * 100)}%
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Mood', val: latest.mood_score, color: '#7c3aed' },
              { label: 'Énergie', val: latest.energy_score, color: '#10b981' },
              { label: 'Anxiété', val: latest.anxiety_score, color: '#F59E0B' },
            ].map(m => (
              <div
                key={m.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center"
              >
                <div className="text-[10px] uppercase tracking-widest text-white/55">
                  {m.label}
                </div>
                <div className="mt-1 text-2xl font-light text-white">
                  {m.val ?? '—'}
                  <span className="ml-0.5 text-xs text-white/40">/10</span>
                </div>
                <div
                  className="mx-auto mt-1 h-1 w-10 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${m.color}, ${m.color}33)`,
                    opacity: m.val != null ? (m.val / 10) * 0.8 + 0.2 : 0.1,
                  }}
                />
              </div>
            ))}
          </div>

          {latest.insights_fr && latest.insights_fr.length > 0 && (
            <div className="space-y-2">
              {latest.insights_fr.slice(0, 3).map((ins, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm text-white/80"
                >
                  <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DDD6FE]" />
                  <span>{ins}</span>
                </div>
              ))}
            </div>
          )}

          {latest.transcript && (
            <details className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-widest text-white/55">
                Transcription
              </summary>
              <p className="mt-2 text-sm text-white/70">{latest.transcript}</p>
            </details>
          )}
        </div>
      )}

      {entries.length > 1 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-xs font-medium uppercase tracking-[0.25em] text-white/55">
            7 dernières
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {entries.slice(1).map(e => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <span className="text-white/70">
                  {new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
                <span className="text-xs text-white/55">
                  mood {e.mood_score ?? '—'} · risque {e.relapse_risk != null ? Math.round(e.relapse_risk * 100) + '%' : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
