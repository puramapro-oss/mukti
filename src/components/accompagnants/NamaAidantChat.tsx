'use client'

import { useRef, useState } from 'react'
import { Loader2, Send, Heart } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function NamaAidantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Je suis là. Dis-moi comment tu te sens en ce moment — sans filtre. L'énergie que tu mets à accompagner compte autant que tout le reste.",
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send() {
    const q = input.trim()
    if (!q || sending) return
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/accompagnants/nama-aidant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          history: next.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) {
        setMessages(m => [
          ...m,
          { role: 'assistant', content: "Le réseau reprend son souffle. Dis-moi à nouveau dans un instant." },
        ])
        return
      }
      const data = (await res.json()) as { answer: string }
      setMessages(m => [...m, { role: 'assistant', content: data.answer }])
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    } catch {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: "Une brève respiration. Je suis à nouveau disponible dans un instant." },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
      <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-purple-500/10 px-5 py-4">
        <div className="rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 p-2">
          <Heart className="h-4 w-4 text-pink-200" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">NAMA-Aidant</h2>
          <p className="text-xs text-white/50">Coach IA dédié à toi, l'aidant·e</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation avec NAMA-Aidant"
        className="flex-1 space-y-4 overflow-y-auto p-5"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-pink-500/30 to-purple-500/30 text-white'
                  : 'border border-white/10 bg-white/[0.04] text-white/90'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>NAMA réfléchit…</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          void send()
        }}
        className="border-t border-white/10 bg-black/20 p-3"
      >
        <label className="sr-only" htmlFor="nama-aidant-input">
          Ton message à NAMA-Aidant
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="nama-aidant-input"
            data-testid="nama-aidant-input"
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 2000))}
            rows={2}
            placeholder="Écris ce qui te traverse…"
            className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            data-testid="nama-aidant-send-btn"
            className="inline-flex h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Envoyer à NAMA-Aidant"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  )
}
