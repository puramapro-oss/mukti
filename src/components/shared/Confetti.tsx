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
      setParticles([])
      return
    }
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 500,
      size: 4 + Math.random() * 8,
    }))
    setParticles(newParticles)

    const timer = setTimeout(() => setParticles([]), duration)
    return () => clearTimeout(timer)
  }, [active, duration])

  if (particles.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}ms`,
            animationDuration: `${1500 + Math.random() * 1500}ms`,
          }}
        />
      ))}
    </div>
  )
}
