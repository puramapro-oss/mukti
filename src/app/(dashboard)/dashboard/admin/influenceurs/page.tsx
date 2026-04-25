// MUKTI G8.6 — Sous-page admin Influenceurs : commissions ambassadeurs

import { listCommissionsAdmin } from '@/lib/admin-commissions'
import InfluenceursClient from './InfluenceursClient'

export const dynamic = 'force-dynamic'

export default async function AdminInfluenceursPage() {
  const initial = await listCommissionsAdmin({ limit: 50, offset: 0 })
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Commissions ambassadeurs</h1>
        <p className="text-sm text-white/60">
          Override manuel des statuts <em>pending</em> → <em>credited</em> → <em>paid</em>. Chaque modification est
          tracée dans l&apos;audit log avec le before/after JSON complet.
        </p>
      </header>
      <InfluenceursClient initial={initial} />
    </div>
  )
}
