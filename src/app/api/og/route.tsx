import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'MUKTI'
  const subtitle = searchParams.get('subtitle') ?? "Récupère tout l'argent que tu laisses sur la table — aides, remboursements, droits oubliés."

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #04120c 0%, #0a0a0f 60%, #1a0f2e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          padding: 80,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            fontSize: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#10B981',
          }}
        >
          <span style={{ fontSize: 48 }}>🌱</span>
          <span style={{ fontWeight: 800, letterSpacing: 2 }}>PURAMA</span>
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: 900,
            backgroundImage: 'linear-gradient(180deg, #ffffff 40%, #10B981 100%)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            color: '#a8b1bf',
            textAlign: 'center',
            marginTop: 32,
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            display: 'flex',
            gap: 24,
            fontSize: 24,
            color: '#d4af37',
          }}
        >
          <span>mukti.purama.dev</span>
          <span style={{ color: '#10B981' }}>•</span>
          <span>Récupère ce qui te revient</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
