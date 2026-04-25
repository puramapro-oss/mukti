// MUKTI G8.6 — Sous-page admin Système : env vars présence + healthcheck APIs

import Link from 'next/link'
import { ShieldCheck, Server, Database, AlertCircle, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface EnvCheck {
  key: string
  label: string
  present: boolean
  hint?: string
}

function isPresent(key: string): boolean {
  const v = process.env[key]
  return typeof v === 'string' && v.trim().length > 0 && !v.includes('PLACEHOLDER') && !v.includes('___à_remplir')
}

interface HealthSection {
  label: string
  ok: boolean
  detail?: string
}

async function checkSupabase(): Promise<HealthSection> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return { label: 'Supabase auth', ok: false, detail: 'NEXT_PUBLIC_SUPABASE_URL manquant' }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${url}/auth/v1/health`, { signal: ctrl.signal, cache: 'no-store' }).catch(() => null)
    clearTimeout(t)
    if (!res || !res.ok) return { label: 'Supabase auth', ok: false, detail: `HTTP ${res?.status ?? 'timeout'}` }
    return { label: 'Supabase auth', ok: true, detail: `${url} → 200` }
  } catch (e) {
    return { label: 'Supabase auth', ok: false, detail: e instanceof Error ? e.message : 'erreur' }
  }
}

export default async function AdminSystemPage() {
  const envChecks: EnvCheck[] = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', present: isPresent('NEXT_PUBLIC_SUPABASE_URL') },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase service role', present: isPresent('SUPABASE_SERVICE_ROLE_KEY') },
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic (IA)', present: isPresent('ANTHROPIC_API_KEY') },
    { key: 'STRIPE_SECRET_KEY', label: 'Stripe (paiements)', present: isPresent('STRIPE_SECRET_KEY') },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook', present: isPresent('STRIPE_WEBHOOK_SECRET') },
    { key: 'RESEND_API_KEY', label: 'Resend (emails)', present: isPresent('RESEND_API_KEY') },
    { key: 'SENTRY_AUTH_TOKEN', label: 'Sentry monitoring', present: isPresent('SENTRY_AUTH_TOKEN') },
    { key: 'CRON_SECRET', label: 'CRON secret', present: isPresent('CRON_SECRET'), hint: 'requis pour /api/cron/* publics' },
    { key: 'TAVILY_API_KEY', label: 'Tavily (radar)', present: isPresent('TAVILY_API_KEY') },
    { key: 'OPENAI_API_KEY', label: 'OpenAI (Whisper)', present: isPresent('OPENAI_API_KEY') },
    { key: 'NEXT_PUBLIC_MAPBOX_TOKEN', label: 'Mapbox (Fil de Vie)', present: isPresent('NEXT_PUBLIC_MAPBOX_TOKEN') },
    { key: 'LIVEKIT_API_KEY', label: 'LiveKit (cercles SFU)', present: isPresent('LIVEKIT_API_KEY') },
  ]
  const supabaseHealth = await checkSupabase()

  const presentCount = envChecks.filter((e) => e.present).length

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Système</h1>
        <p className="text-sm text-white/60">
          Surveillance temps réel des dépendances critiques. Toutes les valeurs sont vérifiées par <em>présence</em>{' '}
          uniquement — jamais affichées en clair.
        </p>
      </header>

      <section aria-labelledby="env-section">
        <h2 id="env-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-sky-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Variables d&apos;environnement <span className="text-white/45">({presentCount} / {envChecks.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {envChecks.map((c) => (
            <div
              key={c.key}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                c.present ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-rose-400/30 bg-rose-500/5'
              }`}
            >
              <div className="min-w-0">
                <p className={`font-medium ${c.present ? 'text-emerald-100' : 'text-rose-100'}`}>{c.label}</p>
                <p className="font-mono text-[10px] text-white/45">{c.key}</p>
                {c.hint ? <p className="mt-0.5 text-[10px] text-white/50">{c.hint}</p> : null}
              </div>
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  c.present ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'
                }`}
              >
                {c.present ? 'OK' : 'Manquant'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="health-section">
        <h2 id="health-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-cyan-300">
          <Database className="h-4 w-4" aria-hidden="true" />
          Healthcheck en temps réel
        </h2>
        <div
          className={`rounded-2xl border p-4 ${
            supabaseHealth.ok ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-rose-400/30 bg-rose-500/5'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{supabaseHealth.label}</p>
              <p className="font-mono text-xs text-white/55">{supabaseHealth.detail}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                supabaseHealth.ok ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'
              }`}
            >
              {supabaseHealth.ok ? 'Opérationnel' : 'Dégradé'}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="links-section">
        <h2 id="links-section" className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-violet-300">
          <Server className="h-4 w-4" aria-hidden="true" />
          Tableaux de bord externes
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <a
            href="https://vercel.com/puramapro-oss/mukti/deployments"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 transition hover:border-white/20"
          >
            <span>Vercel deployments</span>
            <ExternalLink className="h-4 w-4 text-white/45" aria-hidden="true" />
          </a>
          <a
            href="https://sentry.io/organizations/purama/issues/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 transition hover:border-white/20"
          >
            <span>Sentry issues</span>
            <ExternalLink className="h-4 w-4 text-white/45" aria-hidden="true" />
          </a>
          <a
            href="https://eu.i.posthog.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 transition hover:border-white/20"
          >
            <span>PostHog analytics</span>
            <ExternalLink className="h-4 w-4 text-white/45" aria-hidden="true" />
          </a>
          <Link
            href="/dashboard/admin/audit"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85 transition hover:border-white/20"
          >
            <span>Audit log interne</span>
            <ExternalLink className="h-4 w-4 text-white/45" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {presentCount < envChecks.length ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm" role="status">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-300" aria-hidden="true" />
          <div className="space-y-1 text-amber-100/85">
            <p className="font-medium">{envChecks.length - presentCount} variable(s) manquante(s)</p>
            <p className="text-xs text-amber-100/70">
              Ajoute-les via <code className="rounded bg-black/30 px-1 text-amber-50">vercel env add NOM_VAR production --token $VERCEL_TOKEN --scope puramapro-oss</code> puis redéploie.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
