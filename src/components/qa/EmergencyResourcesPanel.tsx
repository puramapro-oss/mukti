'use client'

import { Phone, ExternalLink, Heart } from 'lucide-react'

interface Resource {
  id: string
  country_code: string
  category: string
  name_fr: string
  name_en: string
  phone: string | null
  url: string | null
  hours_fr: string | null
}

interface Props {
  resources: Resource[]
  countryCode: string
  lang?: 'fr' | 'en'
}

const CATEGORY_LABEL_FR: Record<string, string> = {
  suicide: 'Prévention suicide',
  addiction: 'Addictions',
  violence: 'Violences',
  mental_health: 'Santé mentale',
  general: 'Urgence générale',
}

export function EmergencyResourcesPanel({ resources, countryCode, lang = 'fr' }: Props) {
  const isEn = lang === 'en'

  if (resources.length === 0) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5"
        data-testid="emergency-empty"
      >
        <p className="text-sm text-amber-100">
          {isEn
            ? 'Resources for your country are being added. Please visit findahelpline.com.'
            : 'Les ressources pour ton pays arrivent bientôt. En attendant, findahelpline.com répertorie des aides internationales.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-3xl border border-red-400/30 bg-gradient-to-br from-red-500/10 to-purple-500/10 p-6 backdrop-blur-xl"
      data-testid="emergency-panel"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-500/20 p-2">
          <Heart className="h-5 w-5 text-red-200" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-red-200">
            {isEn ? 'Emergency resources' : 'Ressources immédiates'}
            {' · '}
            <span className="text-white/60">{countryCode}</span>
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            {isEn
              ? 'You are not alone. Real help is one call away.'
              : "Tu n'es pas seul·e. Une écoute est à portée d'appel."}
          </h2>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {resources.map(r => {
          const name = isEn ? r.name_en : r.name_fr
          const hours = r.hours_fr
          return (
            <li
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-red-200/70">
                {CATEGORY_LABEL_FR[r.category] ?? r.category}
              </p>
              <p className="mt-1 text-base font-semibold text-white">{name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    data-testid={`emergency-phone-${r.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {r.phone}
                  </a>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/50 hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Site officiel
                  </a>
                )}
                {hours && <span className="text-xs text-white/40">· {hours}</span>}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-5 text-xs text-white/50">
        {isEn
          ? 'MUKTI is not a substitute for professional help. If you are in danger, call emergency services immediately.'
          : 'MUKTI ne remplace pas une prise en charge professionnelle. En danger immédiat, appelle les secours.'}
      </p>
    </div>
  )
}
