// MUKTI — G4 AR Engine
// Boucle rAF qui pilote PoseLandmarker + HandLandmarker sur un <video>.
// Appelle onResult(frame) à chaque frame traitée avec landmarks normalisés.

import type {
  HandLandmarkerResult,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { loadMediaPipe, type MediaPipeEngine } from './mediapipe-loader'
import type {
  HandResult,
  HandSide,
  HandsResult,
  Landmark,
  PoseResult,
  TrackerCallback,
  TrackerFrameResult,
} from './types'

export interface TrackerHandle {
  start: () => void
  stop: () => void
  dispose: () => void
  isRunning: () => boolean
}

export interface CreateTrackerOptions {
  video: HTMLVideoElement
  onResult: TrackerCallback
  /** si true, log mediapipe errors sinon silent */
  debug?: boolean
}

export async function createTracker({ video, onResult, debug = false }: CreateTrackerOptions): Promise<TrackerHandle> {
  const engine: MediaPipeEngine = await loadMediaPipe()
  let running = false
  let rafId: number | null = null
  let lastTs = -1

  const tick = () => {
    if (!running) return
    const ts = performance.now()
    // skip si video pas encore prête
    if (video.readyState < 2 || video.videoWidth === 0) {
      rafId = requestAnimationFrame(tick)
      return
    }
    // MediaPipe exige des timestamps strictement croissants
    const effectiveTs = ts <= lastTs ? lastTs + 1 : ts
    lastTs = effectiveTs

    let poseRaw: PoseLandmarkerResult | null = null
    let handRaw: HandLandmarkerResult | null = null
    try {
      poseRaw = engine.pose.detectForVideo(video, effectiveTs)
    } catch (err) {
      if (debug) console.warn('[AR] pose detect fail', err)
    }
    try {
      handRaw = engine.hand.detectForVideo(video, effectiveTs)
    } catch (err) {
      if (debug) console.warn('[AR] hand detect fail', err)
    }

    const frame = toFrameResult(effectiveTs, poseRaw, handRaw)
    try {
      onResult(frame)
    } catch (err) {
      if (debug) console.warn('[AR] onResult callback error', err)
    }

    rafId = requestAnimationFrame(tick)
  }

  return {
    start: () => {
      if (running) return
      running = true
      lastTs = -1
      rafId = requestAnimationFrame(tick)
    },
    stop: () => {
      running = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    },
    dispose: () => {
      running = false
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      // NOTE : on ne dispose pas le singleton engine — d'autres ARCanvas peuvent l'utiliser
    },
    isRunning: () => running,
  }
}

// ---------------------------------------------------------------------------
// Conversion résultats MediaPipe → forme Mukti
// ---------------------------------------------------------------------------
function toFrameResult(
  timestampMs: number,
  pose: PoseLandmarkerResult | null,
  hand: HandLandmarkerResult | null
): TrackerFrameResult {
  return {
    timestampMs,
    pose: mapPose(timestampMs, pose),
    hands: mapHands(timestampMs, hand),
  }
}

function mapPose(timestampMs: number, result: PoseLandmarkerResult | null): PoseResult {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return { timestampMs, landmarks: null, worldLandmarks: null }
  }
  return {
    timestampMs,
    landmarks: (result.landmarks[0] as Landmark[] | undefined) ?? null,
    worldLandmarks: (result.worldLandmarks?.[0] as Landmark[] | undefined) ?? null,
  }
}

function mapHands(timestampMs: number, result: HandLandmarkerResult | null): HandsResult {
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    return { timestampMs, hands: [] }
  }
  const hands: HandResult[] = []
  const handedness = result.handedness ?? []
  const world = result.worldLandmarks ?? []
  for (let i = 0; i < result.landmarks.length; i++) {
    const landmarks = result.landmarks[i] as Landmark[] | undefined
    if (!landmarks) continue
    const hCat = handedness[i]?.[0]
    // MediaPipe renvoie 'Left'/'Right' du point de vue de l'image — on remappe pour un flip miroir (front camera)
    const rawSide = (hCat?.categoryName ?? 'Left').toLowerCase() as HandSide
    const side: HandSide = rawSide === 'left' ? 'right' : 'left'
    hands.push({
      side,
      score: hCat?.score ?? 0,
      landmarks,
      worldLandmarks: (world[i] as Landmark[] | undefined) ?? [],
    })
  }
  return { timestampMs, hands }
}
