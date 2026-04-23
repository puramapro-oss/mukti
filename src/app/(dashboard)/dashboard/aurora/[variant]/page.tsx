import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AURORA_VARIANTS } from '@/lib/constants'
import { isValidVariant, getVariantTotalSec } from '@/lib/aurora'
import AuroraSessionPreview from '@/components/aurora/AuroraSessionPreview'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ variant: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { variant } = await params
  const v = AURORA_VARIANTS.find((x) => x.id === variant)
  return {
    title: v ? `AURORA ${v.name} — MUKTI` : 'AURORA — MUKTI',
    description: v?.description,
  }
}

export default async function AuroraVariantPage({ params }: PageProps) {
  const { variant } = await params
  if (!isValidVariant(variant)) notFound()

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/aurora/${variant}`)

  const meta = AURORA_VARIANTS.find((v) => v.id === variant)!
  const totalSec = getVariantTotalSec(variant)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0F] text-white">
      {/* Header flottant */}
      <header className="absolute left-0 right-0 top-0 z-30 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/dashboard/aurora"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            AURORA
          </Link>
          <div className="text-right">
            <div className="text-2xl font-light" style={{ color: meta.color }}>
              {meta.glyph} {meta.name}
            </div>
            <div className="text-xs text-white/50">
              {Math.round(totalSec / 60)} min · 5 phases
            </div>
          </div>
        </div>
      </header>

      {/* Canvas + preview driver demo */}
      <AuroraSessionPreview variant={variant} />

      {/* Disclaimer permanent (sécurité — brief section 5) */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 pb-6 text-center">
        <p className="mx-auto max-w-md px-6 text-[11px] leading-relaxed text-white/40">
          Pas d&apos;hyperventilation, pas de rétention longue. Si tu ressens des vertiges → repasse en SOFT ou arrête.
        </p>
      </footer>
    </main>
  )
}
