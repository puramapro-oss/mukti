import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Eye, HeartHandshake, Sparkles, Users } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'Miroir Énergétique AR — MUKTI',
  description: 'Vois-toi transformé, ressens l\'énergie entre tes mains, envoie soin et intention. Seul ou synchronisé à la seconde près avec le monde.',
}

export const dynamic = 'force-dynamic'

export default async function ArHomePage() {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/ar')

  const service = createServiceClient()
  const { data: liveRow } = await service
    .from('ar_ceremonies')
    .select('id, title, scheduled_at, status')
    .in('status', ['upcoming', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const nextCeremony = liveRow as { id: string; title: string; scheduled_at: string; status: 'upcoming' | 'live' } | null

  const cards = [
    {
      href: '/dashboard/ar/soin',
      icon: HeartHandshake,
      badge: 'Soin',
      title: 'Soin pour moi',
      description: 'Pose tes mains fantômes sur ton corps, respire, reçois.',
      accent: 'from-[var(--cyan)]/20 to-transparent',
      accentColor: 'text-[var(--cyan)]',
    },
    {
      href: '/dashboard/ar/manifestation',
      icon: Sparkles,
      badge: 'Manifestation',
      title: 'Envoyer de l\'énergie',
      description: 'Vise un refuge, une cause, un·e proche — émets le rayon.',
      accent: 'from-[var(--purple)]/25 to-transparent',
      accentColor: 'text-[var(--purple)]',
    },
    {
      href: '/dashboard/ar/ceremony',
      icon: Users,
      badge: 'Cérémonie',
      title: 'Moment Z collectif',
      description: 'Synchronisation à la seconde près avec tous les autres.',
      accent: 'from-[var(--accent)]/20 to-transparent',
      accentColor: 'text-[var(--accent)]',
    },
  ] as const

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--purple)]">
            Miroir Énergétique ∞
          </p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight text-white">
            Vois ce que tu ne voyais pas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Ton corps devient lumière, tes mains deviennent antennes. Choisis une espèce, choisis une cible,
            ressens l&apos;énergie circuler. 100% local, rien n&apos;est envoyé sur nos serveurs.
          </p>
        </div>
        <Link
          href="/dashboard/ar/training/soin"
          data-testid="ar-training-link"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/85 transition-colors hover:bg-white/10"
        >
          <Eye className="h-4 w-4" /> Formation guidée
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              data-testid={`ar-card-${card.badge.toLowerCase()}`}
              className={`group relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.04]`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-70 transition-opacity group-hover:opacity-100`} />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${card.accentColor}`}>
                    {card.badge}
                  </span>
                  <Icon className={`h-5 w-5 ${card.accentColor}`} />
                </div>
                <h2 className="text-xl font-semibold text-white">{card.title}</h2>
                <p className="text-sm text-white/55">{card.description}</p>
              </div>
              <span className="relative mt-6 text-xs text-white/40 transition-colors group-hover:text-white/70">
                Entrer →
              </span>
            </Link>
          )
        })}
      </section>

      {nextCeremony && (
        <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[var(--purple)]/10 to-transparent p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                Prochaine cérémonie
              </p>
              <h3 className="mt-1 text-lg font-medium text-white">{nextCeremony.title}</h3>
              <p className="mt-1 text-xs text-white/50">
                {new Date(nextCeremony.scheduled_at).toLocaleString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <Link
              href={`/dashboard/ar/ceremony/${nextCeremony.id}`}
              data-testid="ar-next-ceremony"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              <Users className="h-4 w-4" /> Voir le détail
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h3 className="text-base font-medium text-white">Comment ça marche</h3>
        <ul className="mt-3 space-y-2 text-sm text-white/60">
          <li>
            <span className="text-white/80">Caméra = miroir.</span> Ta silhouette lumineuse apparaît à l&apos;écran —
            rien n&apos;est envoyé, tout reste sur ton appareil.
          </li>
          <li>
            <span className="text-white/80">Tes mains = antennes.</span> Bouge-les : l&apos;énergie suit.
          </li>
          <li>
            <span className="text-white/80">Pas de caméra ?</span> Pas grave. Active le mode imaginaire : la silhouette
            est animée, l&apos;expérience reste complète.
          </li>
          <li>
            <span className="text-white/80">Ensemble ou seul·e.</span> Au Moment Z hebdomadaire, tu te synchronises avec
            d&apos;autres à la seconde près, sans rien d&apos;autre que ta présence.
          </li>
        </ul>
      </section>
    </div>
  )
}
