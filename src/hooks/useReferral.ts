'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { APP_DOMAIN } from '@/lib/constants'

export function useReferral() {
  const { user, profile } = useAuth()
  const [referralCount, setReferralCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const referralLink = profile?.referral_code ? `https://${APP_DOMAIN}/go/${profile.referral_code}` : ''
  const referralCode = profile?.referral_code ?? ''

  const fetchCount = useCallback(async () => {
    if (!user || !profile) return
    const { count } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', profile.id)
    setReferralCount(count ?? 0)
    setLoading(false)
  }, [user, profile, supabase])

  useEffect(() => {
    fetchCount()
  }, [fetchCount])

  let tier = 'debutant'
  if (referralCount >= 100) tier = 'legende'
  else if (referralCount >= 75) tier = 'diamant'
  else if (referralCount >= 50) tier = 'platine'
  else if (referralCount >= 25) tier = 'or'
  else if (referralCount >= 10) tier = 'argent'
  else if (referralCount >= 5) tier = 'bronze'

  return { referralLink, referralCode, referralCount, tier, loading, refetch: fetchCount }
}
