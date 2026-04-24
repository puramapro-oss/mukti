import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { createServiceClient } from '@/lib/supabase'
import { computeYearEarningsCents, upsertFiscalProfile } from '@/lib/fiscal'
import { FISCAL_PROFILES } from '@/lib/constants'
import { Download, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Mon dossier fiscal — MUKTI',
  robots: { index: false, follow: false },
}

export default async function DashboardFiscalPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/fiscal')
  const currentYear = new Date().getUTCFullYear()
  const [earningsYTD, profileType] = await Promise.all([
    computeYearEarningsCents(profileId, currentYear),
    upsertFiscalProfile(profileId),
  ])
  const admin = createServiceClient()
  const { data: declarations } = await admin
    .from('fiscal_declarations')
    .select('year, total_earned_cents, profile_type, pdf_url, generated_at')
    .eq('user_id', profileId)
    .order('year', { ascending: false })
  const decRows = (declarations ?? []) as Array<{ year: number; total_earned_cents: number; profile_type: string; pdf_url: string | null; generated_at: string }>
  const profileCfg = FISCAL_PROFILES.find(p => p.id === profileType)!

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Mon dossier fiscal</h1>
          <p className="text-white/60">
            Profil détecté automatiquement selon tes gains. PDF annuel prêt à déclarer.
          </p>
        </header>

        <section className="rounded-3xl border border-violet-500/30 bg-violet-500/[0.04] p-6">
          <div className="text-violet-300 text-sm uppercase tracking-wider mb-1">Profil détecté</div>
          <div className="text-2xl font-bold mb-3">{profileCfg.label_fr}</div>
          <p className="text-white/70 text-sm">{profileCfg.note_fr}</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-white/60 text-sm mb-1">Total gagné en {currentYear}</div>
          <div className="text-5xl font-bold text-emerald-400">
            {(earningsYTD / 100).toFixed(2).replace('.', ',')}€
          </div>
          <div className="text-sm text-white/50 mt-2">
            {profileCfg.max_cents_per_year < Number.MAX_SAFE_INTEGER
              ? `Plafond ${profileCfg.label_fr} : ${(profileCfg.max_cents_per_year / 100).toLocaleString('fr-FR')}€/an`
              : 'Sans plafond spécifique.'}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Historique des déclarations</h2>
          {decRows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-white/50 text-sm">
                Ton premier PDF annuel sera généré le 1er janvier prochain.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {decRows.map(d => (
                <li
                  key={d.year}
                  data-testid={`fiscal-decl-${d.year}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div>
                    <div className="font-semibold">Année {d.year}</div>
                    <div className="text-sm text-white/60">
                      Total : {(d.total_earned_cents / 100).toFixed(2).replace('.', ',')}€ · Profil : {d.profile_type}
                    </div>
                  </div>
                  {d.pdf_url ? (
                    <a
                      href={d.pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/[0.08] px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/[0.15]"
                    >
                      <Download className="h-4 w-4" /> PDF
                    </a>
                  ) : (
                    <Link
                      href={`/api/fiscal/pdf/${d.year}`}
                      className="inline-flex items-center gap-1 rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/[0.06]"
                    >
                      <FileText className="h-4 w-4" /> Générer
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-6 border-t border-white/10">
          <p className="text-xs text-white/40">
            Ces informations sont indicatives. Consulte un expert-comptable pour ta situation précise.
            Les données sont conservées 10 ans (obligation comptable française).
          </p>
        </footer>
      </div>
    </main>
  )
}
