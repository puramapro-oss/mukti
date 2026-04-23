'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Cookie, X } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const t = useTranslations('cookie')

  useEffect(() => {
    const consent = localStorage.getItem('vida_cookie_consent')
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('vida_cookie_consent', 'accepted')
    setShow(false)
  }

  const decline = () => {
    localStorage.setItem('vida_cookie_consent', 'declined')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[999] mx-auto max-w-lg animate-in slide-in-from-bottom-4 duration-300">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-[var(--cyan)]" />
          <div className="flex-1">
            <p className="text-sm text-[var(--text-primary)]">
              {t('message')}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={accept}>{t('accept')}</Button>
              <Button size="sm" variant="ghost" onClick={decline}>{t('decline')}</Button>
            </div>
          </div>
          <button
            type="button"
            onClick={decline}
            aria-label="Fermer la bannière cookies"
            className="shrink-0 rounded-lg p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
