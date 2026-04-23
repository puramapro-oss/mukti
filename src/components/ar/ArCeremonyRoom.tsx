'use client'

// MUKTI — G4.7 ArCeremonyRoom
// Pages dispatch : joined? not joined? live? upcoming? finished?
// Synchro via useCeremonySync (postgres_changes + timer).

import { useCallback, useState } from 'react'
import { Calendar, Camera, CameraOff, Eye, LogIn, LogOut, Sparkles, Users } from 'lucide-react'
import { useCameraPermission } from '@/hooks/useCameraPermission'
import { useCeremonySync } from '@/hooks/useCeremonySync'
import ARCanvas from '@/components/ar/ARCanvas'
import SpeciesMorph from '@/components/ar/SpeciesMorph'
import AuraPet, { type AuraIntention } from '@/components/ar/AuraPet'
import CeremonyCountdown from '@/components/ar/CeremonyCountdown'
import ParticipantsCount from '@/components/ar/ParticipantsCount'
import type { ArCeremonyWithCount } from '@/lib/ar-ceremony'
import type { ArSpeciesSlug } from '@/lib/constants'

interface Props {
  ceremonyId: string
  initial: ArCeremonyWithCount
}

export default function ArCeremonyRoom({ ceremonyId, initial }: Props) {
  const cam = useCameraPermission('user')
  const sync = useCeremonySync(ceremonyId)
  const ceremony = sync.ceremony ?? initial
  const [joined, setJoined] = useState<boolean>(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const handleJoin = useCallback(async () => {
    setJoining(true)
    setError(null)
    try {
      const res = await fetch(`/api/ar/ceremonies/${ceremonyId}/join`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Impossible de rejoindre.')
        setJoining(false)
        return
      }
      setJoined(true)
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setJoining(false)
    }
  }, [ceremonyId])

  const handleLeave = useCallback(
    async (completed: boolean = false) => {
      setLeaving(true)
      try {
        await fetch(`/api/ar/ceremonies/${ceremonyId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        })
      } catch {
        // graceful — session reste locale
      }
      setJoined(false)
      setLeaving(false)
    },
    [ceremonyId],
  )

  const phaseLabel = ceremony.status === 'live' ? 'live' : ceremony.status === 'upcoming' ? 'upcoming' : ceremony.status
  const speciesHint: ArSpeciesSlug = (ceremony.species_hint as ArSpeciesSlug | null) ?? 'humain'
  const intention = (ceremony.intention_category as AuraIntention) ?? 'paix'
  const scheduledLabel = new Date(ceremony.scheduled_at).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  // ====================================================================
  // VUE : pas encore rejoint (upcoming ou live)
  // ====================================================================
  if (!joined) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Moment Z · {phaseLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{ceremony.title}</h1>
          {ceremony.description && (
            <p className="mt-2 max-w-xl text-sm text-white/65">{ceremony.description}</p>
          )}
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            icon={Calendar}
            label="Rendez-vous"
            value={scheduledLabel}
            hint={`${Math.floor(ceremony.duration_sec / 60)} minutes`}
          />
          <InfoCard
            icon={Users}
            label="Participants"
            value={String(sync.participantsCount || initial.participants_count)}
            hint={`${(sync.participantsCount || initial.participants_count) > 1 ? 'présences confirmées' : 'présence confirmée'}`}
          />
        </div>

        <div className="flex justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-8">
          <CeremonyCountdown
            phase={sync.phase}
            secondsUntilStart={sync.secondsUntilStart}
            secondsRemaining={sync.secondsRemaining}
          />
        </div>

        {ceremony.status === 'finished' && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/65">
            Cette cérémonie est terminée. Reviens à la prochaine 🌿
          </div>
        )}

        {ceremony.status !== 'finished' && ceremony.status !== 'cancelled' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              data-testid="ceremony-join"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? <Sparkles className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {ceremony.status === 'live' ? 'Entrer maintenant' : 'Je serai là'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ====================================================================
  // VUE : rejoint — affichage AR + countdown selon phase
  // ====================================================================
  const gateVisible =
    cam.status === 'idle' || cam.status === 'denied' || cam.status === 'unavailable'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            {sync.phase === 'live' ? 'en direct' : sync.phase === 'starting' ? 'ça commence' : sync.phase}
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">{ceremony.title}</p>
        </div>
        <ParticipantsCount count={sync.participantsCount || initial.participants_count} />
      </header>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black sm:aspect-video">
        <ARCanvas
          stream={cam.status === 'granted' ? cam.stream : null}
          enabled={cam.status === 'granted'}
        >
          <SpeciesMorph species={speciesHint} showHands={cam.status === 'granted'} />
          <AuraPet intention={intention} />
        </ARCanvas>

        {/* Overlay countdown — positionné différemment selon phase */}
        {sync.phase !== 'live' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-sm">
            <CeremonyCountdown
              phase={sync.phase}
              secondsUntilStart={sync.secondsUntilStart}
              secondsRemaining={sync.secondsRemaining}
            />
          </div>
        )}

        {sync.phase === 'live' && (
          <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-xs font-mono text-white backdrop-blur">
            {formatMMSS(sync.secondsRemaining)}
          </div>
        )}

        {cam.status === 'imaginary' && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/60 backdrop-blur">
            <Eye className="mr-1 inline h-3 w-3" /> mode imaginaire
          </div>
        )}

        {gateVisible && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center backdrop-blur">
            {cam.status === 'idle' && (
              <>
                <Camera className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">
                  Autorise la caméra — ou reste en mode imaginaire, la synchro fonctionne quand même.
                </p>
                <button
                  type="button"
                  onClick={cam.request}
                  className="rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Autoriser la caméra
                </button>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="text-xs text-white/60 underline-offset-4 hover:underline"
                >
                  Mode imaginaire
                </button>
              </>
            )}
            {(cam.status === 'denied' || cam.status === 'unavailable') && (
              <>
                <CameraOff className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">{cam.error}</p>
                <button
                  type="button"
                  onClick={cam.useImaginaryMode}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
                >
                  Mode imaginaire
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => handleLeave(false)}
          disabled={leaving}
          data-testid="ceremony-leave"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" /> Quitter
        </button>
        {sync.phase === 'live' && (
          <button
            type="button"
            onClick={() => handleLeave(true)}
            disabled={leaving}
            data-testid="ceremony-seal"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-4 py-2 text-xs text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" /> Sceller ma présence
          </button>
        )}
      </div>

      {sync.phase === 'finished' && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/65">
          La cérémonie est terminée. Merci d&apos;avoir été là 🌿
        </div>
      )}
    </div>
  )
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <Icon className="mt-1 h-4 w-4 shrink-0 text-[var(--cyan)]" />
      <div className="flex min-w-0 flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-white/45">{hint}</p>}
      </div>
    </div>
  )
}
