import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getResourcesBySection } from '@/lib/accompagnants'
import { ACCOMPAGNANT_SECTIONS, type AccompagnantSection } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  return {
    title: `${section} — Accompagnants — MUKTI`,
    description: `Ressources pour accompagnants : ${section}.`,
  }
}

export default async function AccompagnantsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const isValidSection = (ACCOMPAGNANT_SECTIONS as readonly string[]).includes(section)
  if (!isValidSection) notFound()
  const slug = section as AccompagnantSection

  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect(`/login?next=/dashboard/accompagnants/${section}`)

  const resources = await getResourcesBySection(slug)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href="/dashboard/accompagnants"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Retour aux sections
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
          <h1 className="text-2xl font-semibold text-white">Section en préparation</h1>
          <p className="mt-2 text-sm text-white/60">
            Les ressources de cette section arrivent bientôt. En attendant, NAMA-Aidant est là.
          </p>
          <Link
            href="/dashboard/accompagnants/nama-aidant"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Parler à NAMA
          </Link>
        </div>
      ) : (
        <>
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">
              Accompagnants
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-white" data-testid={`accomp-section-title-${slug}`}>
              {resources[0]!.title_fr}
            </h1>
          </header>

          <article className="space-y-6">
            {resources.map(r => (
              <section
                key={r.id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl"
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-base leading-relaxed text-white/85">{r.content_md_fr}</p>
                </div>
                {r.video_url && (
                  <div className="mt-4">
                    <video
                      controls
                      src={r.video_url}
                      className="w-full rounded-2xl"
                      aria-label={`Vidéo : ${r.title_fr}`}
                    />
                  </div>
                )}
                {r.audio_url && (
                  <div className="mt-4">
                    <audio
                      controls
                      src={r.audio_url}
                      className="w-full"
                      aria-label={`Audio : ${r.title_fr}`}
                    />
                  </div>
                )}
              </section>
            ))}
          </article>

          <div className="rounded-3xl border border-pink-400/30 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-6 backdrop-blur-xl">
            <p className="text-sm text-white/85">
              Besoin d'en parler ? NAMA-Aidant t'écoute sans jugement.
            </p>
            <Link
              href="/dashboard/accompagnants/nama-aidant"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Ouvrir la conversation
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
