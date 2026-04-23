'use client'

import { useMemo, useRef, useState } from 'react'
import { FAQ_ITEMS, FAQ_CATEGORIES, type FaqItem } from './faq-data'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export default function AideClient() {
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = useMemo<FaqItem[]>(() => {
    const q = query.trim().toLowerCase()
    return FAQ_ITEMS.filter((it) => {
      if (activeCat !== 'all' && it.category !== activeCat) return false
      if (!q) return true
      const hay = `${it.question} ${it.answer} ${it.keywords.join(' ')}`.toLowerCase()
      return q.split(/\s+/).every((token) => hay.includes(token))
    })
  }, [query, activeCat])

  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        'Salut 👋 Je suis MUKTI, l\'assistante de MUKTI. Pose-moi ta question : scanner, démarches, wallet, premium… j\'ai la réponse !',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setChatError(null)
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    try {
      const res = await fetch('/api/aide/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-8) }),
      })
      const data = (await res.json()) as { reply?: string; error?: string }
      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? 'Erreur inconnue')
      }
      setMessages((cur) => [...cur, { role: 'assistant', content: data.reply! }])
      setTimeout(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="glass rounded-2xl p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Cherche : scanner, wallet, premium, parrainage…"
          className="w-full bg-transparent px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          aria-label="Rechercher dans l'aide"
          data-testid="aide-search-input"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catégories d'aide">
        <CategoryChip
          id="all"
          label="Tout"
          icon="📚"
          active={activeCat === 'all'}
          onClick={() => setActiveCat('all')}
        />
        {FAQ_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.id}
            id={c.id}
            label={c.label}
            icon={c.icon}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
          />
        ))}
      </div>

      {/* FAQ list */}
      <div className="space-y-3" data-testid="aide-faq-list">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-[var(--text-muted)] mb-4">
              Aucun article ne correspond. Demande directement à MUKTI :
            </p>
            <button
              type="button"
              onClick={() => {
                setChatOpen(true)
                setInput(query)
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--cyan)] px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
              data-testid="aide-empty-ask"
            >
              💬 Poser ma question à MUKTI
            </button>
          </div>
        ) : (
          filtered.map((it) => (
            <FaqRow
              key={it.id}
              item={it}
              open={openId === it.id}
              onToggle={() => setOpenId(openId === it.id ? null : it.id)}
            />
          ))
        )}
      </div>

      {/* Floating chat */}
      <button
        type="button"
        onClick={() => setChatOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[var(--cyan)] px-5 py-3 text-sm font-semibold text-black shadow-2xl hover:scale-105 transition-transform"
        data-testid="aide-chat-toggle"
      >
        <span aria-hidden="true">💬</span>
        {chatOpen ? 'Fermer le chat MUKTI' : 'Demander à MUKTI'}
      </button>

      {chatOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-[min(92vw,420px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-card)] shadow-2xl"
          data-testid="aide-chat-panel"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">MUKTI</p>
              <p className="text-xs text-[var(--text-muted)]">Réponse instantanée · 24/7</p>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <div ref={scrollerRef} className="max-h-[50vh] flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--cyan)] px-3 py-2 text-sm text-black'
                    : 'mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 px-3 py-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 px-3 py-2 text-sm text-[var(--text-muted)]">
                MUKTI réfléchit…
              </div>
            )}
            {chatError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {chatError}
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2 border-t border-white/10 bg-white/5 px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose ta question…"
              maxLength={1000}
              disabled={sending}
              className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]/40"
              aria-label="Message"
              data-testid="aide-chat-input"
            />
            <button
              type="submit"
              disabled={sending || input.trim().length === 0}
              className="rounded-full bg-[var(--cyan)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              data-testid="aide-chat-send"
            >
              →
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function CategoryChip({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: string
  label: string
  icon: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-[var(--cyan)] px-4 py-2 text-sm font-semibold text-black'
          : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10 transition-colors'
      }
      data-testid={`aide-cat-${id}`}
    >
      <span className="mr-1.5">{icon}</span>
      {label}
    </button>
  )
}

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
        data-testid={`aide-faq-${item.id}`}
      >
        <span className="font-medium text-[var(--text-primary)]">{item.question}</span>
        <span
          className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-white/5 px-5 py-4 text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
          {item.answer}
        </div>
      )}
    </div>
  )
}
