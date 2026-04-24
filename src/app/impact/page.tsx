import Link from 'next/link'
import SocialFeed from '@/components/wealth/SocialFeed'
import ImpactDashboard from '@/components/wealth/ImpactDashboard'
import Flywheel from '@/components/wealth/Flywheel'

export const metadata = {
  title: 'Impact collectif — MUKTI',
  description: 'La transparence au cœur de MUKTI. 50% du CA redistribué, 10% pour l\'association, 40% pour faire grandir la mission.',
}

export const dynamic = 'force-dynamic'

export default function ImpactPublicPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-16">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold mb-4">
            L&apos;impact <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">collectif</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Ensemble, on transforme. Chaque euro qui circule soutient des vies libérées, des communautés qui s&apos;aident.
          </p>
        </header>

        <ImpactDashboard />

        <Flywheel />

        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-violet-500/30 bg-violet-500/[0.04] p-6">
            <h3 className="text-xl font-semibold mb-3">La redistribution 50/10/40</h3>
            <ul className="space-y-2 text-white/80 text-sm">
              <li><strong className="text-emerald-400">50%</strong> — pool membres (concours, parrainage, récompenses)</li>
              <li><strong className="text-amber-400">10%</strong> — Association PURAMA (loi 1901)</li>
              <li><strong className="text-violet-400">40%</strong> — SASU PURAMA (infrastructure, équipe, R&amp;D)</li>
            </ul>
            <p className="text-xs text-white/50 mt-3">
              Horodatage blockchain Bitcoin des règlements concours via OpenTimestamps.
            </p>
          </div>

          <SocialFeed />
        </section>

        <footer className="text-center pt-8">
          <Link href="/signup" className="inline-block rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3 font-semibold">
            Rejoindre MUKTI
          </Link>
        </footer>
      </div>
    </main>
  )
}
