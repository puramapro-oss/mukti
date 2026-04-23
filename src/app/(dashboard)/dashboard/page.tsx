'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Users, Globe, Eye, Wind, Moon, HeartPulse, Wallet, Trophy, Flame } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MUKTI_MODULES, AWAKENING_LEVELS } from '@/lib/constants'
import Card from '@/components/ui/Card'

const moduleIcon: Record<string, typeof Sparkles> = {
  liberation: Sparkles,
  cercles: Users,
  core: Globe,
  ar: Eye,
  aurora: Wind,
  subconscient: Moon,
  accompagnants: HeartPulse,
}

const moduleHref: Record<string, string> = {
  liberation: '/dashboard/liberation',
  cercles: '/dashboard/cercles',
  core: '/dashboard/core',
  ar: '/dashboard/ar',
  aurora: '/dashboard/aurora',
  subconscient: '/dashboard/subconscient',
  accompagnants: '/dashboard/accompagnants',
}

function getAwakeningLevel(xp: number) {
  return AWAKENING_LEVELS.find((l) => xp >= l.min && xp <= l.max) ?? AWAKENING_LEVELS[0]
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Belle nuit'
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bel après-midi'
  if (hour < 22) return 'Bonsoir'
  return 'Belle nuit'
}

export default function DashboardPage() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="h-40 animate-pulse"><div /></Card>
        <Card className="h-32 animate-pulse"><div /></Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-white/60">Chargement de ton espace…</p>
      </div>
    )
  }

  const xp = profile.xp ?? 0
  const level = getAwakeningLevel(xp)
  const streakDays = profile.streak_days ?? 0
  const walletEur = ((profile.wallet_balance ?? 0) as number) / 100
  const points = profile.purama_points ?? 0
  const firstName = (profile.full_name ?? profile.email.split('@')[0]).split(' ')[0]

  return (
    <div className="mx-auto max-w-6xl space-y-8" data-testid="dashboard-page">
      {/* HERO greeting */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur-xl lg:p-10"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(124,58,237,0.18), transparent), radial-gradient(ellipse at bottom left, rgba(6,182,212,0.12), transparent)',
          }}
        />
        <p className="mb-2 text-sm uppercase tracking-wider text-white/50">{getGreeting()}</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {firstName}, prêt·e pour ta libération ?
        </h1>
        <p className="mt-4 max-w-xl text-sm text-white/60 lg:text-base">
          Choisis un module ci-dessous, ou laisse-toi guider par le module du jour.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/liberation"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
          >
            <Sparkles className="h-4 w-4" />
            Libération du jour
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/aurora"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur transition-all hover:bg-white/10"
          >
            <Wind className="h-4 w-4" />
            Respirer 7 min
          </Link>
        </div>
      </motion.section>

      {/* Stats grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Wallet" value={`${walletEur.toFixed(2)} €`} accent="cyan" href="/dashboard/wallet" />
        <StatCard icon={Sparkles} label="Points PURAMA" value={new Intl.NumberFormat('fr-FR').format(points)} accent="purple" href="/dashboard/missions" />
        <StatCard icon={Flame} label="Streak" value={`${streakDays} j`} accent="amber" href="/dashboard" />
        <StatCard icon={Trophy} label={`${level.name} ${level.emoji}`} value={`Niv. ${level.id}`} accent="emerald" href="/dashboard/profile" />
      </section>

      {/* 7 modules MUKTI */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white">
            Tes 7 chemins
          </h2>
          <span className="text-xs text-white/40">7 modules cœur</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MUKTI_MODULES.map((m, i) => {
            const Icon = moduleIcon[m.id] ?? Sparkles
            const href = moduleHref[m.id] ?? '/dashboard'
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  href={href}
                  className="group relative block overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl transition-all hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <div
                    aria-hidden
                    className="absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30"
                    style={{ background: m.color }}
                  />
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: `${m.color}20`, color: m.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
                    {m.emoji} {m.name}
                  </h3>
                  <p className="mt-2 text-sm text-white/60">{m.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-white/40 transition-colors group-hover:text-white/70">
                    Bientôt disponible
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: typeof Wallet
  label: string
  value: string
  accent: 'cyan' | 'purple' | 'amber' | 'emerald'
  href: string
}) {
  const colors = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300',
    purple: 'from-violet-500/20 to-violet-500/5 text-violet-300',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
  }
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl transition-all hover:border-white/15"
    >
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${colors[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </Link>
  )
}
