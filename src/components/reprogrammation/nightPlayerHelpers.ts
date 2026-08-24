// MUKTI — G5.4 Night Player Helpers
// Fonctions utilitaires pour le NightPlayer : formatTime, speakIfEnabled.

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

interface AffirmationItem {
  id: string
  text_fr: string
  text_en: string | null
  source: 'purama' | 'user' | 'community'
}

export function speakAffirmation(
  affirmation: AffirmationItem | undefined,
  voiceEnabled: boolean,
  voiceVolume: number
): void {
  if (!voiceEnabled || !affirmation || typeof window === 'undefined') return
  if (!window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(affirmation.text_fr)
  u.lang = 'fr-FR'
  u.rate = 0.75
  u.pitch = 0.9
  u.volume = voiceVolume
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
