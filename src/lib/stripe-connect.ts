// MUKTI — G7 Stripe Connect Embedded Components
// Pattern : Express accounts + AccountSession serveur (pas de OAuth, pas de CONNECT_CLIENT_ID).
// Docs : https://docs.stripe.com/connect/embedded-components/overview

import { getStripe } from './stripe'

export async function createExpressAccount(params: {
  email: string
  country?: string
  userId: string
}) {
  const stripe = getStripe()
  return stripe.accounts.create({
    type: 'express',
    country: params.country ?? 'FR',
    email: params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { mukti_user_id: params.userId },
    business_type: 'individual',
  })
}

export async function createAccountSession(params: {
  accountId: string
  components?: {
    accountOnboarding?: boolean
    payments?: boolean
    payouts?: boolean
    notificationBanner?: boolean
  }
}) {
  const stripe = getStripe()
  const comps = params.components ?? {
    accountOnboarding: true,
    payments: true,
    payouts: true,
    notificationBanner: true,
  }
  return stripe.accountSessions.create({
    account: params.accountId,
    components: {
      account_onboarding: comps.accountOnboarding ? { enabled: true } : undefined,
      payments: comps.payments ? { enabled: true, features: { refund_management: false, dispute_management: false, capture_payments: false } } : undefined,
      payouts: comps.payouts ? { enabled: true } : undefined,
      notification_banner: comps.notificationBanner ? { enabled: true } : undefined,
    },
  })
}

export async function retrieveAccount(accountId: string) {
  const stripe = getStripe()
  return stripe.accounts.retrieve(accountId)
}

export async function createTransferToConnectedAccount(params: {
  destinationAccountId: string
  amountCents: number
  currency?: string
  description?: string
  metadata?: Record<string, string>
}) {
  const stripe = getStripe()
  return stripe.transfers.create({
    amount: params.amountCents,
    currency: params.currency ?? 'eur',
    destination: params.destinationAccountId,
    description: params.description,
    metadata: params.metadata,
  })
}
