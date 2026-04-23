import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hors ligne — MUKTI',
}

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-deep)] p-4 text-center">
      <WifiOff className="h-16 w-16 text-[var(--text-secondary)]" />
      <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">Pas de connexion</h1>
      <p className="mt-2 max-w-md text-[var(--text-secondary)]">
        Verifie ta connexion internet et reessaie. PURAMA a besoin d&apos;Internet pour fonctionner.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-gradient-to-r from-[var(--cyan)] to-[var(--purple)] px-6 py-3 font-medium text-white hover:opacity-90 transition-opacity"
      >
        Reessayer
      </Link>
    </div>
  )
}
