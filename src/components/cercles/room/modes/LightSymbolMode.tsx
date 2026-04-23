'use client'

interface LightSymbolModeProps {
  category: string
  accentColor?: string
}

// Symbole adapté à la catégorie
const SYMBOLS: Record<string, string> = {
  abondance: '🌟',
  amour_soi: '❤️',
  apaisement: '🌊',
  motivation: '🔥',
  renouveau: '🌱',
  confiance: '💫',
  protection: '🧿',
  alignement: '🌈',
  paix: '🕊️',
  ancrage: '🌿',
  clarte: '✨',
  gratitude: '💎',
  liberation: '🦋',
  manifestation: '🌠',
}

export default function LightSymbolMode({ category, accentColor = '#7C3AED' }: LightSymbolModeProps) {
  const symbol = SYMBOLS[category] ?? '✨'
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)` }}
          aria-hidden
        />
        <span
          className="relative text-7xl"
          style={{ filter: `drop-shadow(0 0 20px ${accentColor}90)` }}
          aria-hidden
        >
          {symbol}
        </span>
      </div>
      <p className="text-xs text-white/40">Laisse la lumière te traverser</p>
    </div>
  )
}
