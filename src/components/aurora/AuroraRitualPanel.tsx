'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createRitualPlan, ritualCueAt, serializeRitualPlan, type RitualDraft, type RitualPlan } from '@/lib/aurora-ritual'
import type { AuroraVariant } from '@/lib/constants'
import type { useAuroraSession } from './useAuroraSession'

type Session = ReturnType<typeof useAuroraSession>
type Props = {
  session: Session
  plan: RitualPlan | null
  onPlanChange: (plan: RitualPlan | null) => void
  onBack: () => void
  draft: RitualDraft
  onDraftChange: (draft: RitualDraft) => void
  duration: number
  variant: AuroraVariant
  onVariantChange: (variant: AuroraVariant) => void
}

const FIELDS = [
  { key: 'intention', label: 'Une intention qui compte pour toi', example: 'Avancer sur mon projet créatif' },
  { key: 'outcome', label: 'Un résultat souhaité et observable', example: 'Avoir une première page à partager' },
  { key: 'obstacle', label: 'Un obstacle concret', example: 'J’attends que tout soit parfait' },
  { key: 'response', label: 'Si cet obstacle arrive, alors je…', example: 'Commence par un brouillon de cinq lignes' },
  { key: 'action', label: 'Mon prochain petit pas', example: 'Écrire cinq lignes de brouillon' },
  { key: 'context', label: 'Quand et où je prévois ce pas', example: 'Demain à 18 h, à mon bureau' },
] as const
const buttonClass = 'rounded-xl border border-white/25 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-200'
const cardClass = 'rounded-2xl border border-white/15 bg-white/[0.04] p-5 sm:p-6'

function time(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function AuroraRitualPanel({ session, plan, onPlanChange, onBack, draft, onDraftChange, duration, variant, onVariantChange }: Props) {
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const playbackHeading = useRef<HTMLHeadingElement>(null)
  const { engine, ritualMix, voiceEnabled, ritualCompletion } = session
  const { running, paused, sessionElapsedSec: elapsed } = engine.meta
  const locked = running || session.starting || session.saving
  const audioLocked = (running && !paused) || session.starting
  const cue = plan ? ritualCueAt(plan, elapsed) : null
  const cueIndex = plan && cue ? plan.cues.findIndex((item) => item.id === cue.id) : 0
  const hasAudio = (voiceEnabled && ritualMix.voice > 0) || ritualMix.music > 0 || ritualMix.tone > 0

  useEffect(() => {
    if (running) playbackHeading.current?.focus()
  }, [running])

  function changeField<K extends keyof RitualDraft>(key: K, value: RitualDraft[K]) {
    onDraftChange({ ...draft, [key]: value })
    setApproved(false)
    setError(null)
    setExportStatus(null)
    onPlanChange(null)
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setApproved(false)
    setError(null)
    setExportStatus(null)
    try {
      onPlanChange(createRitualPlan(draft, duration))
    } catch (cause) {
      onPlanChange(null)
      setError(cause instanceof Error ? cause.message : 'Vérifie les champs de ton rituel.')
    }
  }

  function download() {
    if (!plan) return
    let url: string | null = null
    try {
      const blob = new Blob([serializeRitualPlan(plan)], { type: 'text/plain;charset=utf-8' })
      url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'mon-rituel-intention-action.txt'
      document.body.append(link)
      link.click()
      link.remove()
      setExportStatus('Téléchargement demandé. Vérifie le fichier dans tes téléchargements.')
    } catch {
      setExportStatus('Téléchargement indisponible dans ce navigateur. Tu peux sélectionner et copier le texte de l’aperçu.')
    } finally {
      if (url) { const released = url; window.setTimeout(() => URL.revokeObjectURL(released), 1000) }
    }
  }

  return (
    <section className="relative min-h-screen bg-[#0A0A0F] px-5 pb-28 pt-28 text-white sm:px-8" aria-labelledby="ritual-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_65%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-teal-200">AURORA · Réalisation de soi</p>
          <button type="button" className={buttonClass} onClick={onBack} disabled={locked}>Revenir à la respiration</button>
        </div>
        <div>
          <h1 id="ritual-title" className="text-3xl font-light tracking-tight sm:text-4xl">De l’intention à l’action</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
            Choisis un projet, explore ce qui compte et prépare un premier pas. Le guidage associe réflexion, visualisation facultative et musique.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {time(duration)} · 8 étapes · Respiration naturelle. Tu peux garder les yeux ouverts et utiliser des mots sans former d’images.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Ton brouillon reste en mémoire sur cette page. Il sera effacé si tu la quittes ou l’actualises. Exporte le texte préparé pour le conserver. Ce rituel ne garantit pas le résultat de ton projet.
          </p>
        </div>

        {!running && !ritualCompletion && (
          <form onSubmit={prepare} className={cardClass}>
            <fieldset disabled={locked} className="space-y-5">
              <legend className="mb-4 text-xl font-medium">1. Préparer ton intention</legend>
              <label htmlFor="ritual-duration" className="block text-sm font-medium">
                Durée du rituel
                <select id="ritual-duration" value={variant} onChange={(event) => {
                  onVariantChange(event.target.value as AuroraVariant); onPlanChange(null)
                  setApproved(false); setError(null); setExportStatus(null)
                }} className="mt-2 block w-full rounded-xl border border-white/25 bg-slate-950 p-3 text-base text-white">
                  <option value="ignite">2 min 8 s — intention très brève</option>
                  <option value="focus">4 min 8 s</option>
                  <option value="calm">7 min 48 s</option>
                  <option value="sleep">10 min 8 s</option>
                </select>
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                {FIELDS.map(({ key, label, example }) => (
                  <label key={key} htmlFor={`ritual-${key}`} className="block text-sm font-medium text-slate-100">
                    {label}
                    <textarea id={`ritual-${key}`} name={key} required rows={2}
                      autoComplete="off" spellCheck
                      value={draft[key]} onChange={(event) => changeField(key, event.target.value)}
                      placeholder={example}
                      className="mt-2 w-full resize-y rounded-xl border border-white/25 bg-slate-950 p-3 text-base font-normal text-white placeholder:text-slate-400 focus:outline focus:outline-2 focus:outline-teal-200"
                      aria-describedby={`ritual-${key}-count`} />
                    <span id={`ritual-${key}-count`} className="mt-1 block text-xs font-normal text-slate-400">{Array.from(draft[key].normalize('NFC').trim().replace(/\s+/gu, ' ')).length}/160 caractères</span>
                  </label>
                ))}
              </div>
              <label htmlFor="ritual-mode" className="block text-sm font-medium">
                Ton approche
                <select id="ritual-mode" value={draft.mode} onChange={(event) => changeField('mode', event.target.value as RitualDraft['mode'])}
                  className="mt-2 block w-full rounded-xl border border-white/25 bg-slate-950 p-3 text-base text-white">
                  <option value="factuel">Factuelle — réflexion et action</option>
                  <option value="mixte">Mixte — action et geste symbolique facultatif</option>
                  <option value="spirituel">Spirituelle — intention personnelle, à ton choix</option>
                </select>
              </label>
              <button type="submit" className={`${buttonClass} bg-teal-300/15`}>Préparer le texte</button>
            </fieldset>
          </form>
        )}

        {error && <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-950/40 p-4 text-rose-100">{error}</p>}

        {plan && !running && !ritualCompletion && (
          <section className={cardClass} aria-labelledby="ritual-preview-title">
            <h2 id="ritual-preview-title" className="text-xl font-medium">2. Vérifier ton texte</h2>
            <p role="status" className="mt-2 text-sm text-teal-200">Ton texte est prêt. Tu peux le modifier avant de démarrer.</p>
            <ol className="mt-5 space-y-5">
              {plan.cues.map((item, index) => (
                <li key={item.id}>
                  <h3 className="font-medium text-teal-100">{index + 1}. {item.title} <span className="text-xs font-normal text-slate-400">· {time(item.at)}</span></h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{item.text}</p>
                </li>
              ))}
            </ol>
            <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" checked={approved} disabled={locked} onChange={(event) => setApproved(event.target.checked)} className="mt-1 h-5 w-5 accent-teal-300" />
              <span>J’ai relu ce texte et je choisis de commencer avec cette intention.</span>
            </label>
          </section>
        )}

        {(running || ritualCompletion) && plan && cue && (
          <section className={cardClass} aria-labelledby="ritual-playback-title">
            <div role="status" aria-live={voiceEnabled && ritualMix.voice > 0 ? 'off' : 'polite'} aria-atomic="true">
              <h2 id="ritual-playback-title" ref={playbackHeading} tabIndex={-1} className="text-xl font-medium focus:outline-none">
                {ritualCompletion === 'completed' ? 'Parcours terminé' : ritualCompletion === 'stopped' ? 'Parcours arrêté' : paused ? 'Rituel en pause' : `Étape ${cueIndex + 1} sur 8 · ${cue.title}`}
              </h2>
              {running && <p className="mt-6 whitespace-pre-wrap break-words text-xl leading-relaxed text-slate-100">{cue.text}</p>}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <progress max={duration} value={Math.min(elapsed, duration)} aria-label="Avancement du rituel" className="h-2 w-full accent-teal-300" />
              <span role="timer" aria-live="off" className="whitespace-nowrap text-sm tabular-nums text-slate-300">{time(elapsed)} / {time(duration)}</span>
            </div>
            {paused && <p className="mt-4 text-sm text-slate-300">Le temps et les sons sont en pause. Avec la voix, la reprise recommence l’étape courante et ramène le compteur à son début. En texte seul, elle conserve ta position.</p>}
            {ritualCompletion && (
              <div className="mt-5 space-y-3">
                <h3 className="font-medium text-teal-200">Ton action reste prévue</h3>
                <p className="break-words text-lg">{plan.draft.action}</p>
                <p className="break-words text-sm text-slate-300">Quand et où : {plan.draft.context}</p>
                <p className="text-sm leading-relaxed text-slate-300">Tu peux ajuster ce pas à ta situation. La fin du guidage ne confirme pas sa réalisation.</p>
                <button type="button" className={buttonClass} onClick={() => {
                  onPlanChange(null); setApproved(false); setExportStatus(null)
                  onBack()
                }}>Revenir à AURORA</button>
              </div>
            )}
          </section>
        )}

        {!ritualCompletion && (
          <section className={cardClass} aria-labelledby="ritual-audio-title">
            <h2 id="ritual-audio-title" className="text-xl font-medium">Ton ambiance</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Les volumes se règlent avant l’écoute ou en pause. Le bouton Silence coupe immédiatement tous les sons.</p>
            <fieldset disabled={audioLocked} className="mt-4 space-y-4">
              <legend className="sr-only">Réglages du son</legend>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonClass} onClick={() => { session.setVoiceEnabled(false); session.setRitualMix({ voice: 0, music: 0, tone: 0 }) }}>Texte seul</button>
                <button type="button" className={buttonClass} onClick={() => { session.setVoiceEnabled(true); session.setRitualMix({ voice: 0.8, music: 0.3, tone: 0 }) }}>Voix et musique</button>
              </div>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={voiceEnabled} onChange={(event) => session.setVoiceEnabled(event.target.checked)} className="h-5 w-5 accent-teal-300" />Lire le guide à voix haute</label>
              <label htmlFor="ritual-voice-volume" className="block text-sm">Volume de la voix · {Math.round(ritualMix.voice * 100)} %
                <input id="ritual-voice-volume" type="range" min={0} max={100} step={5} disabled={!voiceEnabled} value={Math.round(ritualMix.voice * 100)} onChange={(event) => session.setRitualMix({ ...ritualMix, voice: Number(event.target.value) / 100 })} className="mt-2 block w-full accent-teal-300" />
              </label>
              <label htmlFor="ritual-music-volume" className="block text-sm">Volume de la musique · {Math.round(ritualMix.music * 100)} %
                <input id="ritual-music-volume" type="range" min={0} max={100} step={5} value={Math.round(ritualMix.music * 100)} onChange={(event) => session.setRitualMix({ ...ritualMix, music: Number(event.target.value) / 100 })} className="mt-2 block w-full accent-teal-300" />
              </label>
              <details className="text-sm text-slate-300">
                <summary className="cursor-pointer py-2">Tonalité pure facultative</summary>
                <p className="my-2 leading-relaxed">La mélodie est accordée avec un la à 432 Hz. La tonalité ci-dessous est un son continu séparé, désactivé par défaut.</p>
                <label htmlFor="ritual-tone-volume" className="block">Volume de la tonalité 432 Hz · {Math.round(ritualMix.tone * 100)} %
                  <input id="ritual-tone-volume" type="range" min={0} max={100} step={5} value={Math.round(ritualMix.tone * 100)} onChange={(event) => session.setRitualMix({ ...ritualMix, tone: Number(event.target.value) / 100 })} className="mt-2 block w-full accent-teal-300" />
                </label>
              </details>
            </fieldset>
            <p className="mt-4 text-sm text-slate-300">{hasAudio ? 'Voix française locale si disponible dans ton navigateur ; musique synthétisée pour ce parcours. Commence à volume confortable.' : 'Texte seul : aucun audio demandé.'}</p>
          </section>
        )}

        {session.persistError && <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-950/40 p-4 text-rose-100">{session.persistError}</p>}

        <div className="flex flex-wrap items-center gap-3" aria-label="Commandes du rituel">
          {!running && !ritualCompletion && <button type="button" className={`${buttonClass} bg-teal-300/20`} disabled={!plan || !approved || locked} onClick={() => void session.start()}>{session.starting ? 'Démarrage…' : 'Commencer mon rituel'}</button>}
          {running && !paused && <button type="button" className={buttonClass} onClick={session.pause}>Mettre le rituel en pause</button>}
          {running && paused && <button type="button" className={buttonClass} disabled={session.starting} onClick={() => void session.resume()}>{session.starting ? 'Reprise…' : 'Reprendre le rituel'}</button>}
          {(running || session.starting) && <button type="button" className={buttonClass} onClick={() => session.stop()}>Arrêter le rituel</button>}
          {running && hasAudio && <button type="button" className={buttonClass} disabled={session.starting} onClick={session.muteRitual}>Silence</button>}
          {running && voiceEnabled && ritualMix.voice > 0 && <button type="button" className={buttonClass} disabled={paused || session.starting} onClick={session.replayRitualCue}>Relire l’étape</button>}
          {plan && <button type="button" className={buttonClass} onClick={download}>Exporter mon texte et mon action</button>}
        </div>
        {exportStatus && <p role="status" className="text-sm text-slate-300">{exportStatus}</p>}
        {(running || ritualCompletion) && plan && <details className={cardClass}>
          <summary className="cursor-pointer font-medium">Consulter tout le texte</summary>
          <ol className="mt-4 space-y-4">{plan.cues.map((item) => <li key={item.id}><h3 className="font-medium text-teal-200">{item.title}</h3><p className="mt-1 break-words text-sm leading-relaxed text-slate-200">{item.text}</p></li>)}</ol>
        </details>}
      </div>
    </section>
  )
}
