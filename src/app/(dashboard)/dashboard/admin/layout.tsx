// MUKTI G8.6 — Layout admin (SSR guard super_admin + breadcrumb badge)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { isSuperAdminCurrentUser } from '@/lib/admin-settings'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { ok } = await isSuperAdminCurrentUser()
  if (!ok) redirect('/dashboard')

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <header className="sticky top-14 z-30 mb-4 border-b border-amber-500/20 bg-[#0A0A0F]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
              role="status"
              aria-label="Mode super administrateur actif"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mode admin actif
            </span>
          </div>
          <div className="text-xs text-white/40">MUKTI · god-mode</div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  )
}
