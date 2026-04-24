'use client'

import { useRef, useState, useEffect } from 'react'
import { Loader2, Send, MessageCircleQuestion, AlertCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  distress_score?: number
  escalated?: boolean
}

interface EmergencyResource {
  id: string
  country_code: string
  category: string
  name_fr: string
  name_en: string
  phone: string | null
  url: string | null
  hours_fr: string | null
}

interface Props {
  initialSignalDistress?: boolean
  countryCode: string
  lang?: 'fr' | 'en'
}

export function QaChat({ initialSignalDistress = false, countryCode, lang = 'fr' }: Props) {
  const isEn = lang === 'en'
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: isEn
        ? "I'm here. Ask me anything about MUKTI, your path, addictions, or if you simply need to talk."
        : "Je suis là. Pose-moi une question sur MUKTI, ton chemin, les addictions, ou parle-moi simplement.",
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [emergencyResources, setEmergencyResources] = useState<EmergencyResource[]>([])
  const [showEmergency, setShowEmergency] = useState(initialSignalDistress)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialSignalDistress) {
      void loadEmergency()
    }
  }, [initialSignalDistress])

  async function loadEmergency() {
    try {
      const res = await fetch('/api/qa/distress-signal', { method: 'POST' })
      if (!res.ok) return
      const data = (await res.json()) as { resources: EmergencyResource[] }
      setEmergencyResources(data.resources ?? [])
      setShowEmergency(true)
    } catch {
      // silent
    }
  }

  async function send() {
    const q = input.trim()
    if (!q || sending) return
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/qa/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q, lang, country_code: countryCode }),
      })
      if (!res.ok) {
        setMessages(m => [
          ...m,
          {
            role: 'assistant',
            content: isEn
              ? 'A brief pause — I am back in a breath.'
              : 'Une brève respiration. Je reviens dans un souffle.',
          },
        ])
        return
      }
      const data = (await res.json()) as {
        answer: string
        distress_score: number
        escalated: boolean
      }
      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: data.answer,
          distress_score: data.distress_score,
          escalated: data.escalated,
        },
      ])
      if (data.escalated && !showEmergency) {
        await loadEmergency()
      }
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    } catch {
      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: isEn
            ? 'Network recovering. Try again in a moment.'
            : 'Le réseau reprend. Réessaie dans un instant.',
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {showEmergency && emergencyResources.length > 0 && (
        <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-300" aria-hidden="true" />
            <div className="flex-1 text-sm text-red-100">
              <p className="font-semibold">
                {isEn
                  ? 'You are not alone — resources nearby'
                  : "Tu n'es pas seul·e — ressources proches de toi"}
              </p>
              <ul className="mt-2 space-y-1">
                {emergencyResources.slice(0, 3).map(r => (
                  <li key={r.id}>
                    {r.phone && (
                      <a
                        href={`tel:${r.phone}`}
                        data-testid={`qa-emergency-${r.id}`}
                        className="underline hover:text-white"
                      >
                        {isEn ? r.name_en : r.name_fr} — {r.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 px-5 py-4">
          <div className="rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 p-2">
            <MessageCircleQuestion className="h-4 w-4 text-cyan-100" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">MUKTI</h2>
            <p className="text-xs text-white/50">
              {isEn ? 'AI companion · free · present' : 'Compagnon IA · libre · présent'}
            </p>
          </div>
        </header>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label={isEn ? 'Conversation with MUKTI' : 'Conversation avec MUKTI'}
          className="flex-1 space-y-4 overflow-y-auto p-5"
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-white'
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
                <span>{isEn ? 'Thinking…' : 'Je réfléchis…'}</span>
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
          <label className="sr-only" htmlFor="qa-chat-input">
            {isEn ? 'Your message to MUKTI' : 'Ton message à MUKTI'}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="qa-chat-input"
              data-testid="qa-chat-input"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 2000))}
              rows={2}
              placeholder={isEn ? 'Ask anything…' : 'Pose ta question…'}
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
              data-testid="qa-chat-send"
              className="inline-flex h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 px-5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isEn ? 'Send' : 'Envoyer'}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </form>
      </div>

      {!showEmergency && (
        <button
          type="button"
          onClick={() => void loadEmergency()}
          data-testid="qa-trigger-distress"
          className="self-start rounded-full border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-200 hover:border-red-400/60"
        >
          {isEn ? 'I do not feel well' : 'Je ne me sens pas bien'}
        </button>
      )}
    </div>
  )
}
