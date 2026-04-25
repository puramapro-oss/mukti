// MUKTI G8.6 — Sous-page admin Missions : CRUD missions communauté

import { listMissionsAdmin } from '@/lib/admin-missions'
import MissionsClient from './MissionsClient'

export const dynamic = 'force-dynamic'

export default async function AdminMissionsPage() {
  const missions = await listMissionsAdmin()
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Missions</h1>
        <p className="text-sm text-white/60">
          CRUD des missions communauté. Chaque mission peut récompenser des points (Karma) et / ou un montant en
          cents (cagnotte solidaire). Le slug doit être unique.
        </p>
      </header>
      <MissionsClient initialMissions={missions} />
    </div>
  )
}
