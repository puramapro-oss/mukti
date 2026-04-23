'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Heart, Users, Globe, Wind, Moon, Eye, HeartPulse } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { MUKTI_MODULES, APP_TAGLINE, APP_DESCRIPTION } from '@/lib/constants'

const moduleIcon: Record<string, typeof Heart> = {
  liberation: Sparkles,
  cercles: Users,
  core: Globe,
  ar: Eye,
  aurora: Wind,
  subconscient: Moon,
  accompagnants: HeartPulse,
}

export default function Home() {
  const { user, loading } = useAuth()
  const [showCinematic, setShowCinematic] = useState(false)
  const [counters, setCounters] = useState({ users: 0, circles: 0, breaths: 0 })

  // Cinematic intro (3-5s) on first visit
  useEffect(() => {
    try {
      const seen = localStorage.getItem('mukti-intro-seen')
      if (!seen) {
        setShowCinematic(true)
        const t = setTimeout(() => {
          setShowCinematic(false)
          localStorage.setItem('mukti-intro-seen', '1')
        }, 4000)
        return () => clearTimeout(t)
      }
    } catch {
      /* storage unavailable: silently skip */
    }
  }, [])

  // Live counters (DB-backed via /api/status — 0 if empty, never fake)
  useEffect(() => {
    let alive = true
    fetch('/api/status?metrics=counters', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return
        setCounters({
          users: data.users ?? 0,
          circles: data.circles ?? 0,
          breaths: data.breaths ?? 0,
        })
      })
      .catch(() => {
        /* keep zeros */
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-void)]" data-testid="landing-page">
      {/* Cinematic intro */}
      {showCinematic && <CinematicIntro onSkip={() => setShowCinematic(false)} />}

      {/* Background ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(124, 58, 237, 0.12) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(6, 182, 212, 0.08) 0%, transparent 50%)',
        }}
      />

      {/* App-style top bar (NO 13-section landing — minimal CTAs, ChatGPT-style) */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="MUKTI accueil">
          <span className="text-2xl" aria-hidden>🕉️</span>
          <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-white">MUKTI</span>
        </Link>
        <nav className="flex items-center gap-3">
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
            >
              Mon espace
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
                data-testid="hero-cta"
                className="rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
              >
                Commencer
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Bloc 1 — HERO (above-fold) */}
      <section className="relative mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center px-4 pb-12 pt-6 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs font-medium text-violet-200"
        >
          <span aria-hidden>मुक्ति</span>
          <span>Sanskrit • Libération</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl"
        >
          <span className="bg-gradient-to-r from-violet-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            {APP_TAGLINE}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-xl text-base text-white/70 sm:text-lg"
        >
          {APP_DESCRIPTION}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          {!user && (
            <>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-violet-500/30 transition-all hover:scale-[1.03]"
              >
                Commencer
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-8 py-4 text-base font-medium text-white/90 backdrop-blur transition-all hover:bg-white/10"
              >
                Se connecter
              </Link>
            </>
          )}
          {user && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-violet-500/30 transition-all hover:scale-[1.03]"
            >
              Continuer ma libération
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-5 text-xs text-white/40"
        >
          14 jours d&apos;essai gratuit. Sans engagement. Sans carte requise.
        </motion.p>
      </section>

      {/* Bloc 2 — MON IMPACT (compteurs DB dynamiques, jamais faux) */}
      <section
        aria-labelledby="impact-heading"
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"
      >
        <h2 id="impact-heading" className="sr-only">Notre impact collectif</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ImpactCard label="Pratiquants" value={counters.users} suffix=" âmes" tint="violet" />
          <ImpactCard label="Cercles d'Intention créés" value={counters.circles} suffix="" tint="cyan" />
          <ImpactCard label="Respirations partagées" value={counters.breaths} suffix="" tint="emerald" />
        </div>
        <p className="mx-auto mt-6 max-w-md text-center text-xs text-white/40">
          Compteurs en temps réel, jamais inventés. {counters.users === 0 ? 'Sois la première âme à rejoindre le mouvement.' : 'Tu n&apos;es pas seul·e.'}
        </p>
      </section>

      {/* Bloc 3 — 7 MODULES MUKTI (teaser, pas de 13-section landing) */}
      <section
        aria-labelledby="modules-heading"
        className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="modules-heading"
            className="font-[family-name:var(--font-display)] text-3xl font-bold text-white sm:text-4xl"
          >
            7 modules. 1 chemin.
          </h2>
          <p className="mt-4 text-sm text-white/60">
            Ni gourou. Ni hiérarchie. Juste des humains qui se libèrent ensemble.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MUKTI_MODULES.map((m, i) => {
            const Icon = moduleIcon[m.id] ?? Heart
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl transition-all hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div
                  aria-hidden
                  className="absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
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
              </motion.div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          {!user && (
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-violet-500/30 transition-all hover:scale-[1.03]"
            >
              Rejoindre le mouvement
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-white/40 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} MUKTI · SASU PURAMA · Frasne</p>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/mentions-legales" className="hover:text-white/70">Mentions légales</Link>
            <Link href="/politique-confidentialite" className="hover:text-white/70">Confidentialité</Link>
            <Link href="/cgv" className="hover:text-white/70">CGV</Link>
            <Link href="/cgu" className="hover:text-white/70">CGU</Link>
            <Link href="/cookies" className="hover:text-white/70">Cookies</Link>
            <Link href="/aide" className="hover:text-white/70">Aide</Link>
          </nav>
        </div>
        <p className="mx-auto mt-4 max-w-3xl px-4 text-center text-[11px] text-white/30">
          Expérience spirituelle personnelle, ne remplace aucun accompagnement médical ou psychologique. En cas d&apos;urgence : 112.
        </p>
      </footer>
    </div>
  )
}

// ----- ImpactCard -----
function ImpactCard({ label, value, suffix, tint }: { label: string; value: number; suffix?: string; tint: 'violet' | 'cyan' | 'emerald' }) {
  const colors = {
    violet: { glow: 'rgba(124,58,237,0.15)', text: 'text-violet-200', accent: '#a78bfa' },
    cyan: { glow: 'rgba(6,182,212,0.15)', text: 'text-cyan-200', accent: '#67e8f9' },
    emerald: { glow: 'rgba(16,185,129,0.15)', text: 'text-emerald-200', accent: '#6ee7b7' },
  }
  const c = colors[tint]
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl"
    >
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at top, ${c.glow}, transparent)` }} />
      <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white">
        {new Intl.NumberFormat('fr-FR').format(value)}{suffix}
      </div>
      <div className={`mt-1 text-xs ${c.text}`}>{label}</div>
    </div>
  )
}

// ----- CinematicIntro (3-5s, skipable) -----
function CinematicIntro({ onSkip }: { onSkip: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-void)]"
      role="dialog"
      aria-label="Cinématique d'introduction"
    >
      <motion.button
        type="button"
        onClick={onSkip}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 backdrop-blur hover:bg-white/10"
        whileHover={{ scale: 1.05 }}
      >
        Passer
      </motion.button>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          className="text-7xl sm:text-9xl"
          aria-hidden
        >
          🕉️
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-6 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white sm:text-6xl"
        >
          MUKTI
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-3 text-sm text-white/60"
        >
          मुक्ति · Libération
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
