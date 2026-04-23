// MUKTI — G4 AR Engine
// Types partagés entre loader, tracker et composants r3f.

/** Point 3D normalisé — MediaPipe normalise x,y ∈ [0,1] (espace image) + z relatif. */
export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/** Index pose : 33 landmarks (MediaPipe Pose). 0=nez, 11/12=épaules, 15/16=poignets, 23/24=hanches. */
export const POSE_LANDMARK_COUNT = 33

/** Index main : 21 landmarks (MediaPipe Hand). 0=poignet, 4=pouce, 8=index, 12=majeur, 16=annulaire, 20=auriculaire. */
export const HAND_LANDMARK_COUNT = 21

export interface PoseResult {
  timestampMs: number
  landmarks: Landmark[] | null
  worldLandmarks: Landmark[] | null
}

export type HandSide = 'left' | 'right'

export interface HandResult {
  side: HandSide
  score: number
  landmarks: Landmark[]
  worldLandmarks: Landmark[]
}

export interface HandsResult {
  timestampMs: number
  hands: HandResult[]
}

export interface TrackerFrameResult {
  timestampMs: number
  pose: PoseResult
  hands: HandsResult
}

export type TrackerCallback = (result: TrackerFrameResult) => void

/** Connexions pose (pairs d'index) pour dessiner le squelette. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // tronc
  [11, 12], [11, 23], [12, 24], [23, 24],
  // bras gauche
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // bras droit
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // jambe gauche
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // jambe droite
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
  // visage (simple)
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
]

/** Connexions main (pairs d'index) pour dessiner le squelette de la main. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // pouce
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // majeur
  [0, 9], [9, 10], [10, 11], [11, 12],
  // annulaire
  [0, 13], [13, 14], [14, 15], [15, 16],
  // auriculaire
  [0, 17], [17, 18], [18, 19], [19, 20],
  // paume
  [5, 9], [9, 13], [13, 17],
]
