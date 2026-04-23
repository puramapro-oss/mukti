import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { CIRCLE_CATEGORIES, type CircleCategoryId } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Forum Cercles — MUKTI',
  description: 'Échange avec les pratiquants des cercles d\'intention.',
}

export const dynamic = 'force-dynamic'

interface ForumMessage {
  id: string
  circle_id: string
  user_id: string
  content: string
  created_at: string
  reactions_count: number
  author_name?: string | null
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ForumPage({ searchParams }: Props) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/cercles/forum')

  const params = await searchParams
  const activeCategory = params.category && CIRCLE_CATEGORIES.some((c) => c.id === params.category)
    ? (params.category as CircleCategoryId)
    : 'paix'

  const cat = CIRCLE_CATEGORIES.find((c) => c.id === activeCategory)!

  const service = createServiceClient()
  const { data: circles } = await service
    .from('circles')
    .select('id')
    .eq('category', activeCategory)
  const circleIds = (circles ?? []).map((c: { id: string }) => c.id)

  let messages: ForumMessage[] = []
  if (circleIds.length > 0) {
    const { data: rows } = await service
      .from('circle_messages')
      .select('id, circle_id, user_id, content, created_at, reactions_count')
      .eq('kind', 'forum')
      .is('deleted_at', null)
      .in('circle_id', circleIds)
      .order('created_at', { ascending: false })
      .limit(50)

    const msgs = (rows ?? []) as ForumMessage[]
    const authorIds = Array.from(new Set(msgs.map((m) => m.user_id)))
    if (authorIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', authorIds)

      const authorMap = new Map<string, string | null>()
      ;(profiles ?? []).forEach((p: { id: string; full_name: string | null }) => authorMap.set(p.id, p.full_name))
      messages = msgs.map((m) => ({ ...m, author_name: authorMap.get(m.user_id) ?? null }))
    } else {
      messages = msgs
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/dashboard/cercles"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux cercles
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: cat.color }}>
          Forum
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Partage {cat.name.toLowerCase()}</h1>
        <p className="mt-1 text-sm text-white/55">
          Témoignages, apprentissages, échanges. Les messages y sont publics.
        </p>
      </header>

      {/* Tabs catégories */}
      <div className="flex flex-wrap gap-2">
        {CIRCLE_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/cercles/forum?category=${c.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
              c.id === activeCategory
                ? 'border-white/30 bg-white/[0.08] text-white'
                : 'border-white/10 bg-white/[0.02] text-white/55 hover:bg-white/[0.05]'
            }`}
          >
            <span aria-hidden>{c.emoji}</span>
            <span>{c.name}</span>
          </Link>
        ))}
      </div>

      {/* Messages list */}
      {messages.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
          <MessageCircle className="h-8 w-8 text-white/40" />
          <p className="text-sm text-white/60">Personne n&apos;a encore pris la parole ici.</p>
          <p className="text-xs text-white/40">
            Rejoins un cercle {cat.name.toLowerCase()} et laisse un message après ta session.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {messages.map((m) => (
            <article
              key={m.id}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
              data-testid={`forum-msg-${m.id}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/70">{m.author_name ?? 'Âme anonyme'}</p>
                <time className="text-[11px] text-white/40" dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{m.content}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
