'use client'

interface Phrase {
  id: string
  text_fr: string
  text_en: string
}

interface MentalRepetitionModeProps {
  phrase: Phrase | null
  locale?: 'fr' | 'en'
}

export default function MentalRepetitionMode({ phrase, locale = 'fr' }: MentalRepetitionModeProps) {
  const text = phrase ? (locale === 'en' ? phrase.text_en : phrase.text_fr) : 'Respire. Écoute le silence.'
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">Répète en silence</p>
      <p className="mt-4 text-2xl font-light leading-snug text-white/85 sm:text-3xl" style={{ maxWidth: '600px' }}>
        « {text} »
      </p>
      <p className="mt-5 text-xs text-white/35">Aucun son — seulement l&apos;intention.</p>
    </div>
  )
}
