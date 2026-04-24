import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import AmbassadeurApplyForm from '@/components/ambassadeur/AmbassadeurApplyForm'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Candidature Ambassadeur — MUKTI',
  robots: { index: false, follow: false },
}

export default async function AmbassadeurApplyPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/ambassadeur/apply')
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Candidature Ambassadeur</h1>
        <p className="text-white/60 mb-8">Parle-nous de toi. Auto-approbation dès 10 conversions actives.</p>
        <AmbassadeurApplyForm />
      </div>
    </main>
  )
}
