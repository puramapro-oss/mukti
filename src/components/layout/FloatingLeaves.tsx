'use client'

import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  drift: number
  driftSpeed: number
  driftPhase: number
  rotation: number
  rotationSpeed: number
  hue: number
  alpha: number
  emoji: string
}

const EMOJIS = ['🌱', '🍃', '🌿', '✨']

export default function FloatingLeaves() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      if (!canvas || !ctx) return
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }

    function spawnParticle(): Particle {
      const w = window.innerWidth
      const h = window.innerHeight
      return {
        x: Math.random() * w,
        y: h + Math.random() * 60,
        size: 14 + Math.random() * 14,
        speedY: 0.15 + Math.random() * 0.35,
        speedX: (Math.random() - 0.5) * 0.15,
        drift: 30 + Math.random() * 40,
        driftSpeed: 0.0008 + Math.random() * 0.0012,
        driftPhase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.008,
        hue: 140 + Math.random() * 30,
        alpha: 0.18 + Math.random() * 0.22,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!,
      }
    }

    const isMobile = window.innerWidth < 768
    const targetCount = isMobile ? 12 : 22
    particlesRef.current = Array.from({ length: targetCount }, () => {
      const p = spawnParticle()
      p.y = Math.random() * window.innerHeight
      return p
    })

    resize()
    window.addEventListener('resize', resize)

    let lastTime = performance.now()

    function tick(time: number) {
      if (!canvas || !ctx) return
      const dt = Math.min(50, time - lastTime)
      lastTime = time

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particlesRef.current) {
        p.y -= p.speedY * dt * 0.06
        p.driftPhase += p.driftSpeed * dt
        const driftX = Math.sin(p.driftPhase) * p.drift
        p.x += p.speedX * dt * 0.06
        p.rotation += p.rotationSpeed * dt * 0.06

        if (p.y < -40) {
          Object.assign(p, spawnParticle())
        }
        if (p.x < -40) p.x = window.innerWidth + 20
        if (p.x > window.innerWidth + 40) p.x = -20

        ctx.save()
        ctx.translate(p.x + driftX, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.alpha
        ctx.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.emoji, 0, 0)
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
