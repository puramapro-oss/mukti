// MUKTI — G4 AR Engine
// Loader MediaPipe Tasks Vision : PoseLandmarker + HandLandmarker (lite, GPU).
// Modèles chargés depuis CDN Google (constants.ts). Singleton par onglet.

import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import {
  AR_MEDIAPIPE_HAND_MODEL_URL,
  AR_MEDIAPIPE_POSE_MODEL_URL,
  AR_MEDIAPIPE_WASM_BASE,
} from '../constants'

export interface MediaPipeEngine {
  pose: PoseLandmarker
  hand: HandLandmarker
  dispose: () => void
}

let pending: Promise<MediaPipeEngine> | null = null

export async function loadMediaPipe(): Promise<MediaPipeEngine> {
  if (typeof window === 'undefined') {
    throw new Error('MediaPipe ne peut être chargé que côté navigateur.')
  }
  if (pending) return pending

  pending = (async () => {
    const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(AR_MEDIAPIPE_WASM_BASE)

    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: AR_MEDIAPIPE_POSE_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
      outputSegmentationMasks: false,
    })

    const hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: AR_MEDIAPIPE_HAND_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.4,
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    })

    return {
      pose,
      hand,
      dispose: () => {
        try { pose.close() } catch {}
        try { hand.close() } catch {}
      },
    }
  })().catch((err) => {
    pending = null
    throw err
  })

  return pending
}

/** Remet à zéro le singleton (utile pour tests / retry après erreur fatale). */
export function resetMediaPipe(): void {
  if (pending) {
    void pending.then((engine) => {
      try { engine.dispose() } catch {}
    }).catch(() => {})
    pending = null
  }
}
