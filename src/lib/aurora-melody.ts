/**
 * Original PURAMA melody reused from MUKTI Harmonie PR #2:
 * prototypes/harmonie/harmonie-engine.mjs at
 * b75702a2c4b629e5511af19032c46c9228321533 (MELODY, 72 bpm).
 * Only the note material is reused. AURORA supplies the position and lifecycle;
 * there is no independent timer, AudioContext or asynchronous note queue here.
 */

export type AuroraRitualMix = { voice: number; music: number; tone: number }

export const AURORA_MELODY_REFERENCE_HZ = 432
export const AURORA_MELODY_BPM = 72
export const AURORA_RITUAL_MELODY = Object.freeze([
  Object.freeze({ midi: 69, beats: 1.5 }), Object.freeze({ midi: 72, beats: 0.5 }),
  Object.freeze({ midi: 76, beats: 1 }), Object.freeze({ midi: 74, beats: 1 }),
  Object.freeze({ midi: 72, beats: 1 }), Object.freeze({ midi: 67, beats: 0.5 }),
  Object.freeze({ midi: 64, beats: 1.5 }), Object.freeze({ midi: 69, beats: 1 }),
])

const BEAT_SECONDS = 60 / AURORA_MELODY_BPM
const CYCLE_SECONDS = AURORA_RITUAL_MELODY.reduce((sum, note) => sum + note.beats * BEAT_SECONDS, 0)

/** Validate before changing any channel; finite slider overshoots are clamped. */
export function normalizeRitualMix(mix: AuroraRitualMix): AuroraRitualMix {
  const values = [mix?.voice, mix?.music, mix?.tone]
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new RangeError('Les volumes doivent être des nombres finis entre 0 et 1.')
  }
  const bounded = (value: number) => Math.max(0, Math.min(1, value))
  return { voice: bounded(mix.voice), music: bounded(mix.music), tone: bounded(mix.tone) }
}

export function melodyAtPosition(elapsedSec: number) {
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) return null
  const cycle = Math.floor(elapsedSec / CYCLE_SECONDS)
  const position = elapsedSec - cycle * CYCLE_SECONDS
  let start = 0
  for (let index = 0; index < AURORA_RITUAL_MELODY.length; index += 1) {
    const note = AURORA_RITUAL_MELODY[index]
    const duration = note.beats * BEAT_SECONDS
    if (position < start + duration || index === AURORA_RITUAL_MELODY.length - 1) {
      return {
        key: cycle * AURORA_RITUAL_MELODY.length + index,
        frequencyHz: AURORA_MELODY_REFERENCE_HZ * 2 ** ((note.midi - 69) / 12),
        remainingSec: Math.max(0, start + duration * 0.94 - position),
      }
    }
    start += duration
  }
  return null
}

interface NoteNode { oscillator: OscillatorNode; envelope: GainNode }

/** Web Audio envelopes schedule only the current note, never a future sequence. */
export function createAuroraRitualLayers(ctx: AudioContext, master: GainNode) {
  const music = ctx.createGain()
  const tone = ctx.createGain()
  music.gain.value = 0
  tone.gain.value = 0
  music.connect(master)
  tone.connect(master)
  let mix: AuroraRitualMix = { voice: 0, music: 0, tone: 0 }
  let running = false
  let disposed = false
  let ducked = false
  let position = 0
  let noteKey: number | null = null
  let noteNode: NoteNode | null = null
  let toneNode: OscillatorNode | null = null

  function setLevel(param: AudioParam, value: number) {
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    // A zero slider must cancel even a previously scheduled fade/duck restore.
    if (value === 0) param.setValueAtTime(0, now)
    else {
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(value, now + 0.08)
    }
  }

  function levels() {
    const audible = running && !disposed
    setLevel(music.gain, audible ? mix.music * (ducked ? 0.25 : 1) : 0)
    // A separate sine oscillator, not the tuning reference of the melody.
    setLevel(tone.gain, audible ? mix.tone * 0.12 : 0)
  }

  function stopNote() {
    const node = noteNode
    noteNode = null
    noteKey = null
    if (!node) return
    node.oscillator.onended = null
    node.envelope.gain.cancelScheduledValues(ctx.currentTime)
    node.envelope.gain.setValueAtTime(0, ctx.currentTime)
    try { node.oscillator.stop() } catch { /* Already ended. */ }
    node.oscillator.disconnect()
    node.envelope.disconnect()
  }

  function stopTone() {
    if (!toneNode) return
    try { toneNode.stop() } catch { /* Already ended. */ }
    toneNode.disconnect()
    toneNode = null
  }

  function renderPosition() {
    if (!running || disposed || mix.music === 0) return
    const current = melodyAtPosition(position)
    if (!current || current.key === noteKey) return
    stopNote()
    noteKey = current.key
    // Preserve the space between notes and skip missed notes after a slow frame.
    if (current.remainingSec <= 0.035) return
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = current.frequencyHz
    const now = ctx.currentTime
    const end = now + current.remainingSec
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(0.25, now + Math.min(0.03, current.remainingSec / 3))
    envelope.gain.exponentialRampToValueAtTime(0.025, end - 0.01)
    envelope.gain.linearRampToValueAtTime(0, end)
    oscillator.connect(envelope)
    envelope.connect(music)
    const node = { oscillator, envelope }
    noteNode = node
    oscillator.onended = () => {
      oscillator.disconnect()
      envelope.disconnect()
      if (noteNode === node) noteNode = null
    }
    oscillator.start(now)
    oscillator.stop(end + 0.01)
  }

  function renderTone() {
    if (!running || disposed || mix.tone === 0 || toneNode) return
    toneNode = ctx.createOscillator()
    toneNode.type = 'sine'
    toneNode.frequency.value = AURORA_MELODY_REFERENCE_HZ
    toneNode.connect(tone)
    toneNode.start()
  }

  return {
    setMix(next: AuroraRitualMix) {
      if (disposed) return
      mix = { ...next }
      levels()
      if (mix.music === 0) stopNote()
      if (mix.tone === 0) stopTone()
      renderPosition()
      renderTone()
    },
    setPosition(elapsedSec: number) {
      if (disposed || !Number.isFinite(elapsedSec) || elapsedSec < 0) return
      if (elapsedSec < position) stopNote()
      position = elapsedSec
      renderPosition()
    },
    setRunning(next: boolean) {
      if (disposed) return
      running = next
      levels()
      if (!running) { stopNote(); stopTone() }
      else { renderPosition(); renderTone() }
    },
    setDucked(next: boolean) {
      if (disposed) return
      ducked = next
      levels()
    },
    dispose() {
      if (disposed) return
      running = false
      disposed = true
      levels()
      stopNote()
      stopTone()
      music.disconnect()
      tone.disconnect()
    },
  }
}
