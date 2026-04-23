'use client'

import { useEffect, useState } from 'react'

interface Phrase {
  id: string
  text_fr: string
  text_en: string
}

interface VoiceGuidedModeProps {
  phrases: Phrase[]
  locale?: 'fr' | 'en'
  rotationSeconds: number
}

export default function VoiceGuidedMode({ phrases, locale = 'fr', rotationSeconds }: VoiceGuidedModeProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (phrases.length === 0) return
    const interval = Math.max(8000, Math.min(rotationSeconds * 1000 / Math.max(3, phrases.length), 30000))
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), interval)
    return () => clearInterval(id)
  }, [phrases.length, rotationSeconds])

  if (phrases.length === 0) {
    return (
      <p className="text-center text-sm text-white/45">
        Pas de phrases sélectionnées — la présence seule suffit.
      </p>
    )
  }

  const p = phrases[index % phrases.length]
  const text = locale === 'en' ? p.text_en : p.text_fr

  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-4 text-center">
      <p
        key={p.id}
        className="animate-[fadeIn_0.8s_ease-out] text-2xl font-light leading-snug text-white/90 sm:text-3xl"
        style={{ maxWidth: '620px' }}
      >
        « {text} »
      </p>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
