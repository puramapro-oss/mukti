'use client'

// MUKTI — G4 AR Engine
// Overlay debug : dessine les 33 landmarks pose + 21×2 hands sur un canvas 2D.
// Visible via prop `showDebug` — active par défaut en ?debug=1 ou NODE_ENV=development.

import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  HAND_CONNECTIONS,
  POSE_CONNECTIONS,
  type TrackerFrameResult,
} from '@/lib/ar/types'

interface PoseDebugProps {
  frameRef: MutableRefObject<TrackerFrameResult | null>
  className?: string
}

export default function PoseDebug({ frameRef, className }: PoseDebugProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number | null = null
    let running = true

    const draw = () => {
      if (!running) return
      const frame = frameRef.current
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
      }
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      if (!frame) {
        rafId = requestAnimationFrame(draw)
        return
      }

      // Pose skeleton
      const pose = frame.pose.landmarks
      if (pose && pose.length > 0) {
        ctx.lineWidth = 2 * dpr
        ctx.strokeStyle = 'rgba(124,58,237,0.75)'
        for (const [a, b] of POSE_CONNECTIONS) {
          const p1 = pose[a]
          const p2 = pose[b]
          if (!p1 || !p2) continue
          if ((p1.visibility ?? 1) < 0.3 || (p2.visibility ?? 1) < 0.3) continue
          ctx.beginPath()
          ctx.moveTo(p1.x * w, p1.y * h)
          ctx.lineTo(p2.x * w, p2.y * h)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(6,182,212,0.95)'
        for (const p of pose) {
          if ((p.visibility ?? 1) < 0.3) continue
          ctx.beginPath()
          ctx.arc(p.x * w, p.y * h, 3 * dpr, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Hands skeleton (2 mains max)
      for (const hand of frame.hands.hands) {
        const color = hand.side === 'left' ? 'rgba(16,185,129,0.85)' : 'rgba(245,158,11,0.85)'
        ctx.strokeStyle = color
        ctx.fillStyle = color
        ctx.lineWidth = 2 * dpr
        for (const [a, b] of HAND_CONNECTIONS) {
          const p1 = hand.landmarks[a]
          const p2 = hand.landmarks[b]
          if (!p1 || !p2) continue
          ctx.beginPath()
          ctx.moveTo(p1.x * w, p1.y * h)
          ctx.lineTo(p2.x * w, p2.y * h)
          ctx.stroke()
        }
        for (const p of hand.landmarks) {
          ctx.beginPath()
          ctx.arc(p.x * w, p.y * h, 2.5 * dpr, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      running = false
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [frameRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
      data-testid="pose-debug-canvas"
    />
  )
}
