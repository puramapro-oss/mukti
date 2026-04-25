'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'
import { safeVibrate } from '@/lib/accessibility'

const MODE_ID: ModeId = 'multisensoriel'
const DURATION = 180 // 3 minutes

// Respiration 4-7-8 (Dr Weil) : inspire 4s, retiens 7s, expire 8s → 19s par cycle
const BREATH_CYCLE = [
  { phase: 'Inspire', duration: 4, color: '#06B6D4' },
  { phase: 'Retiens', duration: 7, color: '#7C3AED' },
  { phase: 'Expire', duration: 8, color: '#10B981' },
]

interface Props {
  addictionId: string
}

export default function Mode2MultisensorielUltime({ addictionId }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId} durationSec={DURATION}>
      {({ onCompleted }) => <MultisensorielActive onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function MultisensorielActive({ onCompleted }: { onCompleted: (outcome?: 'resisted' | 'completed') => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [cycleSec, setCycleSec] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      audioCtxRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.value = 0.035
      gain.connect(ctx.destination)
      // Drone 528Hz (fréquence miracle / amour) + 3ème harmonique faible
      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 528
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 174
      osc1.connect(gain)
      osc2.connect(gain)
      osc1.start()
      osc2.start()
      return () => {
        try {
          osc1.stop()
          osc2.stop()
          ctx.close()
        } catch {
          /* ignore */
        }
      }
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= DURATION) {
          clearInterval(timer)
          setTimeout(() => onCompleted('resisted'), 300)
          return DURATION
        }
        return next
      })
      setCycleSec(c => (c + 1) % 19)
      // Vibration sur chaque transition de phase (G8.7.6 safeVibrate)
      const c = cycleSec
      if (c === 0 || c === 4 || c === 11) void safeVibrate(60)
    }, 1000)
    return () => clearInterval(timer)
  }, [onCompleted, cycleSec])

  // Détermine la phase courante
  let phaseIdx = 0
  let phaseElapsed = cycleSec
  for (let i = 0; i < BREATH_CYCLE.length; i++) {
    if (phaseElapsed < BREATH_CYCLE[i].duration) {
      phaseIdx = i
      break
    }
    phaseElapsed -= BREATH_CYCLE[i].duration
  }
  const phase = BREATH_CYCLE[phaseIdx]
  const phaseProgress = phaseElapsed / phase.duration

  // Scale : inspire→1.2, retiens→1.2, expire→0.8
  const targetScale = phaseIdx === 0 ? 0.8 + 0.4 * phaseProgress : phaseIdx === 1 ? 1.2 : 1.2 - 0.4 * phaseProgress

  const remaining = DURATION - elapsed
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-12 overflow-hidden">
      {/* Spirales de fond */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            animate={{ rotate: 360 * (i % 2 === 0 ? 1 : -1) }}
            transition={{ duration: 30 / i, repeat: Infinity, ease: 'linear' }}
            className="absolute rounded-full border"
            style={{
              width: `${200 * i}px`,
              height: `${200 * i}px`,
              borderColor: `${phase.color}${i === 1 ? '60' : i === 2 ? '30' : i === 3 ? '15' : '08'}`,
              borderStyle: 'dashed',
            }}
          />
        ))}
      </div>

      {/* Bulle respiration centrale */}
      <motion.div
        animate={{ scale: targetScale }}
        transition={{ duration: 1, ease: 'easeInOut' }}
        className="relative flex h-48 w-48 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle, ${phase.color}40 0%, ${phase.color}10 70%, transparent 100%)`,
          boxShadow: `0 0 80px ${phase.color}60`,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-xl font-semibold text-[var(--text-primary)]">{phase.phase}</p>
          <p className="text-xs uppercase tracking-widest" style={{ color: phase.color }}>
            {Math.max(1, phase.duration - Math.floor(phaseElapsed))}s
          </p>
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="text-lg text-[var(--text-primary)]">
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
        <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
          4-7-8 · 528 Hz · vibrations douces
        </p>
      </div>
    </div>
  )
}
