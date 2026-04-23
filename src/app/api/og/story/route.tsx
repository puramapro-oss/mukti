import { ImageResponse } from 'next/og'

export const runtime = 'edge'

type StoryType = 'streak' | 'palier' | 'mission' | 'gains' | 'classement' | 'achievement' | 'scan'

const VARIANTS: Record<StoryType, { emoji: string; tag: string; cta: string }> = {
  streak: { emoji: '🔥', tag: 'STREAK', cta: 'Je récupère ma part' },
  palier: { emoji: '🏆', tag: 'PALIER', cta: 'Rejoins le mouvement' },
  mission: { emoji: '🎯', tag: 'MISSION', cta: 'Je veux jouer aussi' },
  gains: { emoji: '💰', tag: 'GAINS', cta: 'Découvre tes aides' },
  classement: { emoji: '👑', tag: 'TOP 10', cta: 'Monte au classement' },
  achievement: { emoji: '✨', tag: 'BADGE', cta: 'Débloque le tien' },
  scan: { emoji: '🔍', tag: 'SCAN', cta: 'Lance ton scan gratuit' },
}

function clamp(s: string, n: number) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function escapeQuery(v: string | null, fallback: string) {
  return clamp((v ?? fallback).trim(), 80)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const rawType = (searchParams.get('type') ?? 'gains').toLowerCase() as StoryType
  const type: StoryType = (VARIANTS[rawType] ? rawType : 'gains') as StoryType
  const variant = VARIANTS[type]

  const headline = escapeQuery(searchParams.get('headline'), 'Récupère ce qui te revient')
  const value = escapeQuery(searchParams.get('value'), '+1 248 €')
  const sub = escapeQuery(searchParams.get('sub'), 'détectés en 30 secondes')
  const ref = (searchParams.get('ref') ?? '').replace(/[^A-Z0-9]/gi, '').slice(0, 16)
  const link = ref
    ? `mukti.purama.dev/r/${ref}`
    : 'mukti.purama.dev'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(120% 70% at 50% 0%, #052e22 0%, #04120c 35%, #0a0a0f 70%, #1a0f2e 100%)',
          padding: 80,
          fontFamily: 'sans-serif',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* aurora glow */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: -100,
            width: 700,
            height: 700,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(16,185,129,0) 60%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -250,
            right: -180,
            width: 800,
            height: 800,
            borderRadius: 9999,
            background: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0) 60%)',
            display: 'flex',
          }}
        />

        {/* brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontSize: 44,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              boxShadow: '0 12px 60px rgba(16,185,129,0.45)',
            }}
          >
            €
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>PURAMA AIDE</div>
            <div style={{ fontSize: 24, color: '#a8b1bf', marginTop: 4 }}>
              L&apos;argent que tu laisses sur la table
            </div>
          </div>
        </div>

        {/* tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 80,
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 96,
              filter: 'drop-shadow(0 8px 32px rgba(16,185,129,0.4))',
              display: 'flex',
            }}
          >
            {variant.emoji}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              padding: '14px 28px',
              borderRadius: 999,
              background: 'rgba(16,185,129,0.15)',
              border: '2px solid rgba(16,185,129,0.6)',
              color: '#86efac',
              letterSpacing: 4,
              display: 'flex',
            }}
          >
            {variant.tag}
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            lineHeight: 1.05,
            marginTop: 44,
            maxWidth: 920,
            zIndex: 2,
            display: 'flex',
          }}
        >
          {headline}
        </div>

        {/* value mega */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 64,
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              lineHeight: 0.95,
              backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #10B981 75%, #F59E0B 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: -6,
              display: 'flex',
            }}
          >
            {value}
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#cbd5e1',
              marginTop: 18,
              display: 'flex',
            }}
          >
            {sub}
          </div>
        </div>

        {/* spacer */}
        <div style={{ flex: 1, display: 'flex' }} />

        {/* CTA card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 36,
            borderRadius: 36,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
            }}
          >
            👉 {variant.cta}
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#10B981',
              marginTop: 16,
              fontWeight: 600,
              display: 'flex',
            }}
          >
            {link}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    },
  )
}
