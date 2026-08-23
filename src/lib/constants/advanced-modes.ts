// MUKTI — Modes avancés anti-addiction
// G5 Scope A + G6 modes 16-20 + teasers
// G5 actifs : rituel_7s, boucle_urgence, exorcisme, boite_noire
// G6 actifs : energie_remplacement, realite_alternative, recompenses_mystere, rituel_minimaliste, journal_mental
// Teasers futurs : parfum_virtuel, predicteur_envie, hypnose_mouvement, hologramme, armure
export const ADVANCED_MODES = [
  { id: 'rituel_7s',          slug: 'rituel-7-secondes',   brief_num: 15, name: 'Rituel 7 Secondes',        emoji: '⚡', color: '#F59E0B', status: 'active', gate: 'G5.6',
    tagline_fr: 'Micro-rituel qui coupe n\'importe quelle envie, utilisable partout.' },
  { id: 'boucle_urgence',     slug: 'boucle-urgence',      brief_num: 9,  name: 'Boucle Urgence Invisible', emoji: '🔇', color: '#06b6d4', status: 'active', gate: 'G5.7',
    tagline_fr: 'En société : micro-vibrations + mini-respiration + lettres flottantes. Personne ne remarque.' },
  { id: 'exorcisme',          slug: 'exorcisme',           brief_num: 10, name: 'Exorcisme de l\'Addiction', emoji: '🌑', color: '#1e1b4b', status: 'active', gate: 'G5.7',
    tagline_fr: 'Séance immersive : ombre → destruction virtuelle → reprogrammation → effacement.' },
  { id: 'boite_noire',        slug: 'boite-noire',         brief_num: 13, name: 'Boîte Noire',              emoji: '📓', color: '#7c3aed', status: 'active', gate: 'G5.8',
    tagline_fr: 'Enregistre quand/où/qui/quoi déclenche, révèle ton schéma secret.' },
  { id: 'energie_remplacement', slug: 'energie-remplacement', brief_num: 16, name: 'Énergie de Remplacement', emoji: '🔋', color: '#10b981', status: 'active', gate: 'G6.5',
    tagline_fr: 'Comble le vide : motivation, calme, confiance, énergie ou concentration.' },
  { id: 'realite_alternative', slug: 'realite-alternative', brief_num: 17, name: 'Réalité Alternative', emoji: '🪞', color: '#a855f7', status: 'active', gate: 'G6.5',
    tagline_fr: 'Caméra + IA : ta peau, ton sourire, ton énergie dans 30 jours sans addiction.' },
  { id: 'recompenses_mystere', slug: 'recompenses-mystere', brief_num: 18, name: 'Récompenses Mystères', emoji: '🎁', color: '#f472b6', status: 'active', gate: 'G6.5',
    tagline_fr: 'Coffre quotidien : points, coupons, boosters, surprises.' },
  { id: 'rituel_minimaliste', slug: 'rituel-minimaliste', brief_num: 19, name: 'Rituel Minimaliste', emoji: '🫧', color: '#06b6d4', status: 'active', gate: 'G6.5',
    tagline_fr: 'Micro-habitudes invisibles. Pour les jours sans motivation.' },
  { id: 'journal_mental', slug: 'journal-mental', brief_num: 20, name: 'Journal Mental Auto', emoji: '🎙️', color: '#7c3aed', status: 'active', gate: 'G6.5',
    tagline_fr: 'Tu parles 1 minute, l\'IA comprend ton état mental et prédit ta rechute.' },
  { id: 'parfum_virtuel',     slug: 'parfum-virtuel',      brief_num: 7,  name: 'Parfum Virtuel',           emoji: '🌸', color: '#ec4899', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Illusion olfactive via suggestion multisensorielle.' },
  { id: 'predicteur_envie',   slug: 'predicteur',          brief_num: 8,  name: 'Prédicteur d\'Envie',       emoji: '🔮', color: '#a855f7', status: 'teaser', gate: 'G7+',
    tagline_fr: 'IA analyse comportement + stress → alerte 22 min avant pulsion probable.' },
  { id: 'hypnose_mouvement',  slug: 'hypnose-mouvement',   brief_num: 11, name: 'Hypnose en Mouvement',     emoji: '🚶', color: '#10b981', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Tu marches, l\'IA synchronise pas avec rythme de libération mentale.' },
  { id: 'hologramme',         slug: 'hologramme',          brief_num: 12, name: 'Hologramme Motivationnel', emoji: '✨', color: '#F59E0B', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Caméra active, ton "toi futur libéré" apparaît et te parle.' },
  { id: 'armure',             slug: 'armure',              brief_num: 14, name: 'Armure Anti-Habitudes',    emoji: '🛡️', color: '#6366f1', status: 'teaser', gate: 'G7+',
    tagline_fr: 'Champ de protection virtuel + vibrations bouclier + son protecteur.' },
] as const
export type AdvancedModeId = typeof ADVANCED_MODES[number]['id']

// Boîte Noire : 6 location presets (RGPD — jamais de GPS brut)
export const BOITE_NOIRE_LOCATIONS = [
  { id: 'maison',    name: 'Maison',       emoji: '🏠' },
  { id: 'bureau',    name: 'Bureau',       emoji: '💼' },
  { id: 'transport', name: 'Transport',    emoji: '🚆' },
  { id: 'cafe_bar',  name: 'Café / Bar',   emoji: '☕' },
  { id: 'exterieur', name: 'Extérieur',    emoji: '🌳' },
  { id: 'autre',     name: 'Autre',        emoji: '•' },
] as const
export type BoiteNoireLocation = typeof BOITE_NOIRE_LOCATIONS[number]['id']

export const BOITE_NOIRE_WHO = [
  { id: 'seul',       name: 'Seul·e',       emoji: '👤' },
  { id: 'famille',    name: 'Famille',      emoji: '👨‍👩‍👧' },
  { id: 'collegues',  name: 'Collègues',    emoji: '💼' },
  { id: 'ami',        name: 'Ami·e·s',      emoji: '👯' },
  { id: 'partenaire', name: 'Partenaire',   emoji: '💞' },
  { id: 'inconnu',    name: 'Inconnu·e·s',  emoji: '👥' },
] as const
export type BoiteNoireWho = typeof BOITE_NOIRE_WHO[number]['id']
