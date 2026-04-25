import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

// MUKTI G8.7.3 — 32 locales (LOCALES_EXTENDED)
export const locales = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
  'cs', 'el', 'hu', 'ro', 'tr', 'ar', 'he', 'hi', 'zh', 'ja', 'ko', 'th',
  'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bn', 'ur',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

// Locales RTL pour direction CSS
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar', 'he', 'ur'] as const)
export function isRtlLocale(l: Locale): boolean {
  return RTL_LOCALES.has(l)
}

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('locale')?.value
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    return localeCookie as Locale
  }

  const headerStore = await headers()
  const acceptLanguage = headerStore.get('accept-language')
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
    if (preferred && locales.includes(preferred as Locale)) {
      return preferred as Locale
    }
  }

  return defaultLocale
}

export default getRequestConfig(async () => {
  const locale = await getLocale()
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
