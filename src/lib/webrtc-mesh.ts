// MUKTI — G3 WebRTC mesh helpers (≤8 participants)
// Signaling via Supabase Realtime broadcast channel.
// Client-side only : importé dans composants marqués 'use client'.

import type { RealtimeChannel } from '@supabase/supabase-js'

export interface MeshSignal {
  type: 'offer' | 'answer' | 'ice' | 'leave'
  from: string
  to: string | null // null = broadcast
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null
}

export interface MeshPeerState {
  userId: string
  pc: RTCPeerConnection
  stream: MediaStream | null
}

/** Config RTC standard — STUN Google gratuit (suffisant en mesh local-NAT friendly). */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/** Constraints audio-first : echo cancellation + noise suppression + mono 16kbps cible. */
export const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
  video: false,
}

export function createPeerConnection(onIce: (cand: RTCIceCandidateInit) => void, onTrack: (s: MediaStream) => void): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })

  pc.onicecandidate = (e) => {
    if (e.candidate) onIce(e.candidate.toJSON())
  }

  pc.ontrack = (e) => {
    const [stream] = e.streams
    if (stream) onTrack(stream)
  }

  return pc
}

export interface MeshOrchestratorOptions {
  channel: RealtimeChannel
  myUserId: string
  localStream: MediaStream
  onRemoteStream: (userId: string, stream: MediaStream) => void
  onPeerLeave: (userId: string) => void
}

/**
 * Orchestrateur mesh full-duplex.
 * - À l'init, envoie un 'hello' pour que les pairs établissent offers vers nous.
 * - Pour chaque nouvelle arrivée détectée, NOUS envoyons l'offer (règle : userId alphabétique plus petit = offer-maker).
 * - Reçoit offers/answers/ice et maintient un map { userId → RTCPeerConnection }.
 *
 * Retourne un disposable { stop, getPeers }.
 */
export function createMeshOrchestrator(opts: MeshOrchestratorOptions) {
  const peers = new Map<string, MeshPeerState>()

  function getOrCreatePeer(otherUserId: string): MeshPeerState {
    const existing = peers.get(otherUserId)
    if (existing) return existing

    const pc = createPeerConnection(
      (cand) => {
        opts.channel.send({
          type: 'broadcast',
          event: 'mesh-signal',
          payload: {
            type: 'ice',
            from: opts.myUserId,
            to: otherUserId,
            payload: cand,
          } satisfies MeshSignal,
        })
      },
      (stream) => {
        const state = peers.get(otherUserId)
        if (state) {
          state.stream = stream
          opts.onRemoteStream(otherUserId, stream)
        }
      },
    )

    opts.localStream.getTracks().forEach((track) => pc.addTrack(track, opts.localStream))

    const state: MeshPeerState = { userId: otherUserId, pc, stream: null }
    peers.set(otherUserId, state)
    return state
  }

  async function sendOffer(otherUserId: string) {
    const { pc } = getOrCreatePeer(otherUserId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    opts.channel.send({
      type: 'broadcast',
      event: 'mesh-signal',
      payload: {
        type: 'offer',
        from: opts.myUserId,
        to: otherUserId,
        payload: offer,
      } satisfies MeshSignal,
    })
  }

  async function handleSignal(signal: MeshSignal) {
    if (signal.to && signal.to !== opts.myUserId) return
    if (signal.from === opts.myUserId) return

    if (signal.type === 'leave') {
      const state = peers.get(signal.from)
      if (state) {
        state.pc.close()
        peers.delete(signal.from)
        opts.onPeerLeave(signal.from)
      }
      return
    }

    const { pc } = getOrCreatePeer(signal.from)

    if (signal.type === 'offer' && signal.payload) {
      await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      opts.channel.send({
        type: 'broadcast',
        event: 'mesh-signal',
        payload: {
          type: 'answer',
          from: opts.myUserId,
          to: signal.from,
          payload: answer,
        } satisfies MeshSignal,
      })
    } else if (signal.type === 'answer' && signal.payload) {
      await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
    } else if (signal.type === 'ice' && signal.payload) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit))
    }
  }

  opts.channel.on('broadcast', { event: 'mesh-signal' }, (msg) => {
    const payload = msg.payload as MeshSignal
    handleSignal(payload).catch(() => {
      /* noop — peer transient errors */
    })
  })

  opts.channel.on('broadcast', { event: 'mesh-hello' }, (msg) => {
    const fromId = (msg.payload as { userId: string }).userId
    if (fromId === opts.myUserId) return
    // règle : celui dont userId est lexicographiquement < envoie l'offer
    if (opts.myUserId < fromId) {
      sendOffer(fromId).catch(() => {})
    }
  })

  // annonce soi-même
  setTimeout(() => {
    opts.channel.send({
      type: 'broadcast',
      event: 'mesh-hello',
      payload: { userId: opts.myUserId },
    })
  }, 500)

  return {
    stop() {
      opts.channel.send({
        type: 'broadcast',
        event: 'mesh-signal',
        payload: {
          type: 'leave',
          from: opts.myUserId,
          to: null,
          payload: null,
        } satisfies MeshSignal,
      })
      peers.forEach((p) => p.pc.close())
      peers.clear()
    },
    getPeers() {
      return Array.from(peers.values())
    },
  }
}
