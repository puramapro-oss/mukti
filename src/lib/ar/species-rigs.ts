// MUKTI — G4.4 Species Switch
// Config par espèce : couleurs + décorations (ears/tail/wings/aura) + modifs proportions.
// Source de vérité : slugs alignés sur la table ar_species_catalog (seed G4.1).
// Design : on ne remappe PAS radicalement l'anatomie (impossible avec pose 2D MediaPipe),
// on ajoute des décorations expressives qui suivent les landmarks-clés.

import type { ArSpeciesSlug } from '../constants'

export type SpeciesDecoration = 'ears' | 'tail' | 'wings' | 'aura' | 'none'

export interface SpeciesRigConfig {
  slug: ArSpeciesSlug
  /** Couleur principale silhouette (core). */
  color: string
  /** Couleur halo/aura. */
  haloColor: string
  /** Décoration principale. */
  decoration: SpeciesDecoration
  /** Décoration secondaire optionnelle (ex : chien = ears + tail). */
  secondary?: SpeciesDecoration
  /** Multiplicateur opacité silhouette (gardien = + éthéré). */
  silhouetteOpacity: number
  /** Message cadencé à l'entrée (affiché au-dessus du canvas). */
  tagline_fr: string
  tagline_en: string
  /** Icon glyph (fallback de la DB). */
  glyph: string
}

export const SPECIES_RIGS: Record<ArSpeciesSlug, SpeciesRigConfig> = {
  humain: {
    slug: 'humain',
    color: '#06B6D4',
    haloColor: '#7C3AED',
    decoration: 'none',
    silhouetteOpacity: 1,
    tagline_fr: 'Ton corps, ta lumière.',
    tagline_en: 'Your body, your light.',
    glyph: '🧘',
  },
  chien: {
    slug: 'chien',
    color: '#F59E0B',
    haloColor: '#F97316',
    decoration: 'ears',
    secondary: 'tail',
    silhouetteOpacity: 0.95,
    tagline_fr: 'Loyauté, présence, protection.',
    tagline_en: 'Loyalty, presence, protection.',
    glyph: '🐕',
  },
  chat: {
    slug: 'chat',
    color: '#06B6D4',
    haloColor: '#22D3EE',
    decoration: 'ears',
    secondary: 'tail',
    silhouetteOpacity: 0.95,
    tagline_fr: 'Souplesse et intuition.',
    tagline_en: 'Flexibility and intuition.',
    glyph: '🐈',
  },
  cheval: {
    slug: 'cheval',
    color: '#EF4444',
    haloColor: '#F43F5E',
    decoration: 'tail',
    silhouetteOpacity: 1,
    tagline_fr: 'Liberté, puissance, galop.',
    tagline_en: 'Freedom, power, gallop.',
    glyph: '🐎',
  },
  oiseau: {
    slug: 'oiseau',
    color: '#10B981',
    haloColor: '#22D3EE',
    decoration: 'wings',
    silhouetteOpacity: 0.9,
    tagline_fr: 'Élévation, perspective, souffle.',
    tagline_en: 'Elevation, perspective, breath.',
    glyph: '🕊️',
  },
  faune_sauvage: {
    slug: 'faune_sauvage',
    color: '#8B5CF6',
    haloColor: '#A78BFA',
    decoration: 'tail',
    secondary: 'ears',
    silhouetteOpacity: 0.95,
    tagline_fr: 'Instinct pur, Terre ancienne.',
    tagline_en: 'Pure instinct, ancient Earth.',
    glyph: '🦊',
  },
  gardien_refuge: {
    slug: 'gardien_refuge',
    color: '#14B8A6',
    haloColor: '#F59E0B',
    decoration: 'aura',
    silhouetteOpacity: 0.85,
    tagline_fr: 'Veiller, ancrer la paix.',
    tagline_en: 'Watching over, anchoring peace.',
    glyph: '🌿',
  },
}

export function getSpeciesRig(slug: ArSpeciesSlug): SpeciesRigConfig {
  return SPECIES_RIGS[slug] ?? SPECIES_RIGS.humain
}

export const SPECIES_ORDER: ArSpeciesSlug[] = [
  'humain',
  'chien',
  'chat',
  'cheval',
  'oiseau',
  'faune_sauvage',
  'gardien_refuge',
]
