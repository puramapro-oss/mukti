'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'

const MODE_ID: ModeId = 'coupure_40s'
const DURATION = 40

const PHRASES = [
  { at: 0, text: 'Inspire profondément. Tu es en sécurité.' },
  { at: 8, text: 'Expire lentement. L\'envie n\'est qu\'une vague.' },
  { at: 16, text: 'Ton cerveau se reset. Laisse-le faire.' },
  { at: 24, text: 'Tu es plus fort·e que cette impulsion.' },
  { at: 32, text: 'Retour doux. Tu as choisi toi.' },
]

interface Props {
  addictionId: string
}

export default function Mode1CoupureInstantanee({ addictionId }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId} durationSec={DURATION}>
      {({ onCompleted }) => <CoupureActive onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function CoupureActive({ onCompleted }: { onCompleted: (outcome?: 'resisted' | 'completed') => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const oscRefs = useRef<{ osc1?: OscillatorNode; osc2?: OscillatorNode; gain?: GainNode }>({})

  useEffect(() => {
    // Web Audio : binaural 200Hz + 207Hz (beat 7Hz = alpha/theta, calm)
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      audioCtxRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.value = 0.04
      gain.connect(ctx.destination)
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 200
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 207
      const pan1 = ctx.createStereoPanner()
      pan1.pan.value = -1
      const pan2 = ctx.createStereoPanner()
      pan2.pan.value = 1
      osc1.connect(pan1).connect(gain)
      osc2.connect(pan2).connect(gain)
      osc1.start()
      osc2.start()
      oscRefs.current = { osc1, osc2, gain }
    } catch {
      /* iOS / autoplay lock — ignore */
    }
    return () => {
      try {
        oscRefs.current.osc1?.stop()
        oscRefs.current.osc2?.stop()
        audioCtxRef.current?.close()
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        const idx = PHRASES.reduce((acc, p, i) => (next >= p.at ? i : acc), 0)
        setPhraseIndex(idx)
        if (next >= DURATION) {
          clearInterval(timer)
          setTimeout(() => onCompleted('resisted'), 300)
          return DURATION
        }
        return next
      })
      if ('vibrate' in navigator) navigator.vibrate(40)
    }, 1000)
    return () => clearInterval(timer)
  }, [onCompleted])

  const progress = elapsed / DURATION
  const remaining = DURATION - elapsed

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="relative h-64 w-64">
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
          <defs>
            <linearGradient id="coupure-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#coupure-grad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={565.48}
            strokeDashoffset={565.48 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-4 rounded-full bg-gradient-to-br from-[var(--cyan)]/20 to-[var(--purple)]/20 blur-xl"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-semibold text-[var(--text-primary)]">{remaining}</span>
          <span className="text-sm text-[var(--text-muted)]">secondes</span>
        </div>
      </div>

      <motion.p
        key={phraseIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md text-center text-xl text-[var(--text-primary)]"
        aria-live="polite"
      >
        {PHRASES[phraseIndex]?.text}
      </motion.p>

      <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
        Binaural 7Hz · Respiration libre
      </p>
    </div>
  )
}
