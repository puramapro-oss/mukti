'use client'

// MUKTI — G4 AR Energy Mirror
// Hook caméra : gère la demande de permission + fallback "mode imaginaire".
// Aucune upload — le flux reste 100% local dans le navigateur.

import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraPermissionStatus =
  | 'idle'             // rien demandé
  | 'requesting'       // demande en cours
  | 'granted'          // stream actif
  | 'denied'           // refus explicite
  | 'unavailable'      // pas de caméra détectée / pas secure context
  | 'imaginary'        // mode imaginaire choisi par l'utilisateur

export interface CameraPermissionState {
  status: CameraPermissionStatus
  stream: MediaStream | null
  error: string | null
  request: () => Promise<void>
  stop: () => void
  useImaginaryMode: () => void
}

export function useCameraPermission(facingMode: 'user' | 'environment' = 'user'): CameraPermissionState {
  const [status, setStatus] = useState<CameraPermissionStatus>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    setStream(null)
  }, [])

  const request = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Ton navigateur ne supporte pas la caméra. Tu peux continuer en mode imaginaire.')
      setStatus('unavailable')
      return
    }
    if (!window.isSecureContext) {
      setError('La caméra nécessite HTTPS. Tu peux continuer en mode imaginaire.')
      setStatus('unavailable')
      return
    }
    setStatus('requesting')
    setError(null)
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = newStream
      setStream(newStream)
      setStatus('granted')
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Accès caméra refusé. Tu peux continuer en mode imaginaire.')
        setStatus('denied')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('Aucune caméra détectée sur ton appareil. Mode imaginaire disponible.')
        setStatus('unavailable')
      } else {
        setError('Impossible d\'accéder à la caméra. Mode imaginaire disponible.')
        setStatus('unavailable')
      }
    }
  }, [facingMode])

  const useImaginaryMode = useCallback(() => {
    stop()
    setError(null)
    setStatus('imaginary')
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return {
    status,
    stream,
    error,
    request,
    stop,
    useImaginaryMode,
  }
}
