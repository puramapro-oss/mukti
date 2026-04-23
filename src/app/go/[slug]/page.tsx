import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default async function GoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'vida_ai' } }
  )

  // Look up the referral code
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, referral_code')
    .eq('referral_code', slug)
    .single()

  if (profile) {
    // Track click on influencer stats
    void supabase.from('influencer_stats').select('clicks').eq('user_id', profile.id).single()

    // Redirect to signup with ref param
    redirect(`/signup?ref=${slug}`)
  }

  // Also check influencer slugs
  const { data: influencer } = await supabase
    .from('influencer_profiles')
    .select('user_id, slug')
    .eq('slug', slug)
    .single()

  if (influencer) {
    redirect(`/signup?ref=${slug}`)
  }

  // Unknown slug — redirect to home
  redirect('/')
}
