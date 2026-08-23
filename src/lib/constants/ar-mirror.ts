// ==================================================
// G4 — AR Energy Mirror
// ==================================================

// 7 espèces (humain + 6 animales) — source de vérité slugs FK DB
export const AR_SPECIES_SLUGS = [
  'humain',
  'chien',
  'chat',
  'cheval',
  'oiseau',
  'faune_sauvage',
  'gardien_refuge',
] as const
export type ArSpeciesSlug = typeof AR_SPECIES_SLUGS[number]

export const AR_RIG_TYPES = ['biped', 'quadruped', 'avian', 'guardian'] as const
export type ArRigType = typeof AR_RIG_TYPES[number]

export const AR_BEACON_TYPES = [
  'refuge_animalier',
  'ong_nature',
  'personne',
  'planete',
  'element',
] as const
export type ArBeaconType = typeof AR_BEACON_TYPES[number]

export const AR_SESSION_MODES = ['soin', 'manifestation', 'ceremony', 'training'] as const
export type ArSessionMode = typeof AR_SESSION_MODES[number]

export const AR_TRAINING_MODES = ['soin', 'manifestation'] as const
export type ArTrainingMode = typeof AR_TRAINING_MODES[number]

export const AR_CEREMONY_STATUSES = ['upcoming', 'live', 'finished', 'cancelled'] as const
export type ArCeremonyStatus = typeof AR_CEREMONY_STATUSES[number]

// Durées de session AR standards (soin/manifestation) en secondes
export const AR_SESSION_DURATIONS_SEC = [180, 300, 600] as const

// MediaPipe — modèle CDN (lite 3 MB pour 30fps mobile)
export const AR_MEDIAPIPE_MODEL_TIER = 'lite' as const
export const AR_MEDIAPIPE_POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'
export const AR_MEDIAPIPE_HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'
export const AR_MEDIAPIPE_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'

// Étapes tuto (1→5) par mode (soin + manifestation)
export const AR_TRAINING_STEPS: Record<'soin' | 'manifestation', ReadonlyArray<{
  step: 1 | 2 | 3 | 4 | 5
  title_fr: string
  title_en: string
  body_fr: string
  body_en: string
}>> = {
  soin: [
    { step: 1, title_fr: 'Reconnaître ton corps', title_en: 'Recognize your body', body_fr: 'Observe ta silhouette lumineuse à l\'écran. Elle est toi.', body_en: 'Observe your luminous silhouette on screen. It is you.' },
    { step: 2, title_fr: 'Sentir tes mains', title_en: 'Feel your hands', body_fr: 'Regarde tes mains fantômes. Bouge-les lentement. Elles sont des antennes.', body_en: 'Look at your phantom hands. Move them slowly. They are antennas.' },
    { step: 3, title_fr: 'Respirer 4-7-8', title_en: 'Breathe 4-7-8', body_fr: 'Inspire 4s, retiens 7s, expire 8s. Trois cycles.', body_en: 'Inhale 4s, hold 7s, exhale 8s. Three cycles.' },
    { step: 4, title_fr: 'Imposer tes mains', title_en: 'Lay your hands', body_fr: 'Pose tes mains fantômes sur la zone à apaiser. Respire simplement.', body_en: 'Place your phantom hands on the area to soothe. Just breathe.' },
    { step: 5, title_fr: 'Clôturer en gratitude', title_en: 'Close in gratitude', body_fr: 'Descends doucement tes mains. Merci à ton corps.', body_en: 'Slowly lower your hands. Thank your body.' },
  ],
  manifestation: [
    { step: 1, title_fr: 'Choisir ton intention', title_en: 'Choose your intention', body_fr: 'Une phrase courte, au présent, positive.', body_en: 'A short sentence, present tense, positive.' },
    { step: 2, title_fr: 'Visualiser la cible', title_en: 'Visualize the target', body_fr: 'Sens la présence de ce à qui tu envoies ton énergie.', body_en: 'Feel the presence of who you are sending energy to.' },
    { step: 3, title_fr: 'Charger tes mains', title_en: 'Charge your hands', body_fr: 'Rapproche tes mains. Sens la chaleur entre elles qui grandit.', body_en: 'Bring your hands close. Feel the warmth between them grow.' },
    { step: 4, title_fr: 'Émettre le rayon', title_en: 'Send the beam', body_fr: 'Ouvre tes mains vers la cible. Laisse le rayon partir.', body_en: 'Open your hands toward the target. Let the beam flow.' },
    { step: 5, title_fr: 'Sceller', title_en: 'Seal', body_fr: 'Ramène tes mains sur ton cœur. Merci.', body_en: 'Bring your hands back to your heart. Thank you.' },
  ],
} as const
