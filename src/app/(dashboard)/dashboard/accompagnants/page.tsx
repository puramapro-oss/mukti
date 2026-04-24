import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, MessageCircle, Sparkles } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  getAidantProfileForCurrentUser,
  getAllResourcesGrouped,
  listApprovedTestimonials,
} from '@/lib/accompagnants'
import { AidantOnboarding } from '@/components/accompagnants/AidantOnboarding'
import { TestimonialWall } from '@/components/accompagnants/TestimonialWall'
import { ACCOMPAGNANT_SECTIONS, type AccompagnantSection } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Espace Accompagnants — MUKTI',
  description:
    'Un espace pour celles et ceux qui accompagnent un proche en souffrance. 10 sections pour protéger ton énergie, ne pas porter la maladie de l\'autre, continuer à vivre.',
}

export const dynamic = 'force-dynamic'

const SECTION_TITLES: Record<AccompagnantSection, { fr: string; subtitle: string; icon: string }> = {
  'comprendre-le-malade': { fr: 'Comprendre le malade', subtitle: 'Entendre sans interpréter', icon: '🫂' },
  'proteger-ton-energie': { fr: 'Protéger ton énergie', subtitle: 'Techniques simples au quotidien', icon: '🛡️' },
  'ne-pas-prendre-sur-toi': { fr: 'Ne pas prendre la maladie sur toi', subtitle: 'Accompagner sans absorber', icon: '🕊️' },
  'apaisement-stress-chronique': { fr: 'Apaiser le stress chronique', subtitle: '3 piliers qui suffisent à 70%', icon: '🌿' },
  'micro-rituels-2-5min': { fr: 'Micro-rituels 2-5 min', subtitle: 'Des ancres dans la journée', icon: '⏱️' },
  'cercles-accompagnants': { fr: 'Cercles d\'aidants', subtitle: 'Parler à d\'autres qui vivent ça', icon: '⭕' },
  'temoignages-anonymes': { fr: 'Voix d\'aidants', subtitle: 'Tu n\'es pas seul·e', icon: '💬' },
  'outils-communication': { fr: 'Communiquer avec le malade', subtitle: 'Questions, silence, validation', icon: '🤝' },
  'lacher-prise-sans-culpabilite': { fr: 'Lâcher prise sans culpabilité', subtitle: 'Tu ne peux pas tout', icon: '🪶' },
  'continuer-a-vivre': { fr: 'Continuer à vivre', subtitle: 'Ta joie n\'insulte pas sa peine', icon: '☀️' },
}

export default async function AccompagnantsPage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/accompagnants')

  const [aidantProfile, grouped, testimonials] = await Promise.all([
    getAidantProfileForCurrentUser(),
    getAllResourcesGrouped(),
    listApprovedTestimonials(8),
  ])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">
          Espace Accompagnants
        </p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-white">
          Accompagner sans se perdre
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Cet espace est pour toi. Tu portes l'autre — tu as le droit de te poser.
          Dix sections pour t'outiller. NAMA-Aidant, un coach IA qui t'écoute. Et une communauté anonyme.
        </p>
      </header>

      {!aidantProfile ? (
        <AidantOnboarding />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Ton profil aidant·e</p>
          <div className="mt-3 flex flex-wrap items-end gap-5">
            <div>
              <p className="text-sm text-white/60">Tu accompagnes</p>
              <p className="mt-1 text-lg font-semibold text-white capitalize">{aidantProfile.lien_avec_malade}</p>
            </div>
            <div>
              <p className="text-sm text-white/60">Énergie actuelle</p>
              <p className="mt-1 text-lg font-semibold text-white">{aidantProfile.energy_level}/100</p>
            </div>
            <Link
              href="/dashboard/accompagnants/nama-aidant"
              data-testid="cta-nama-aidant"
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Parler à NAMA-Aidant
            </Link>
          </div>
        </div>
      )}

      <section aria-labelledby="sections-title">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 id="sections-title" className="text-2xl font-semibold text-white">
              10 sections pour t'appuyer
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Textes, rituels, audios. Avance à ton rythme.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-pink-300" aria-hidden="true" />
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOMPAGNANT_SECTIONS.map(slug => {
            const meta = SECTION_TITLES[slug]
            const count = grouped[slug]?.length ?? 0
            return (
              <li key={slug}>
                <Link
                  href={`/dashboard/accompagnants/${slug}`}
                  data-testid={`accomp-section-${slug}`}
                  className="group block h-full rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-pink-400/40 hover:bg-white/[0.06]"
                >
                  <span className="text-2xl" aria-hidden="true">{meta.icon}</span>
                  <h3 className="mt-3 text-base font-semibold text-white group-hover:text-pink-100">
                    {meta.fr}
                  </h3>
                  <p className="mt-1 text-xs text-white/50">{meta.subtitle}</p>
                  {count > 0 && (
                    <p className="mt-3 text-xs text-pink-300/80">
                      {count} ressource{count > 1 ? 's' : ''}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <TestimonialWall initial={testimonials} />

      <footer className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-6 text-center backdrop-blur-xl">
        <Heart className="mx-auto h-6 w-6 text-pink-300" aria-hidden="true" />
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80">
          « Ta joie n'insulte pas sa peine. Vivre pleinement est la plus belle façon
          d'honorer celui ou celle qui ne peut plus le faire autant. »
        </p>
      </footer>
    </div>
  )
}
