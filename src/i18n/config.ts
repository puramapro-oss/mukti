// MUKTI G8.7.3 — 32 locales LOCALES_EXTENDED + noms natifs + drapeaux + RTL

export const locales = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
  'cs', 'el', 'hu', 'ro', 'tr', 'ar', 'he', 'hi', 'zh', 'ja', 'ko', 'th',
  'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bn', 'ur',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  no: 'Norsk',
  da: 'Dansk',
  fi: 'Suomi',
  cs: 'Čeština',
  el: 'Ελληνικά',
  hu: 'Magyar',
  ro: 'Română',
  tr: 'Türkçe',
  ar: 'العربية',
  he: 'עברית',
  hi: 'हिन्दी',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  th: 'ไทย',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  tl: 'Tagalog',
  ru: 'Русский',
  uk: 'Українська',
  bn: 'বাংলা',
  ur: 'اردو',
}

export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹',
  nl: '🇳🇱', pl: '🇵🇱', sv: '🇸🇪', no: '🇳🇴', da: '🇩🇰', fi: '🇫🇮',
  cs: '🇨🇿', el: '🇬🇷', hu: '🇭🇺', ro: '🇷🇴', tr: '🇹🇷', ar: '🇸🇦',
  he: '🇮🇱', hi: '🇮🇳', zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷', th: '🇹🇭',
  vi: '🇻🇳', id: '🇮🇩', ms: '🇲🇾', tl: '🇵🇭', ru: '🇷🇺', uk: '🇺🇦',
  bn: '🇧🇩', ur: '🇵🇰',
}

export const rtlLocales: ReadonlyArray<Locale> = ['ar', 'he', 'ur'] as const

export function isRtlLocale(l: Locale): boolean {
  return rtlLocales.includes(l)
}
