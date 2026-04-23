import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import CookieBanner from '@/components/shared/CookieBanner'
import SkipToContent from '@/components/shared/SkipToContent'
import SOSButton from '@/components/shared/SOSButton'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MUKTI — Libère-toi. Ensemble.',
  description:
    "L'app de libération de toutes les addictions. Cercles d'intention collectifs, événements mondiaux de conscience, accompagnement spirituel personnalisé.",
  metadataBase: new URL('https://mukti.purama.dev'),
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'MUKTI — Libère-toi. Ensemble.',
    description:
      "Libération des addictions, cercles d'intention collectifs, événements C.O.R.E. mondiaux. Une expérience spirituelle, jamais médicale.",
    url: 'https://mukti.purama.dev',
    siteName: 'MUKTI',
    locale: 'fr_FR',
    type: 'website',
    images: [
      { url: '/api/og', width: 1200, height: 630, alt: 'MUKTI — Libération' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MUKTI — Libère-toi. Ensemble.',
    description:
      "Libération des addictions, cercles d'intention, événements mondiaux. मुक्ति.",
    images: ['/api/og'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://mukti.purama.dev' },
}

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${spaceGrotesk.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mukti-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}else{document.documentElement.dataset.theme='dark'}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-void)] font-[family-name:var(--font-body)] text-[var(--text-primary)] antialiased">
        <SkipToContent />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ErrorBoundary>
            <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
            <SOSButton />
          </ErrorBoundary>
          <CookieBanner />
        </NextIntlClientProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#f0f2ff',
            },
          }}
        />
      </body>
    </html>
  )
}
