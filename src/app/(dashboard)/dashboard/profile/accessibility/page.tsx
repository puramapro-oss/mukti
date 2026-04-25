// MUKTI G8.7.6 — Page settings accessibilité universelle

import AccessibilityClient from './AccessibilityClient'

export const dynamic = 'force-dynamic'

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-white">Accessibilité</h1>
        <p className="text-sm text-white/60">
          MUKTI s&apos;adapte à toi. Ajuste l&apos;app à tes besoins — sourd·e, malvoyant·e, hypersensible,
          neurodivergent·e, à mobilité réduite. Aucun jugement, juste de l&apos;écoute.
        </p>
      </header>
      <AccessibilityClient />
    </div>
  )
}
