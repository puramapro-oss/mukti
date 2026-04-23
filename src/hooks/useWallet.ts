'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from './useAuth'

interface WalletState {
  balance: number
  points: number
  totalRecovered: number
  loading: boolean
}

export function useWallet() {
  const { user, profile } = useAuth()
  const [state, setState] = useState<WalletState>({ balance: 0, points: 0, totalRecovered: 0, loading: true })
  const supabase = createClient()

  const fetchWallet = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('wallet_balance, purama_points, total_money_recovered')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (data) {
      setState({
        balance: Number(data.wallet_balance ?? 0),
        points: Number(data.purama_points ?? 0),
        totalRecovered: Number(data.total_money_recovered ?? 0),
        loading: false,
      })
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [user, supabase])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  // Use profile updates as trigger
  useEffect(() => {
    if (profile) {
      setState({
        balance: Number(profile.wallet_balance ?? 0),
        points: Number(profile.purama_points ?? 0),
        totalRecovered: Number(profile.total_money_recovered ?? 0),
        loading: false,
      })
    }
  }, [profile])

  return { ...state, refetch: fetchWallet }
}
