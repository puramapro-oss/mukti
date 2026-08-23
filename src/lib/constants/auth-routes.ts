// Rôles
export const ROLES = {
  user: 'user',
  super_admin: 'super_admin',
} as const

// Routes publiques (middleware)
export const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/how-it-works',
  '/ecosystem',
  '/status',
  '/changelog',
  '/privacy',
  '/terms',
  '/legal',
  '/offline',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/cookies',
  '/aide',
  '/contact',
  '/accessibilite',
  '/sos',
]

export const MUKTI_CORE_VALUES = {
  no_medical_promise: true,
  no_hierarchy: true,
  consent_explicit: true,
  no_subliminal: true,
  spiritual_experience: true,
} as const

export const DISCLAIMER_FR =
  'Expérience spirituelle personnelle, ne remplace aucun accompagnement médical ou psychologique. En cas d\'urgence : 112.'
export const DISCLAIMER_EN =
  'Personal spiritual experience, does not replace any medical or psychological care. In case of emergency: 112.'
