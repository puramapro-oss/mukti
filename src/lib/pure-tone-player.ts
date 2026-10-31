import { validateToneProgram, type ToneProgram } from './tone-program'

// Digital gains, NOT calibrated acoustic levels or medical/safety thresholds.
export const TONE_MAX_GAIN = 0.12
export const TONE_INITIAL_GAIN = 0.04
export type ToneStatus = 'idle' | 'starting' | 'playing' | 'error'
export interface ToneGraph { source: AudioBufferSourceNode; gain: GainNode; endAt: number }
const rampSeconds = 0.05
const quiet = (action: () => void) => { try { action() } catch { /* Continue independent cleanup. */ } }
const boundedGain = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(TONE_MAX_GAIN, value)) : 0

/** Used both in the live player and in offline digital rendering tests. */
export function setToneGraphGain(ctx: BaseAudioContext, graph: ToneGraph, volume: number): void {
  const now = ctx.currentTime
  const target = boundedGain(volume)
  const param = graph.gain.gain
  const current = param.value
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now)
  else { param.cancelScheduledValues(now); param.setValueAtTime(current, now) }
  if (target === 0 || now >= graph.endAt) { param.setValueAtTime(0, now); return }
  const reach = Math.min(now + rampSeconds, graph.endAt - rampSeconds)
  if (reach <= now) { param.linearRampToValueAtTime(0, graph.endAt); return }
  param.linearRampToValueAtTime(target, reach)
  param.setValueAtTime(target, graph.endAt - rampSeconds)
  param.linearRampToValueAtTime(0, graph.endAt)
}

export function releaseToneGraph(ctx: BaseAudioContext, graph: ToneGraph): void {
  graph.source.onended = null
  quiet(() => graph.gain.gain.cancelScheduledValues(ctx.currentTime))
  quiet(() => graph.gain.gain.setValueAtTime(0, ctx.currentTime))
  quiet(() => graph.gain.disconnect())
  quiet(() => graph.source.stop())
  quiet(() => graph.source.disconnect())
}

/** One sample-rate-matched, one-second sine loop and one gain. No microphone or network. */
export function createToneGraph(ctx: BaseAudioContext, input: unknown, volume: number): ToneGraph {
  const program = validateToneProgram(input)
  if (!Number.isInteger(ctx.sampleRate) || ctx.sampleRate > 192_000 || ctx.sampleRate <= program.hz * 2) throw new Error('Sortie audio incompatible.')
  const source = ctx.createBufferSource()
  let gain: GainNode | undefined
  try {
    gain = ctx.createGain()
    const graph = { source, gain, endAt: ctx.currentTime + program.seconds }
    // Integer Hz and integer native sample rates close the loop at an exact cycle boundary.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * program.hz * i / ctx.sampleRate)
    source.buffer = buffer
    source.loop = true
    source.playbackRate.setValueAtTime(1, ctx.currentTime)
    source.detune.setValueAtTime(0, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    source.connect(gain)
    gain.connect(ctx.destination)
    setToneGraphGain(ctx, graph, volume)
    source.start()
    source.stop(graph.endAt)
    return graph
  } catch (error) {
    if (gain) quiet(() => gain?.disconnect())
    quiet(() => source.stop())
    quiet(() => source.disconnect())
    throw error
  }
}

export function createPureTonePlayer(notify: (status: ToneStatus, error?: string) => void) {
  type Run = { ctx: AudioContext; graph?: ToneGraph; cancel: () => void; timeout?: ReturnType<typeof setTimeout>; watchdog?: ReturnType<typeof setTimeout>; changed: () => void }
  let active: Run | null = null
  let disposed = false
  let volume = TONE_INITIAL_GAIN
  const emit = (status: ToneStatus, error?: string) => { if (!disposed) quiet(() => notify(status, error)) }

  function stop(status: ToneStatus = 'idle', error?: string): void {
    const run = active
    active = null // Invalidate before any callback/cleanup can fire.
    if (run) {
      clearTimeout(run.timeout)
      clearTimeout(run.watchdog)
      run.cancel()
      quiet(() => run.ctx.removeEventListener('statechange', run.changed))
      if (run.graph) releaseToneGraph(run.ctx, run.graph)
      quiet(() => { void run.ctx.close().catch(() => undefined) })
    }
    emit(status, error)
  }

  async function start(input: ToneProgram): Promise<boolean> {
    if (disposed || active) return false
    let run: Run | undefined
    try {
      const program = validateToneProgram(input)
      if (typeof window === 'undefined') throw new Error('Audio indisponible.')
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) throw new Error('Audio indisponible.')
      const ctx = new Ctx()
      const cancelled = new Promise<never>((_resolve, reject) => {
        run = { ctx, cancel: () => reject(new Error('Lecture annulée.')), changed: () => undefined }
      })
      // Cleanup may occur before Promise.race is reached (for example a broken context).
      void cancelled.catch(() => undefined)
      const current = run!
      active = current
      current.changed = () => {
        if (active === current && current.graph && ctx.state !== 'running') stop()
      }
      ctx.addEventListener('statechange', current.changed)
      emit('starting')
      const deadline = new Promise<never>((_resolve, reject) => {
        current.timeout = setTimeout(() => reject(new Error('Autorisation audio expirée.')), 5_000)
      })
      await Promise.race([ctx.resume(), cancelled, deadline])
      clearTimeout(current.timeout)
      if (disposed || active !== current) return false
      if (ctx.state !== 'running') throw new Error('Audio toujours suspendu.')
      current.graph = createToneGraph(ctx, program, volume)
      current.graph.source.onended = () => { if (active === current) stop() }
      // The audio clock stop is authoritative even if JS timers are throttled.
      current.watchdog = setTimeout(() => { if (active === current) stop() }, program.seconds * 1000 + 250)
      emit('playing')
      return true
    } catch {
      if (!disposed && (!run || active === run)) stop('error', 'Lecture indisponible ou interrompue. Réessaie explicitement.')
      return false
    }
  }

  return {
    start,
    stop: () => stop(),
    setVolume(value: number) {
      volume = boundedGain(value)
      const run = active
      if (run?.graph) {
        try { setToneGraphGain(run.ctx, run.graph, volume) }
        catch { stop('error', 'Réglage audio impossible : lecture arrêtée.') }
      }
    },
    dispose() { if (!disposed) { disposed = true; stop() } },
  }
}
