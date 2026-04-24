import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveProfileId } from '@/lib/ar'
import { createServiceClient } from '@/lib/supabase'
import ConnectOnboardingEmbedded from '@/components/billing/ConnectOnboardingEmbedded'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'KYC Wallet — MUKTI',
  robots: { index: false, follow: false },
}

export default async function WalletConnectPage() {
  const sb = await createServerSupabaseClient()
  const profileId = await resolveProfileId(sb)
  if (!profileId) redirect('/login?next=/dashboard/wallet/connect')
  const admin = createServiceClient()
  const { data } = await admin
    .from('stripe_connect_accounts')
    .select('onboarding_complete, kyc_status, payouts_enabled')
    .eq('user_id', profileId)
    .maybeSingle()
  const connect = data as { onboarding_complete: boolean; kyc_status: string; payouts_enabled: boolean } | null
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-2">KYC — Activation des retraits</h1>
        <p className="text-white/60 mb-6">
          Stripe sécurise la vérification d&apos;identité (KYC). Une fois validé, tu peux retirer tes gains à partir de 5€ directement sur ton IBAN.
        </p>
        {connect?.payouts_enabled && connect.kyc_status === 'verified' ? (
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
            <h2 className="text-xl font-semibold text-emerald-400 mb-2">✓ KYC validé</h2>
            <p className="text-white/70">Tu peux retirer tes gains depuis <a href="/dashboard/wallet" className="underline hover:text-white">ton wallet</a>.</p>
          </section>
        ) : (
          <ConnectOnboardingEmbedded />
        )}
      </div>
    </main>
  )
}
