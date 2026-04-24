'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'

// Dynamic import to avoid SSR of Stripe Connect Embedded
const ConnectComponentsProvider = dynamic(
  () => import('@stripe/react-connect-js').then(mod => mod.ConnectComponentsProvider),
  { ssr: false },
)
const ConnectAccountOnboarding = dynamic(
  () => import('@stripe/react-connect-js').then(mod => mod.ConnectAccountOnboarding),
  { ssr: false },
)

interface ConnectInstance {
  // loadConnectAndInitialize-style opaque object from Stripe
  [key: string]: unknown
}

type StripeConnectJs = {
  loadConnectAndInitialize: (opts: {
    publishableKey: string
    fetchClientSecret: () => Promise<string>
    appearance?: { overlays?: string; variables?: Record<string, string> }
  }) => ConnectInstance
}

export default function ConnectOnboardingEmbedded() {
  const [instance, setInstance] = useState<ConnectInstance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const res = await fetch('/api/stripe-connect/session', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erreur Connect.')
        const clientSecret = data.client_secret as string
        const connectMod = await import('@stripe/connect-js') as unknown as StripeConnectJs
        const inst = connectMod.loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
          fetchClientSecret: async () => clientSecret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#7C3AED',
              colorBackground: '#0A0A0F',
              colorText: '#FFFFFF',
            },
          },
        })
        if (mounted) setInstance(inst)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur initialisation Connect.'
        if (mounted) setError(msg)
        toast.error(msg)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </div>
    )
  }
  if (error || !instance) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-6">
        <p className="text-red-300">{error ?? 'Impossible d\'initialiser Connect.'}</p>
      </div>
    )
  }
  return (
    <div data-testid="connect-onboarding-container" className="rounded-3xl border border-white/10 bg-white/[0.02] p-2 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 text-white/60 text-sm border-b border-white/10">
        <ShieldCheck className="h-4 w-4" />
        Vérification sécurisée par Stripe
      </div>
      {/* @ts-expect-error - Stripe Connect Embedded types accept "connectInstance" prop */}
      <ConnectComponentsProvider connectInstance={instance}>
        <ConnectAccountOnboarding
          onExit={() => {
            toast.success('Onboarding terminé. Vérification en cours.')
            setTimeout(() => window.location.reload(), 1200)
          }}
        />
      </ConnectComponentsProvider>
    </div>
  )
}
