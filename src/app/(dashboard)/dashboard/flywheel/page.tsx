import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import SocialFeed from '@/components/wealth/SocialFeed'
import ImpactDashboard from '@/components/wealth/ImpactDashboard'
import Flywheel from '@/components/wealth/Flywheel'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Flywheel MUKTI — Mon impact',
  robots: { index: false, follow: false },
}

export default async function FlywheelDashboardPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/flywheel')
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold mb-2">Flywheel MUKTI</h1>
          <p className="text-white/60">Voir l&apos;impact collectif en temps réel.</p>
        </header>
        <ImpactDashboard />
        <Flywheel />
        <SocialFeed />
      </div>
    </main>
  )
}
