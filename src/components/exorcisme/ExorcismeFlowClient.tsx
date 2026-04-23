'use client'

// MUKTI — G5.7 Wrapper client-only pour ExorcismeFlow (dynamic ssr:false).
// Permet le chargement côté client strict, obligatoire pour r3f + Canvas.

import dynamic from 'next/dynamic'

const ExorcismeFlow = dynamic(() => import('./ExorcismeFlow'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050308] text-white/60">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7]" />
        <p className="text-xs uppercase tracking-widest">Préparation de la séance…</p>
      </div>
    </div>
  ),
})

export default function ExorcismeFlowClient() {
  return <ExorcismeFlow />
}
