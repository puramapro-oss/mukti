'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import {
  createMeshOrchestrator,
  AUDIO_CONSTRAINTS,
} from '@/lib/webrtc-mesh'

interface AudioMeshEngineProps {
  circleId: string
  myUserId: string
  micMuted: boolean
  onStreamReady?: () => void
  onRemoteStreamsChange?: (streams: Map<string, MediaStream>) => void
  onSpeakingChange?: (userId: string, speaking: boolean) => void
  onError?: (msg: string) => void
}

/**
 * Moteur audio WebRTC mesh.
 * - Capture micro local
 * - Signaling via Supabase Realtime broadcast channel `mesh-${circleId}`
 * - Full-duplex peer connections (jusqu'à 8 pairs simultanés)
 * - Voice Activity Detection simple par RMS sur l'AudioContext
 */
export default function AudioMeshEngine(props: AudioMeshEngineProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'connecting' | 'ready' | 'error'>('idle')
  const localStreamRef = useRef<MediaStream | null>(null)
  const orchestratorRef = useRef<{ stop: () => void } | null>(null)
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const vadCleanupsRef = useRef<Array<() => void>>([])

  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    async function setup() {
      setStatus('requesting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        stream.getAudioTracks().forEach((t) => (t.enabled = !props.micMuted))

        // VAD sur stream local
        cleanupVad()
        setupVad(stream, props.myUserId, props.onSpeakingChange)

        setStatus('connecting')

        const supabase = createClient()
        const ch: RealtimeChannel = supabase.channel(`mesh-${props.circleId}`, {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: props.myUserId },
          },
        })
        channel = ch

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 10000)
          ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer)
              resolve()
            } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              clearTimeout(timer)
              reject(new Error(status))
            }
          })
        })

        if (cancelled) return

        orchestratorRef.current = createMeshOrchestrator({
          channel: ch,
          myUserId: props.myUserId,
          localStream: stream,
          onRemoteStream: (uid, s) => {
            remoteStreamsRef.current.set(uid, s)
            attachRemoteAudio(uid, s)
            setupVad(s, uid, props.onSpeakingChange)
            props.onRemoteStreamsChange?.(new Map(remoteStreamsRef.current))
          },
          onPeerLeave: (uid) => {
            const el = audioElementsRef.current.get(uid)
            if (el) {
              el.srcObject = null
              el.remove()
              audioElementsRef.current.delete(uid)
            }
            remoteStreamsRef.current.delete(uid)
            props.onRemoteStreamsChange?.(new Map(remoteStreamsRef.current))
          },
        })

        setStatus('ready')
        props.onStreamReady?.()
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        const msg = err instanceof Error ? err.message : 'Erreur audio'
        props.onError?.(msg)
      }
    }

    setup()

    return () => {
      cancelled = true
      orchestratorRef.current?.stop()
      orchestratorRef.current = null
      if (channel) {
        channel.unsubscribe()
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      audioElementsRef.current.forEach((el) => {
        el.srcObject = null
        el.remove()
      })
      audioElementsRef.current.clear()
      remoteStreamsRef.current.clear()
      cleanupVad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.circleId, props.myUserId])

  // Toggle mute dynamique
  useEffect(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((t) => (t.enabled = !props.micMuted))
  }, [props.micMuted])

  function attachRemoteAudio(userId: string, stream: MediaStream) {
    let el = audioElementsRef.current.get(userId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      el.setAttribute('playsinline', 'true')
      document.body.appendChild(el)
      audioElementsRef.current.set(userId, el)
    }
    el.srcObject = stream
    el.play().catch(() => {
      // iOS/Safari require user gesture for autoplay. The CircleRoom main button click will unlock.
    })
  }

  function setupVad(
    stream: MediaStream,
    userId: string,
    onSpeaking?: (uid: string, speaking: boolean) => void,
  ) {
    if (!onSpeaking) return
    try {
      const Ctx: typeof AudioContext =
        typeof window !== 'undefined'
          ? (window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
              AudioContext)
          : AudioContext
      const ctx = new Ctx()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let speaking = false
      let raf = 0
      const loop = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        const nextSpeaking = rms > 0.04
        if (nextSpeaking !== speaking) {
          speaking = nextSpeaking
          onSpeaking(userId, speaking)
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
      vadCleanupsRef.current.push(() => {
        cancelAnimationFrame(raf)
        source.disconnect()
        analyser.disconnect()
        ctx.close().catch(() => {})
      })
    } catch {
      // VAD est optionnel — ne bloque pas l'audio
    }
  }

  function cleanupVad() {
    vadCleanupsRef.current.forEach((fn) => fn())
    vadCleanupsRef.current = []
  }

  return (
    <div className="sr-only" aria-live="polite" data-status={status}>
      {status === 'requesting' && 'Demande d\'accès au micro…'}
      {status === 'connecting' && 'Connexion aux âmes présentes…'}
      {status === 'ready' && 'Audio prêt.'}
      {status === 'error' && 'Audio indisponible.'}
    </div>
  )
}
