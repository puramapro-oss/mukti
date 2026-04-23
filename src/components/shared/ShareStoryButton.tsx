'use client'

import { useState } from 'react'
import { Share2, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type StoryType = 'streak' | 'palier' | 'mission' | 'gains' | 'classement' | 'achievement' | 'scan'

interface ShareStoryButtonProps {
  type: StoryType
  headline: string
  value: string
  sub?: string
  className?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

interface ShareApiResponse {
  ok: boolean
  share_id: string
  image_url: string
  points_given: number
  daily_remaining: number
  referral_url: string
}

interface SharePlatform {
  id: 'native' | 'whatsapp' | 'twitter' | 'facebook' | 'telegram' | 'instagram' | 'tiktok' | 'snapchat' | 'copy'
  label: string
  emoji: string
  href?: (text: string, url: string) => string
  copyOnly?: boolean
}

const PLATFORMS: SharePlatform[] = [
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', href: (t, u) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { id: 'twitter', label: 'Twitter / X', emoji: '𝕏', href: (t, u) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { id: 'facebook', label: 'Facebook', emoji: '📘', href: (_t, u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'telegram', label: 'Telegram', emoji: '✈️', href: (t, u) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { id: 'instagram', label: 'Instagram Story', emoji: '📸', copyOnly: true },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', copyOnly: true },
  { id: 'snapchat', label: 'Snapchat', emoji: '👻', copyOnly: true },
]

export default function ShareStoryButton({
  type,
  headline,
  value,
  sub,
  className,
  label = 'Partager en story',
  variant = 'secondary',
  size = 'md',
}: ShareStoryButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ShareApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function openModal() {
    setOpen(true)
    setError(null)
    if (data) return
    setLoading(true)
    try {
      const res = await fetch('/api/story/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, headline, value, sub, shared_to: 'native' }),
      })
      const json = (await res.json().catch(() => null)) as Partial<ShareApiResponse> & { error?: string } | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'Impossible de générer ta story.')
        setLoading(false)
        return
      }
      setData(json as ShareApiResponse)
    } catch {
      setError('Connexion impossible. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  function shareText() {
    return `${headline} — ${value}${sub ? ` (${sub})` : ''} via MUKTI`
  }

  async function copy(text: string, id: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 1800)
      }
    } catch {
      setCopiedId(null)
    }
  }

  function trackPlatform(platform: SharePlatform['id']) {
    void fetch('/api/story/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, headline, value, sub, shared_to: platform }),
    }).catch(() => {})
  }

  async function tryNativeShare() {
    if (!data) return
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'MUKTI',
          text: shareText(),
          url: data.referral_url,
        })
        trackPlatform('native')
      } catch {
        // user cancelled — silent
      }
    } else {
      void copy(`${shareText()} ${data.referral_url}`, 'native')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={openModal}
        icon={<Share2 className="h-4 w-4" />}
        className={cn(className)}
        data-testid="share-story-trigger"
      >
        {label}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="🚀 Partage ta story"
        className="max-w-xl"
      >
        <div className="flex flex-col gap-5" data-testid="share-story-modal">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12 text-[var(--text-secondary)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Génération de ta story…</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                {/* Story image preview — 9:16 ratio */}
                <div className="relative w-full" style={{ aspectRatio: '9 / 16', maxHeight: 460 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.image_url}
                    alt="Story MUKTI"
                    className="absolute inset-0 h-full w-full object-cover"
                    data-testid="share-story-image"
                  />
                </div>
              </div>

              {data.points_given > 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  ✨ +{data.points_given} points crédités · encore {data.daily_remaining} partages aujourd&apos;hui
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Limite quotidienne atteinte (3/jour). Ton image reste partageable, mais sans bonus de points.
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={tryNativeShare}
                  icon={<Share2 className="h-4 w-4" />}
                  data-testid="share-story-native"
                >
                  Partager (système)
                </Button>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PLATFORMS.map(p => {
                    const text = shareText()
                    const url = data.referral_url
                    if (p.copyOnly) {
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            void copy(`${text} ${url}`, p.id)
                            trackPlatform(p.id)
                          }}
                          className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10"
                          data-testid={`share-story-${p.id}`}
                        >
                          <span>{p.emoji}</span>
                          <span>{copiedId === p.id ? 'Copié !' : p.label}</span>
                        </button>
                      )
                    }
                    return (
                      <a
                        key={p.id}
                        href={p.href!(text, url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackPlatform(p.id)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-white/10"
                        data-testid={`share-story-${p.id}`}
                      >
                        <span>{p.emoji}</span>
                        <span>{p.label}</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--text-secondary)]">
                  <code className="flex-1 truncate font-mono text-[11px] text-[var(--text-primary)]">
                    {data.referral_url}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(data.referral_url, 'link')}
                    className="rounded-md p-1.5 hover:bg-white/10"
                    aria-label="Copier le lien"
                    data-testid="share-story-copy-link"
                  >
                    {copiedId === 'link' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <a
                  href={data.image_url}
                  download={`purama-aide-story-${type}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                  data-testid="share-story-download"
                >
                  Télécharger l&apos;image (1080×1920)
                </a>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
