import { analyzeFrequency } from './frequency-analysis.ts'

export type FrequencyReading = ReturnType<typeof analyzeFrequency>
export type FrequencyMeterState = {
  status: 'idle' | 'requesting' | 'listening' | 'error' | 'unavailable'
  message: string
  reading: FrequencyReading | null
  stable: boolean
  processing: 'reported-off' | 'active' | 'unknown'
}

export const INITIAL_FREQUENCY_STATE: FrequencyMeterState = {
  status: 'idle',
  message: 'Le microphone reste éteint tant que tu ne démarres pas la mesure.',
  reading: null,
  stable: false,
  processing: 'unknown',
}

/** A local microphone meter. No recording, peer connection, upload or audio output. */
export function createLocalFrequencyMeter(onChange: (state: FrequencyMeterState) => void) {
  let generation = 0
  let disposed = false
  let busy = false
  let state = INITIAL_FREQUENCY_STATE
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let input: MediaStreamAudioSourceNode | null = null
  let analyser: AnalyserNode | null = null
  let requestTimeout: ReturnType<typeof setTimeout> | undefined
  let interval: ReturnType<typeof setInterval> | undefined
  let warmup: ReturnType<typeof setTimeout> | undefined
  let sessionTimeout: ReturnType<typeof setTimeout> | undefined
  let cancelPendingStart: (() => void) | null = null
  const removeListeners: Array<() => void> = []

  function emit(next: FrequencyMeterState) {
    state = next
    if (!disposed) onChange(next)
  }

  function safely(action: () => void) {
    try { action() } catch { /* Continue releasing the other resources. */ }
  }

  function stopTracks(media: MediaStream) {
    for (const track of media.getTracks()) safely(() => track.stop())
  }

  function release() {
    cancelPendingStart?.()
    cancelPendingStart = null
    clearTimeout(requestTimeout)
    clearTimeout(warmup)
    clearTimeout(sessionTimeout)
    clearInterval(interval)
    requestTimeout = warmup = sessionTimeout = undefined
    interval = undefined
    removeListeners.splice(0).forEach((remove) => safely(remove))
    if (input) safely(() => input!.disconnect())
    if (analyser) safely(() => analyser!.disconnect())
    if (stream) stopTracks(stream)
    if (context && context.state !== 'closed') {
      const current = context
      safely(() => { void current.close().catch(() => undefined) })
    }
    context = stream = input = analyser = null
    busy = false
  }

  function stop(message = 'Mesure arrêtée. Microphone libéré.') {
    generation += 1
    release()
    emit({ ...INITIAL_FREQUENCY_STATE, message })
  }

  function fail(message: string, status: 'error' | 'unavailable' = 'error') {
    generation += 1
    release()
    emit({ ...INITIAL_FREQUENCY_STATE, status, message })
  }

  function listen(target: EventTarget, name: string, callback: EventListener) {
    target.addEventListener(name, callback)
    removeListeners.push(() => target.removeEventListener(name, callback))
  }

  async function start() {
    if (disposed || busy) return
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return
    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !AudioContextClass) {
      fail('La mesure nécessite un microphone autorisé et un navigateur compatible sur une connexion sécurisée.', 'unavailable')
      return
    }
    const pageIsHidden = () => document.visibilityState === 'hidden'
    if (pageIsHidden()) return
    const ticket = ++generation
    busy = true
    emit({ ...INITIAL_FREQUENCY_STATE, status: 'requesting', message: 'Autorise le microphone pour cette mesure locale.' })
    const isCurrent = () => !disposed && generation === ticket
    let attemptTimeout: ReturnType<typeof setTimeout> | undefined
    const cancellation = new Promise<never>((_, reject) => {
      cancelPendingStart = () => reject(new Error('capture-cancelled'))
    })
    // Also handle early failures before the cancellation promise joins the race.
    void cancellation.catch(() => undefined)
    const interrupt = () => { if (isCurrent()) stop('Mesure interrompue. Relance-la pour obtenir une nouvelle valeur.') }
    // The permission dialog can outlive visibility or navigation changes.
    listen(document, 'visibilitychange', () => { if (pageIsHidden()) interrupt() })
    listen(window, 'pagehide', interrupt)

    try {
      let ctx: AudioContext
      try { ctx = new AudioContextClass({ sampleRate: 48000 }) }
      catch { ctx = new AudioContextClass() }
      context = ctx
      if (!Number.isFinite(ctx.sampleRate) || ctx.sampleRate < 8000 || ctx.sampleRate > 65536) {
        fail('Le format audio disponible ne permet pas cette mesure. Utilise un format compatible, par exemple 44,1 ou 48 kHz.', 'unavailable')
        return
      }
      const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {}
      const audio: MediaTrackConstraints = { channelCount: { ideal: 1 } }
      for (const name of ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const) {
        if (supported[name]) audio[name] = { ideal: false }
      }

      // Permission requests cannot be aborted: discard and stop a late stream.
      const mediaPromise = navigator.mediaDevices.getUserMedia({ audio, video: false }).then((media) => {
        if (!isCurrent()) stopTracks(media)
        else stream = media
        return media
      })
      void mediaPromise.catch(() => undefined)
      const timeout = new Promise<never>((_, reject) => {
        attemptTimeout = setTimeout(() => reject(new Error('capture-timeout')), 15000)
        requestTimeout = attemptTimeout
      })
      const [media] = await Promise.race([Promise.all([mediaPromise, ctx.resume()]), timeout, cancellation])
      clearTimeout(attemptTimeout)
      if (requestTimeout === attemptTimeout) requestTimeout = undefined
      if (!isCurrent()) { stopTracks(media); return }
      cancelPendingStart = null
      if (pageIsHidden()) { interrupt(); return }
      const track = media.getAudioTracks()[0]
      if (!track || track.readyState !== 'live' || track.muted || ctx.state !== 'running') {
        fail('Le microphone ne fournit pas de signal actif. Réessaie après avoir vérifié ses réglages.')
        return
      }
      const settings = track.getSettings()
      const flags = [settings.echoCancellation, settings.noiseSuppression, settings.autoGainControl]
      const processing = flags.some((value) => value === true) ? 'active'
        : flags.every((value) => value === false) ? 'reported-off' : 'unknown'
      const meter = ctx.createAnalyser()
      meter.fftSize = 32768
      meter.smoothingTimeConstant = 0
      analyser = meter
      input = ctx.createMediaStreamSource(media)
      input.connect(meter)
      // Never connect the microphone/analyser to ctx.destination.
      const samples = new Float32Array(meter.fftSize)
      let consecutive = 0
      let lastHz: number | null = null
      emit({ ...INITIAL_FREQUENCY_STATE, status: 'listening', message: 'Écoute locale en cours. Préparation de la première mesure…', processing })

      listen(track, 'ended', interrupt)
      listen(track, 'mute', interrupt)
      listen(ctx, 'statechange', () => { if (ctx.state !== 'running') interrupt() })

      function sample() {
        if (!isCurrent()) return
        if (track.readyState !== 'live' || track.muted || ctx.state !== 'running') { interrupt(); return }
        try {
          meter.getFloatTimeDomainData(samples)
          // Buffers use the AudioContext sample rate, including any input resampling.
          const reading = analyzeFrequency(samples, ctx.sampleRate, 432)
          const hz = reading.dominantHz
          if (reading.status === 'near_target' && hz !== null) {
            consecutive = lastHz !== null && Math.abs(hz - lastHz) <= 1 ? consecutive + 1 : 1
            lastHz = hz
          } else { consecutive = 0; lastHz = null }
          emit({ status: 'listening', message: 'Fréquence estimée à partir du microphone.', reading, stable: consecutive >= 3, processing })
        } catch {
          fail('Le signal n’a pas pu être analysé. Le microphone a été arrêté.')
        }
      }

      warmup = setTimeout(() => {
        if (!isCurrent()) return
        sample()
        if (isCurrent()) interval = setInterval(sample, 300)
      }, Math.ceil(1000 * samples.length / ctx.sampleRate) + 100)
      sessionTimeout = setTimeout(() => { if (isCurrent()) stop('Mesure arrêtée après une minute. Microphone libéré.') }, 60000)
    } catch (error) {
      if (!isCurrent()) return
      const name = error instanceof Error ? error.name : ''
      const message = error instanceof Error ? error.message : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') fail('Accès au microphone refusé. Aucune mesure effectuée.')
      else if (name === 'NotFoundError') fail('Aucun microphone disponible sur cet appareil.', 'unavailable')
      else if (message === 'capture-timeout') fail('Le microphone n’a pas répondu à temps. Tu peux réessayer.')
      else fail('Le microphone est indisponible ou déjà utilisé. Aucune mesure confirmée.')
    }
  }

  return {
    start,
    stop,
    dispose() { if (!disposed) { disposed = true; stop() } },
    getState: () => state,
  }
}
