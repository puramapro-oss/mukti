'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Globe, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { locales, localeNames, type Locale } from '@/i18n/config'

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const currentLocale = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchLocale(locale: Locale) {
    if (locale === currentLocale) { setOpen(false); return }
    setLoading(true)
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      window.location.reload()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm transition-all hover:bg-white/5',
          loading && 'opacity-50'
        )}
        aria-label={compact ? `Langue : ${localeNames[currentLocale]}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
        {!compact && (
          <span className="text-[var(--text-secondary)]">{localeNames[currentLocale]}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 max-h-80 w-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-nebula)] p-1 shadow-2xl backdrop-blur-xl z-[1000]">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => switchLocale(locale)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                locale === currentLocale
                  ? 'bg-[var(--cyan)]/10 text-[var(--cyan)]'
                  : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
              )}
            >
              <span>{localeNames[locale]}</span>
              {locale === currentLocale && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
