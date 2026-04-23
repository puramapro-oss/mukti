'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-[var(--pink)]">Erreur</h1>
      <p className="max-w-md text-center text-[var(--text-secondary)]">
        {error.message || 'Une erreur inattendue est survenue'}
      </p>
      <button onClick={reset} className="rounded-xl bg-[var(--cyan)]/10 px-6 py-3 text-[var(--cyan)] transition hover:bg-[var(--cyan)]/20">
        Reessayer
      </button>
    </div>
  )
}
