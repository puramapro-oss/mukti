// MUKTI G8.6 — Hub admin SSR : 10 cards god-mode + counts live

import Link from 'next/link'
import {
  Tag,
  MessageSquareQuote,
  Ticket,
  Users,
  ToggleRight,
  Sparkles,
  Heart,
  BarChart3,
  ScrollText,
  Server,
} from 'lucide-react'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface AdminCard {
  href: string
  label: string
  description: string
  Icon: typeof Tag
  accentClass: string
  badge?: string
}

async function fetchCounts(): Promise<{ promos: number; missions: number; flagsActive: number; auditTotal: number; commissionsPending: number; vidaAngelOn: boolean }> {
  const admin = createServiceClient()
  const [promosRes, missionsRes, settingsRes, auditRes, commissionsRes] = await Promise.all([
    admin.from('promos').select('id', { count: 'exact', head: true }).eq('active', true),
    admin.from('missions').select('id', { count: 'exact', head: true }),
    admin.from('admin_settings').select('key, value').in('key', ['feature_flags', 'vida_angel_active']),
    admin.from('admin_audit_log').select('id', { count: 'exact', head: true }),
    admin.from('commissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  const settings = (settingsRes.data ?? []) as Array<{ key: string; value: unknown }>
  const flags = (settings.find((s) => s.key === 'feature_flags')?.value as Record<string, boolean> | null) ?? {}
  const flagsActive = Object.values(flags).filter((v) => v === true).length
  const vidaAngelOn = settings.find((s) => s.key === 'vida_angel_active')?.value === true
  return {
    promos: promosRes.count ?? 0,
    missions: missionsRes.count ?? 0,
    flagsActive,
    auditTotal: auditRes.count ?? 0,
    commissionsPending: commissionsRes.count ?? 0,
    vidaAngelOn,
  }
}

export default async function AdminHubPage() {
  const counts = await fetchCounts()

  const cards: AdminCard[] = [
    {
      href: '/dashboard/admin/pricing',
      label: 'Pricing',
      description: 'Édite les prix mensuel, annuel, anti-churn — appliqué partout en live.',
      Icon: Tag,
      accentClass: 'from-violet-500/20 to-violet-500/5 border-violet-400/30',
    },
    {
      href: '/dashboard/admin/wording',
      label: 'Wording',
      description: '6 sections (greetings, errors, success, cta, faq, meta) — texte structuré.',
      Icon: MessageSquareQuote,
      accentClass: 'from-cyan-500/20 to-cyan-500/5 border-cyan-400/30',
    },
    {
      href: '/dashboard/admin/promos',
      label: 'Promos',
      description: 'CRUD codes promo Stripe — % ou montant fixe, durée, expiration.',
      Icon: Ticket,
      badge: `${counts.promos} actifs`,
      accentClass: 'from-amber-500/20 to-amber-500/5 border-amber-400/30',
    },
    {
      href: '/dashboard/admin/influenceurs',
      label: 'Influenceurs',
      description: 'Commissions ambassadeurs — overrides manuels pending → credited → paid.',
      Icon: Users,
      badge: `${counts.commissionsPending} pending`,
      accentClass: 'from-emerald-500/20 to-emerald-500/5 border-emerald-400/30',
    },
    {
      href: '/dashboard/admin/feature-flags',
      label: 'Feature flags',
      description: 'Active / désactive les modules MUKTI globalement (ar_mirror, aurora, …).',
      Icon: ToggleRight,
      badge: `${counts.flagsActive} ON`,
      accentClass: 'from-indigo-500/20 to-indigo-500/5 border-indigo-400/30',
    },
    {
      href: '/dashboard/admin/missions',
      label: 'Missions',
      description: 'CRUD missions communauté — points + cents + active/inactive.',
      Icon: Sparkles,
      badge: `${counts.missions} total`,
      accentClass: 'from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-400/30',
    },
    {
      href: '/dashboard/admin/vida-angel',
      label: 'VIDA ANGEL',
      description: 'Toggle global instantané — multiplicateur récompenses utilisateurs.',
      Icon: Heart,
      badge: counts.vidaAngelOn ? 'ON' : 'OFF',
      accentClass: counts.vidaAngelOn ? 'from-rose-500/30 to-rose-500/5 border-rose-400/50' : 'from-white/5 to-white/0 border-white/10',
    },
    {
      href: '/dashboard/admin/stats',
      label: 'Stats live',
      description: 'CA Stripe brut + split 50/10/40 + churn + top régions + users.',
      Icon: BarChart3,
      accentClass: 'from-teal-500/20 to-teal-500/5 border-teal-400/30',
    },
    {
      href: '/dashboard/admin/audit',
      label: 'Audit log',
      description: 'Historique de toutes les actions admin avec filtres et export CSV.',
      Icon: ScrollText,
      badge: `${counts.auditTotal} entrées`,
      accentClass: 'from-slate-500/20 to-slate-500/5 border-slate-400/30',
    },
    {
      href: '/dashboard/admin/system',
      label: 'Système',
      description: 'Statut Sentry, déploiements Vercel récents, env vars critiques.',
      Icon: Server,
      accentClass: 'from-sky-500/20 to-sky-500/5 border-sky-400/30',
    },
  ]

  return (
    <div className="space-y-8 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Centre de commande
        </h1>
        <p className="max-w-2xl text-sm text-white/60">
          God-mode Tissma. Toutes les modifications sont tracées dans l&apos;audit log et appliquées en temps réel.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/10 ${card.accentClass}`}
          >
            <div className="flex items-start justify-between">
              <span className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white">
                <card.Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {card.badge ? (
                <span className="rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
                  {card.badge}
                </span>
              ) : null}
            </div>
            <div className="mt-4 space-y-1">
              <h2 className="text-base font-semibold text-white">{card.label}</h2>
              <p className="text-xs leading-relaxed text-white/60">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="pt-2 text-xs text-white/40">
        Tip : toutes les actions sont tracées dans <Link href="/dashboard/admin/audit" className="text-violet-300 underline-offset-2 hover:underline">Audit log</Link>.
      </p>
    </div>
  )
}
