'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, LogOut, Loader2, AlertTriangle, Flag } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { Circle, CircleParticipant, CircleRotation } from '@/lib/circles'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'
import { useRotationSync } from '@/hooks/useRotationSync'
import ParticipantTile, { type ParticipantTileData } from './ParticipantTile'
import AudioMeshEngine from './AudioMeshEngine'
import AudioSFUEngine from './AudioSFUEngine'
import GuidanceSwitcher from './modes/GuidanceSwitcher'

interface CircleRoomProps {
  circleId: string
  myUserId: string
  myName: string | null
}

interface ParticipantProfile {
  id: string
  full_name: string | null
}

type FetchResponse = {
  ok: boolean
  circle?: Circle
  participants?: CircleParticipant[]
  current_rotation?: CircleRotation | null
  error?: string
}

export default function CircleRoom({ circleId, myUserId, myName }: CircleRoomProps) {
  const router = useRouter()
  const [circle, setCircle] = useState<Circle | null>(null)
  const [participants, setParticipants] = useState<CircleParticipant[]>([])
  const [profiles, setProfiles] = useState<Map<string, ParticipantProfile>>(new Map())
  const [currentRotation, setCurrentRotation] = useState<CircleRotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set())
  const [hasJoined, setHasJoined] = useState(false)
  const [reportOpenFor, setReportOpenFor] = useState<string | null>(null)

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initial fetch + polling
  useEffect(() => {
    let cancelled = false

    async function fetchState() {
      try {
        const res = await fetch(`/api/circles/${circleId}`, { cache: 'no-store' })
        const data: FetchResponse = await res.json()
        if (cancelled) return
        if (!res.ok || !data.ok || !data.circle) {
          setError(data.error ?? 'Cercle introuvable.')
          setLoading(false)
          return
        }
        setCircle(data.circle)
        setParticipants(data.participants ?? [])
        setCurrentRotation(data.current_rotation ?? null)
        setError(null)

        // Fetch profiles pour affichage noms
        const ids = (data.participants ?? []).map((p) => p.user_id)
        if (ids.length > 0) {
          const supabase = createClient()
          const { data: pr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ids)
          if (!cancelled && pr) {
            const map = new Map<string, ParticipantProfile>()
            pr.forEach((p) => map.set(p.id, p as ParticipantProfile))
            setProfiles(map)
          }
        }
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Erreur réseau.')
          setLoading(false)
        }
      }
    }

    fetchState()
    refreshTimerRef.current = setInterval(fetchState, 5000)

    return () => {
      cancelled = true
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [circleId])

  // Auto-join on mount if not already participant
  useEffect(() => {
    if (loading || !circle) return
    const me = participants.find((p) => p.user_id === myUserId && !p.left_at)
    if (me) {
      setHasJoined(true)
      setMicMuted(me.mic_muted)
      return
    }
    if (joining) return
    setJoining(true)
    fetch(`/api/circles/${circleId}/join`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Impossible de rejoindre.')
          setJoining(false)
          return
        }
        setHasJoined(true)
        setJoining(false)
      })
      .catch(() => {
        setError('Erreur lors de l\'entrée dans le cercle.')
        setJoining(false)
      })
  }, [loading, circle, participants, myUserId, circleId, joining])

  // Leave on unmount / window close
  useEffect(() => {
    async function doLeave() {
      if (!hasJoined) return
      try {
        await fetch(`/api/circles/${circleId}/leave`, {
          method: 'POST',
          keepalive: true,
        })
      } catch {
        /* ignore */
      }
    }
    const handleBeforeUnload = () => {
      // keepalive permet d'envoyer la requête même pendant unload
      void doLeave()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      void doLeave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasJoined, circleId])

  function handleSpeakingChange(userId: string, speaking: boolean) {
    setSpeakingIds((prev) => {
      const next = new Set(prev)
      if (speaking) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  async function handleLeave() {
    try {
      await fetch(`/api/circles/${circleId}/leave`, { method: 'POST' })
    } catch {
      /* ignore */
    }
    router.push(circle ? `/dashboard/cercles/${circle.category}` : '/dashboard/cercles')
  }

  async function handleReport(targetUserId: string, reason: 'hate' | 'disruption' | 'medical_claim' | 'spam' | 'harassment' | 'other') {
    try {
      await fetch(`/api/circles/${circleId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_user_id: targetUserId, reason }),
      })
    } catch {
      /* ignore */
    }
    setReportOpenFor(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--cyan)]" />
        <p className="text-sm">Préparation du cercle…</p>
      </div>
    )
  }

  if (error || !circle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-white/80">
        <AlertTriangle className="h-8 w-8 text-red-400" />
        <p className="text-sm">{error ?? 'Cercle introuvable.'}</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/cercles')}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          Retour aux cercles
        </button>
      </div>
    )
  }

  const cat = CIRCLE_CATEGORIES.find((c) => c.id === circle.category)
  const myParticipant = participants.find((p) => p.user_id === myUserId)
  const canAdvance = myParticipant?.role === 'creator' || myParticipant?.role === 'moderator'

  const sync = useRotationSync({
    circleId,
    currentRotation,
    rotationMode: circle.rotation_mode,
    canAdvance,
    circleStatus: circle.status,
  })

  const focusedUserId = sync.focusedUserId
  const focusedProfile = focusedUserId ? profiles.get(focusedUserId) : null

  const tiles: ParticipantTileData[] = participants.map((p) => ({
    userId: p.user_id,
    name: profiles.get(p.user_id)?.full_name ?? null,
    micMuted: p.mic_muted,
    speaking: speakingIds.has(p.user_id),
    isMe: p.user_id === myUserId,
    isFocused: p.user_id === focusedUserId,
  }))

  // Ordering : focused first, then me, then others
  tiles.sort((a, b) => {
    if (a.isFocused && !b.isFocused) return -1
    if (b.isFocused && !a.isFocused) return 1
    if (a.isMe && !b.isMe) return -1
    if (b.isMe && !a.isMe) return 1
    return 0
  })

  const isLarge = participants.length > 20
  const useSFU = circle.audio_mode === 'sfu'

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[#0A0A0F] via-[#0F0A1A] to-[#0A1018] text-white">
      {/* Glow background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(ellipse at top, ${cat?.color ?? '#7C3AED'}20 0%, transparent 60%)`,
        }}
        aria-hidden
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden>{cat?.emoji ?? '🌌'}</span>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">{cat?.name ?? circle.category}</p>
            <h1 className="text-sm font-medium text-white line-clamp-1">{circle.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/60">
            {participants.length}/{circle.max_participants}
          </span>
          <button
            type="button"
            onClick={handleLeave}
            data-testid="room-leave"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30"
          >
            <LogOut className="h-3.5 w-3.5" /> Quitter
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden px-4 pb-4 pt-6 sm:px-8">
        {/* Focus zone */}
        <section className="mb-6 flex flex-col items-center gap-3 text-center">
          {circle.status === 'live' && focusedProfile ? (
            <>
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">On se focalise sur</p>
              <h2
                className="text-3xl font-semibold sm:text-4xl"
                style={{
                  background: 'linear-gradient(90deg, #06B6D4, #7C3AED)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {focusedProfile.full_name ?? 'Une âme'}
              </h2>
              <p className="text-xs text-white/40">
                Donner = Recevoir · Tour {sync.roundNumber || 1}
              </p>
            </>
          ) : circle.status === 'open' ? (
            <>
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">En attente</p>
              <h2 className="text-2xl font-medium text-white/85">
                {participants.length < circle.max_participants && circle.auto_start_when_full
                  ? 'Le cercle démarre dès qu\'il est complet'
                  : 'Les âmes se rassemblent'}
              </h2>
              <p className="text-xs text-white/40">
                {circle.max_participants - participants.length > 0
                  ? `Encore ${circle.max_participants - participants.length} place${circle.max_participants - participants.length > 1 ? 's' : ''}`
                  : 'Complet — démarrage imminent'}
              </p>
            </>
          ) : (
            <h2 className="text-2xl font-medium text-white/85">Session terminée</h2>
          )}
        </section>

        {/* Guidance mode (live only) */}
        {circle.status === 'live' && (
          <section className="mx-auto mb-6 w-full max-w-2xl" data-testid="guidance-zone">
            <GuidanceSwitcher
              guidanceMode={circle.guidance_mode}
              category={circle.category as CircleCategoryId}
              rotationStartedAt={sync.rotation?.started_at ?? null}
              rotationDurationSec={circle.duration_per_person_sec}
              secondsRemaining={sync.secondsRemaining}
              progressPercent={sync.progressPercent}
              focusedName={focusedProfile?.full_name ?? null}
              selectedPhraseIds={Array.isArray(circle.selected_phrase_ids) ? (circle.selected_phrase_ids as string[]) : []}
              locale="fr"
            />
          </section>
        )}

        {/* Tiles grid */}
        <section
          className={`flex-1 overflow-y-auto ${isLarge ? 'grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8' : 'grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}
          data-testid="participants-grid"
        >
          {tiles.map((t) => (
            <div key={t.userId} className="relative">
              <ParticipantTile data={t} size={isLarge ? 'sm' : t.isFocused ? 'lg' : 'md'} />
              {!t.isMe && (
                <button
                  type="button"
                  onClick={() => setReportOpenFor(reportOpenFor === t.userId ? null : t.userId)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/40 opacity-0 transition-opacity hover:bg-black/70 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Signaler ce participant"
                >
                  <Flag className="h-3 w-3" />
                </button>
              )}
              {reportOpenFor === t.userId && !t.isMe && (
                <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-white/10 bg-black/85 p-2 text-xs shadow-2xl backdrop-blur-sm">
                  <p className="mb-1 px-2 py-1 text-[10px] uppercase tracking-wider text-white/40">Signaler pour</p>
                  {(['disruption', 'hate', 'harassment', 'medical_claim', 'spam', 'other'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleReport(t.userId, r)}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-white/75 hover:bg-white/5"
                    >
                      {reportLabel(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Controls */}
        <footer className="relative z-10 mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMicMuted((m) => !m)}
            data-testid="mic-toggle"
            aria-pressed={!micMuted}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              micMuted
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
            disabled={!audioReady}
          >
            {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          {!audioReady && (
            <span className="text-xs text-white/45">Connexion audio…</span>
          )}
        </footer>
      </main>

      {/* Audio engines (invisible) */}
      {hasJoined && (
        useSFU ? (
          <AudioSFUEngine
            circleId={circleId}
            myUserId={myUserId}
            micMuted={micMuted}
            onStreamReady={() => setAudioReady(true)}
            onSpeakingChange={handleSpeakingChange}
            onError={(msg) => setError(msg)}
          />
        ) : (
          <AudioMeshEngine
            circleId={circleId}
            myUserId={myUserId}
            micMuted={micMuted}
            onStreamReady={() => setAudioReady(true)}
            onSpeakingChange={handleSpeakingChange}
            onError={(msg) => setError(msg)}
          />
        )
      )}
      {/* myName used for potential display enhancements */}
      <span className="sr-only">Toi : {myName ?? 'Âme'}</span>
    </div>
  )
}

function reportLabel(r: string): string {
  switch (r) {
    case 'disruption': return 'Perturbation'
    case 'hate': return 'Discours de haine'
    case 'harassment': return 'Harcèlement'
    case 'medical_claim': return 'Fausse promesse médicale'
    case 'spam': return 'Spam / pub'
    default: return 'Autre raison'
  }
}
