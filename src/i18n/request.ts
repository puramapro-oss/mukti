import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export const locales = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'zh', 'ja', 'ko',
  'hi', 'ru', 'tr', 'nl', 'pl', 'sv',
] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

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
