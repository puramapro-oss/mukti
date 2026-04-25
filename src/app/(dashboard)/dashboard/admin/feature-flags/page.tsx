// MUKTI G8.6 — Sous-page admin Feature Flags : toggles + add custom flag

import { getFeatureFlags } from '@/lib/admin-settings'
import FeatureFlagsClient from './FeatureFlagsClient'

export const dynamic = 'force-dynamic'

export default async function AdminFeatureFlagsPage() {
  const flags = await getFeatureFlags()
  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Feature flags</h1>
        <p className="text-sm text-white/60">
          Active / désactive les modules MUKTI globalement. Les changements sont appliqués en temps réel sur toutes
          les pages qui appellent <code className="rounded bg-white/10 px-1 text-white/80">getFeatureFlag()</code>.
        </p>
      </header>
      <FeatureFlagsClient initialFlags={flags} />
    </div>
  )
}
