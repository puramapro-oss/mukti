import Link from 'next/link'
import { FISCAL_PROFILES } from '@/lib/constants'
import { FileText, Shield, Info } from 'lucide-react'

export const metadata = {
  title: 'Fiscalité & transparence — MUKTI',
  description: 'Tout savoir sur la fiscalité des gains MUKTI : 4 profils auto-détectés (particulier, micro-entrepreneur, société, association).',
}

export default function FiscalPublicPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Fiscalité <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">transparente</span>
          </h1>
          <p className="text-xl text-white/70">
            MUKTI détecte automatiquement ton profil fiscal et te fournit un récapitulatif annuel prêt à déclarer.
          </p>
        </header>

        <section className="rounded-3xl border border-violet-500/30 bg-violet-500/[0.04] p-6">
          <div className="flex items-start gap-3">
            <Shield className="h-6 w-6 text-violet-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Ton devoir de déclaration</h2>
              <p className="text-white/80">
                Chaque gain reçu via MUKTI (parrainage, concours, mission) doit être déclaré selon ton statut.
                Notre PDF annuel te donne exactement les chiffres à reporter — profil détecté, total annuel, détail par type.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-6">Les 4 profils</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FISCAL_PROFILES.map(p => (
              <div
                key={p.id}
                data-testid={`fiscal-profile-${p.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-white/60" />
                  <h3 className="font-semibold">{p.label_fr}</h3>
                </div>
                {p.max_cents_per_year < Number.MAX_SAFE_INTEGER && (
                  <div className="text-xs text-white/50 mb-2">
                    Plafond annuel : {(p.max_cents_per_year / 100).toLocaleString('fr-FR')}€
                  </div>
                )}
                <p className="text-white/70 text-sm">{p.note_fr}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-start gap-3 mb-3">
            <Info className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-semibold mb-2">Comment ça marche</h2>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>• MUKTI calcule automatiquement ton total annuel (commissions + prix concours).</li>
                <li>• Le profil est détecté selon les seuils légaux français 2026.</li>
                <li>• Tu peux override manuellement ton profil si tu as une société existante (SIRET requis).</li>
                <li>• Chaque 1er janvier, un PDF récapitulatif N-1 est généré automatiquement (téléchargeable).</li>
                <li>• Les données sont conservées 10 ans (obligation comptable française).</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap gap-3">
          <Link href="/dashboard/fiscal" className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-3 font-semibold">
            Voir mon profil
          </Link>
          <Link href="/mentions-legales" className="rounded-full border border-white/20 px-6 py-3 text-sm hover:bg-white/[0.06]">
            Mentions légales
          </Link>
        </footer>

        <p className="text-xs text-white/40 text-center pt-8">
          Ces informations sont indicatives. Consulte un expert-comptable pour ta situation précise.
        </p>
      </div>
    </main>
  )
}
