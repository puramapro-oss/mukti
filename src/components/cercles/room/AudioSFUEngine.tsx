'use client'

import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant, type LocalTrackPublication } from 'livekit-client'

interface AudioSFUEngineProps {
  circleId: string
  myUserId: string
  micMuted: boolean
  onStreamReady?: () => void
  onSpeakingChange?: (userId: string, speaking: boolean) => void
  onRemoteParticipantsChange?: (ids: string[]) => void
  onError?: (msg: string) => void
}

/**
 * Moteur audio LiveKit SFU (grands groupes > 8).
 * - Token JWT récupéré via /api/circles/[id]/livekit-token
 * - Publication piste micro locale
 * - Abonnement automatique aux pistes des participants distants
 * - Active speaker detection via LiveKit built-in
 */
export default function AudioSFUEngine(props: AudioSFUEngineProps) {
  const [status, setStatus] = useState<'idle' | 'fetching_token' | 'connecting' | 'ready' | 'error'>('idle')
  const roomRef = useRef<Room | null>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function setup() {
      setStatus('fetching_token')
      try {
        const res = await fetch(`/api/circles/${props.circleId}/livekit-token`, { method: 'POST' })
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error((j?.error as string) ?? 'Token refusé.')
        }
        const { token, url } = await res.json() as { token: string; url: string }

        if (cancelled) return

        setStatus('connecting')
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            audioPreset: { maxBitrate: 32_000 },
            dtx: true,
            red: true,
          },
        })
        roomRef.current = room

        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
        room.on(RoomEvent.ParticipantConnected, emitParticipants)
        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          const el = audioElementsRef.current.get(p.identity)
          if (el) {
            el.srcObject = null
            el.remove()
            audioElementsRef.current.delete(p.identity)
          }
          emitParticipants()
        })
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          const speakerIds = new Set(speakers.map((s) => s.identity))
          room.remoteParticipants.forEach((p) => {
            props.onSpeakingChange?.(p.identity, speakerIds.has(p.identity))
          })
          props.onSpeakingChange?.(props.myUserId, speakerIds.has(props.myUserId))
        })

        await room.connect(url, token)
        if (cancelled) {
          await room.disconnect()
          return
        }

        // Publie micro local si non muté
        if (!props.micMuted) {
          await room.localParticipant.setMicrophoneEnabled(true)
        }

        setStatus('ready')
        emitParticipants()
        props.onStreamReady?.()
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        const msg = err instanceof Error ? err.message : 'Erreur audio grand groupe.'
        props.onError?.(msg)
      }
    }

    function handleTrackSubscribed(
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) {
      if (track.kind !== Track.Kind.Audio) return
      const audio = track.attach()
      audio.setAttribute('playsinline', 'true')
      audio.autoplay = true
      document.body.appendChild(audio)
      const existing = audioElementsRef.current.get(participant.identity)
      if (existing) {
        existing.remove()
      }
      audioElementsRef.current.set(participant.identity, audio)
    }

    function handleTrackUnsubscribed(track: RemoteTrack) {
      track.detach().forEach((el) => el.remove())
    }

    function emitParticipants() {
      const room = roomRef.current
      if (!room) return
      const ids = Array.from(room.remoteParticipants.keys())
      props.onRemoteParticipantsChange?.(ids)
    }

    setup()

    return () => {
      cancelled = true
      audioElementsRef.current.forEach((el) => {
        el.srcObject = null
        el.remove()
      })
      audioElementsRef.current.clear()
      const room = roomRef.current
      if (room) {
        room.disconnect().catch(() => {})
        roomRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.circleId, props.myUserId])

  // Toggle mic dynamique
  useEffect(() => {
    const room = roomRef.current
    if (!room) return
    room.localParticipant.setMicrophoneEnabled(!props.micMuted).catch(() => {})

    const pubs: LocalTrackPublication[] = Array.from(room.localParticipant.trackPublications.values())
    pubs.forEach((p) => {
      if (props.micMuted) p.mute()
      else p.unmute()
    })
  }, [props.micMuted])

  return (
    <div className="sr-only" aria-live="polite" data-status={status}>
      {status === 'fetching_token' && 'Préparation audio grand groupe…'}
      {status === 'connecting' && 'Connexion au serveur relais…'}
      {status === 'ready' && 'Audio grand groupe prêt.'}
      {status === 'error' && 'Audio grand groupe indisponible.'}
    </div>
  )
}
