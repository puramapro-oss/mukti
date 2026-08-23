export default function ImpactCard({
  label,
  value,
  suffix,
  tint,
}: {
  label: string
  value: number
  suffix?: string
  tint: 'violet' | 'cyan' | 'emerald'
}) {
  const colors = {
    violet: { glow: 'rgba(124,58,237,0.15)', text: 'text-violet-200', accent: '#a78bfa' },
    cyan: { glow: 'rgba(6,182,212,0.15)', text: 'text-cyan-200', accent: '#67e8f9' },
    emerald: { glow: 'rgba(16,185,129,0.15)', text: 'text-emerald-200', accent: '#6ee7b7' },
  }
  const c = colors[tint]
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: `radial-gradient(circle at top, ${c.glow}, transparent)` }}
      />
      <div className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white">
        {new Intl.NumberFormat('fr-FR').format(value)}
        {suffix}
      </div>
      <div className={`mt-1 text-xs ${c.text}`}>{label}</div>
    </div>
  )
}
