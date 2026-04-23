'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ModeFrame from './ModeFrame'
import { type ModeId } from '@/lib/constants'

const MODE_ID: ModeId = 'micro_meditation'
const DURATION = 30

interface Props {
  addictionId: string
  affirmation: string | null
}

export default function Mode3MicroMeditation({ addictionId, affirmation }: Props) {
  return (
    <ModeFrame modeId={MODE_ID} addictionId={addictionId} durationSec={DURATION}>
      {({ onCompleted }) => <MicroMeditationActive affirmation={affirmation} onCompleted={onCompleted} />}
    </ModeFrame>
  )
}

function MicroMeditationActive({
  affirmation,
  onCompleted,
}: {
  affirmation: string | null
  onCompleted: (outcome?: 'resisted' | 'completed') => void
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= DURATION) {
          clearInterval(timer)
          setTimeout(() => onCompleted('completed'), 300)
          return DURATION
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onCompleted])

  // Bulle qui inspire/expire sur 6s (inspire 3s, expire 3s)
  const cyclePhase = (elapsed % 6) < 3 ? 'inspire' : 'expire'
  const scale = cyclePhase === 'inspire' ? 1 + ((elapsed % 3) / 3) * 0.3 : 1.3 - ((elapsed % 3) / 3) * 0.3

  const message = affirmation ?? 'Tu es exactement là où tu dois être, maintenant.'

  return (
    <div className="flex flex-col items-center gap-10">
      <motion.div
        animate={{ scale }}
        transition={{ duration: 1, ease: 'easeInOut' }}
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, rgba(124,58,237,0.15) 60%, transparent 100%)',
          boxShadow: '0 0 60px rgba(124,58,237,0.4)',
        }}
      >
        <p className="text-xs uppercase tracking-widest text-[var(--text-primary)]">{cyclePhase}</p>
      </motion.div>

      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--cyan)]">Affirmation du moment</p>
        <p className="mt-3 text-2xl leading-relaxed text-[var(--text-primary)]">« {message} »</p>
      </div>

      <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">
        {DURATION - elapsed}s restantes · inspire 3s / expire 3s
      </p>
    </div>
  )
}
