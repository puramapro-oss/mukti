export const locales = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko',
  'hi', 'ru', 'tr', 'nl', 'pl', 'sv',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

export const localeNames: Record<Locale, string> = {
  fr: 'Francais',
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Portugues',
  ar: 'العربية',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ru: 'Русский',
  tr: 'Turkce',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
}

export const rtlLocales: Locale[] = ['ar']
