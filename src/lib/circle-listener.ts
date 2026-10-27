// Receive-only audio for an already authorised circle member.
// This shares the existing SFU and token route; it never captures a microphone.
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication } from 'livekit-client'
import { auroraRequest } from './aurora-session-api'

export type CircleListenerState = 'connecting' | 'connected' | 'reconnecting' | 'playback-blocked' | 'stopped' | 'error'
export interface CircleListenerOptions {
  circleId: string
  volume?: number
  onState?: (state: CircleListenerState) => void
  onError?: (message: string) => void
}
export interface CircleListenerHandle {
  start: () => Promise<void>
  stop: () => void
  setVolume: (value: number) => void
  resumeAudio: () => Promise<void>
}

/** One handle represents one explicit listening attempt. Create a new one to retry. */
export function createCircleListener(options: CircleListenerOptions): CircleListenerHandle {
  const controller = new AbortController()
  const outputs = new Map<RemoteTrack, HTMLMediaElement[]>()
  let room: Room | null = null
  let started = false
  let stopped = false
  let connected = false
  let volume = boundedVolume(options.volume ?? 0.25)
  const cleanup = (action: () => void) => { try { action() } catch { /* Keep silencing other outputs. */ } }
  const notify = (state: CircleListenerState) => { if (!stopped) options.onState?.(state) }
  const disconnect = (target: Room) => {
    cleanup(() => { void Promise.resolve(target.disconnect()).catch(() => undefined) })
  }

  function release(track: RemoteTrack) {
    const elements = outputs.get(track) ?? []
    outputs.delete(track)
    for (const element of elements) {
      cleanup(() => { element.volume = 0 })
      cleanup(() => element.pause())
      cleanup(() => { element.srcObject = null })
      cleanup(() => element.remove())
    }
    cleanup(() => track.detach().forEach((element) => element.remove()))
  }

  function stop() {
    if (stopped) return
    stopped = true
    connected = false
    controller.abort()
    for (const track of [...outputs.keys()]) release(track)
    const current = room
    room = null
    if (current) {
      cleanup(() => current.removeAllListeners())
      disconnect(current)
    }
    options.onState?.('stopped')
  }

  function setVolume(value: number) {
    volume = boundedVolume(value)
    if (stopped) return
    for (const elements of outputs.values()) {
      for (const element of elements) cleanup(() => { element.volume = volume })
    }
  }

  function subscribeAudio(publication: RemoteTrackPublication) {
    if (!stopped && publication.kind === Track.Kind.Audio) publication.setSubscribed(true)
  }

  function receive(track: RemoteTrack) {
    if (stopped || track.kind !== Track.Kind.Audio) return
    release(track)
    try {
      const element = track.attach()
      // Set the local level before inserting the element or starting playback.
      element.volume = volume
      element.autoplay = true
      element.setAttribute('playsinline', 'true')
      outputs.set(track, [element])
      document.body.appendChild(element)
      void element.play().catch(() => notify('playback-blocked'))
    } catch {
      release(track)
      notify('playback-blocked')
    }
  }

  async function resumeAudio() {
    const current = room
    if (!current || stopped || !connected) return
    try {
      await current.startAudio()
      if (!stopped && room === current) notify('connected')
    } catch {
      notify('playback-blocked')
    }
  }

  async function connectWithinDeadline(current: Room, url: string, token: string) {
    const { signal } = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: (() => void) | undefined
    const cancelled = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new DOMException('Connexion interrompue.', 'AbortError'))
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => reject(new Error('Connexion audio trop longue. Réessaie.')), 15_000)
    })
    // Also detach a late connection after Stop or the connection deadline.
    const connecting = current.connect(url, token, { autoSubscribe: false }).then(() => {
      if (stopped || signal.aborted) {
        disconnect(current)
        throw new DOMException('Connexion interrompue.', 'AbortError')
      }
    })
    try {
      await Promise.race([connecting, cancelled])
    } finally {
      clearTimeout(timer)
      if (onAbort) signal.removeEventListener('abort', onAbort)
    }
  }

  async function start() {
    if (started || stopped) return
    started = true
    notify('connecting')
    try {
      const result = await auroraRequest(
        `/api/circles/${encodeURIComponent(options.circleId)}/livekit-token`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listenOnly: true }) },
        controller,
      )
      if (stopped) return
      if (result.listenOnly !== true || typeof result.token !== 'string' || !result.token || typeof result.url !== 'string') {
        throw new Error('Le serveur n’a pas confirmé le mode écoute seule.')
      }
      const address = new URL(result.url)
      if (!['wss:', 'https:'].includes(address.protocol) || address.username || address.password) {
        throw new Error('Adresse du service audio invalide.')
      }
      const current = new Room({ adaptiveStream: true, dynacast: true })
      room = current
      current.on(RoomEvent.TrackPublished, subscribeAudio)
      current.on(RoomEvent.TrackSubscribed, receive)
      current.on(RoomEvent.TrackUnsubscribed, release)
      current.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        notify(current.canPlaybackAudio ? 'connected' : 'playback-blocked')
      })
      current.on(RoomEvent.Reconnecting, () => notify('reconnecting'))
      current.on(RoomEvent.Reconnected, () => notify(current.canPlaybackAudio ? 'connected' : 'playback-blocked'))
      current.on(RoomEvent.Disconnected, () => {
        if (stopped) return
        stop()
        options.onError?.('La connexion audio est fermée. Relance l’écoute pour réessayer.')
      })
      await connectWithinDeadline(current, result.url, result.token)
      if (stopped) return
      connected = true
      current.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach(subscribeAudio)
      })
      notify(current.canPlaybackAudio ? 'connected' : 'playback-blocked')
    } catch (error) {
      if (stopped) return
      const message = error instanceof Error && error.name !== 'AbortError'
        ? error.message : 'Connexion interrompue ou délai dépassé. Réessaie.'
      stop()
      options.onState?.('error')
      options.onError?.(message)
    }
  }

  return { start, stop, setVolume, resumeAudio }
}

function boundedVolume(value: number): number {
  // This is a digital gain, not a calibrated acoustic exposure limit.
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
