// MUKTI — MediaPipe lifecycle. No model or camera data leaves this module.
import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import {
  AR_MEDIAPIPE_HAND_MODEL_URL, AR_MEDIAPIPE_POSE_MODEL_URL, AR_MEDIAPIPE_WASM_BASE,
} from '../constants'

export interface MediaPipeEngine {
  pose: PoseLandmarker
  hand: HandLandmarker
  dispose: () => void
}
let pending: Promise<MediaPipeEngine> | null = null

function closeLandmarker(model: { close: () => void }, kind: 'pose' | 'hand') {
  try { model.close() } catch {
    // Report a resource cleanup failure without disclosing camera/user data.
    console.warn(`MediaPipe: échec de libération du module ${kind}.`)
  }
}

async function createEngine(): Promise<MediaPipeEngine> {
  const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(AR_MEDIAPIPE_WASM_BASE)
  const pose = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: AR_MEDIAPIPE_POSE_MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4, outputSegmentationMasks: false,
  })
  let hand: HandLandmarker
  try {
    hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: AR_MEDIAPIPE_HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    })
  } catch (error) {
    closeLandmarker(pose, 'pose')
    throw error
  }
  let disposed = false
  return {
    pose, hand,
    dispose() {
      if (disposed) return
      disposed = true
      closeLandmarker(pose, 'pose')
      closeLandmarker(hand, 'hand')
    },
  }
}

export async function loadMediaPipe(): Promise<MediaPipeEngine> {
  if (typeof window === 'undefined') {
    throw new Error('MediaPipe ne peut être chargé que côté navigateur.')
  }
  if (pending) return pending
  const attempt = createEngine().then(engine => {
    if (pending !== attempt) {
      engine.dispose()
      throw new Error('Chargement MediaPipe annulé par une réinitialisation.')
    }
    return {
      ...engine,
      dispose() {
        if (pending === attempt) pending = null
        engine.dispose()
      },
    }
  })
  pending = attempt
  void attempt.catch(() => {
    if (pending === attempt) pending = null
  })
  return attempt
}

/** Invalidate the current load and release only its own resources. */
export function resetMediaPipe(): void {
  const previous = pending
  pending = null
  if (previous) {
    void previous.then(engine => engine.dispose(), () => undefined)
  }
}
