// MUKTI G8.6 — Sous-page admin VIDA ANGEL : toggle global instantané + multiplier

import { getSetting } from '@/lib/admin-settings'
import { VIDA_ANGEL_DEFAULT_MULTIPLIER } from '@/lib/constants'
import VidaAngelClient from './VidaAngelClient'

export const dynamic = 'force-dynamic'

export default async function AdminVidaAngelPage() {
  const [active, multiplier] = await Promise.all([
    getSetting<boolean>('vida_angel_active'),
    getSetting<number>('vida_angel_multiplier'),
  ])
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">VIDA ANGEL</h1>
        <p className="text-sm text-white/60">
          Mode bénédiction global : tant qu&apos;il est actif, toutes les récompenses utilisateurs sont multipliées
          par <em>multiplier</em>. Toggle instantané, pas d&apos;auto-fin — Tissma le désactive manuellement.
        </p>
      </header>
      <VidaAngelClient
        initialActive={active === true}
        initialMultiplier={typeof multiplier === 'number' && multiplier > 0 ? multiplier : VIDA_ANGEL_DEFAULT_MULTIPLIER}
      />
    </div>
  )
}
