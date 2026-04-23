import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-[family-name:var(--font-display)] text-6xl font-bold gradient-text">404</h1>
      <p className="text-[var(--text-secondary)]">Cette page n&apos;existe pas</p>
      <Link href="/" className="rounded-xl bg-[var(--cyan)]/10 px-6 py-3 text-[var(--cyan)] transition hover:bg-[var(--cyan)]/20">
        Retour a l&apos;accueil
      </Link>
    </div>
  )
}
