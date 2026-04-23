'use client'

// MUKTI — G4 AR Engine
// Composant interne : <video> caché + Three.js Canvas plein écran + tracker MediaPipe.
// Chargé UNIQUEMENT via dynamic import ssr:false (WebGL + MediaPipe = browser only).

import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { createTracker, type TrackerHandle } from '@/lib/ar/tracker'
import type { TrackerFrameResult } from '@/lib/ar/types'
import PoseDebug from './PoseDebug'

export interface ARCanvasInnerProps {
  /** Flux caméra actif (granted) — null = mode imaginaire. */
  stream: MediaStream | null
  /** Active le tracker MediaPipe (ne tourne que si stream présent). */
  enabled?: boolean
  /** Callback à chaque frame trackée — persistance latest landmarks. */
  onFrame?: (frame: TrackerFrameResult) => void
  /** Affiche l'overlay debug landmarks. */
  showDebug?: boolean
  /** Enfants r3f (mesh silhouette, phantom hands, etc.) injectés dans le Canvas. */
  children?: React.ReactNode
  /** Classe CSS extra pour le wrapper. */
  className?: string
}

export default function ARCanvasInner({
  stream,
  enabled = true,
  onFrame,
  showDebug = false,
  children,
  className,
}: ARCanvasInnerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const latestFrameRef = useRef<TrackerFrameResult | null>(null)
  const trackerRef = useRef<TrackerHandle | null>(null)
  const [trackerStatus, setTrackerStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle')
  const [trackerError, setTrackerError] = useState<string | null>(null)

  // Attache le MediaStream au <video>
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream) {
      video.srcObject = stream
      video.play().catch(() => {
        /* autoplay restrictions — le user gesture du bouton "autoriser" suffit normalement */
      })
    } else {
      video.srcObject = null
      video.pause()
    }
  }, [stream])

  // Démarre / arrête le tracker selon stream + enabled
  useEffect(() => {
    let cancelled = false
    const video = videoRef.current
    if (!video || !stream || !enabled) return

    setTrackerStatus('loading')
    setTrackerError(null)

    const boot = async () => {
      try {
        const handle = await createTracker({
          video,
          onResult: (frame) => {
            latestFrameRef.current = frame
            onFrame?.(frame)
          },
        })
        if (cancelled) {
          handle.dispose()
          return
        }
        trackerRef.current = handle
        handle.start()
        setTrackerStatus('running')
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Impossible de charger le tracker AR.'
        setTrackerError(msg)
        setTrackerStatus('error')
      }
    }
    void boot()

    return () => {
      cancelled = true
      trackerRef.current?.dispose()
      trackerRef.current = null
      setTrackerStatus('idle')
    }
  }, [stream, enabled, onFrame])

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-black ${className ?? ''}`}
      data-testid="ar-canvas-inner"
    >
      {/* Flux vidéo local — on l'affiche en fond plein écran, mirroir (selfie) */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-[0.55]"
      />

      {/* Scene 3D r3f — transparente, overlay sur la vidéo, aussi mirroir */}
      <Canvas
        className="absolute inset-0 h-full w-full scale-x-[-1]"
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 5], fov: 50 }}
      >
        <ambientLight intensity={0.4} />
        {children}
      </Canvas>

      {/* Debug overlay (dev / ?debug=1) */}
      {showDebug && (
        <PoseDebug
          frameRef={latestFrameRef}
          className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
        />
      )}

      {/* Badge status discret en haut-droite */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/60 backdrop-blur">
        {trackerStatus === 'idle' && 'idle'}
        {trackerStatus === 'loading' && '◌ chargement IA…'}
        {trackerStatus === 'running' && <span className="text-[var(--cyan,#06B6D4)]">● tracking</span>}
        {trackerStatus === 'error' && <span className="text-red-300">! erreur</span>}
      </div>

      {trackerError && (
        <div
          role="alert"
          className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(90vw,360px)] -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 backdrop-blur"
        >
          {trackerError}
        </div>
      )}
    </div>
  )
}
