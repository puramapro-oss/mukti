'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  active: boolean
  duration?: number
}

const COLORS = ['#00d4ff', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#6366f1']

interface Particle {
  id: number
  x: number
  color: string
  delay: number
  size: number
}

export default function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => setParticles([]))
      return
    }
    const rng = Math.random
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: rng() * 100,
      color: COLORS[Math.floor(rng() * COLORS.length)],
      delay: rng() * 500,
      size: 4 + rng() * 8,
    }))
    queueMicrotask(() => setParticles(newParticles))

    const timer = setTimeout(() => setParticles([]), duration)
    return () => clearTimeout(timer)
  }, [active, duration])

  if (particles.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {particles.map((p, idx) => {
        const rnd = (p.x * 31 + p.delay * 17 + idx) % 1
        const shape = rnd > 0.5 ? '50%' : '2px'
        const dur = 1500 + (rnd * 1500)
        return (
          <div
            key={p.id}
            className="absolute animate-confetti"
            style={{
              left: `${p.x}%`,
              top: '-10px',
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              borderRadius: shape,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${dur}ms`,
            }}
          />
        )
      })}
    </div>
  )
}
