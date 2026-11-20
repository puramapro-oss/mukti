// MUKTI G8.7.6 — Page settings accessibilité universelle

import AccessibilityClient from './AccessibilityClient'

export const dynamic = 'force-dynamic'

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] wrap-anywhere">Accessibilité</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Choisissez une taille de texte confortable, renforcez les contrastes du thème
          et réglez les mouvements et les vibrations selon vos préférences.
        </p>
      </header>
      <AccessibilityClient />
    </div>
  )
}
