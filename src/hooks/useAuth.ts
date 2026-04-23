'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { SUPER_ADMIN_EMAIL } from '@/lib/constants'
import type { Profile } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const profileAuthIdRef = useRef<string | null>(null)
  const supabase = createClient()

  const fetchProfile = useCallback(async (authUserId: string) => {
    if (profileAuthIdRef.current === authUserId && profile) return
    profileAuthIdRef.current = authUserId

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (data) setProfile(data as Profile)
  }, [supabase, profile])

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) await fetchProfile(s.user.id)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (event === 'TOKEN_REFRESHED') return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) await fetchProfile(s.user.id)
        else {
          setProfile(null)
          profileAuthIdRef.current = null
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string, fullName: string, referralCode?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referralCode ? { referral_code: referralCode } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }, [supabase])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error }
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    try {
      localStorage.clear()
      document.cookie.split(';').forEach((c) => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
      })
    } catch { /* ignore */ }
    window.location.href = '/login'
  }, [supabase])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    })
    return { error }
  }, [supabase])

  const refetch = useCallback(async () => {
    if (user) {
      profileAuthIdRef.current = null
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL || profile?.role === 'super_admin'

  const effectivePlan: Profile['subscription_plan'] = isSuperAdmin
    ? 'premium'
    : (profile?.subscription_plan ?? 'free')

  return {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refetch,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin: isSuperAdmin,
    plan: effectivePlan,
  }
}
