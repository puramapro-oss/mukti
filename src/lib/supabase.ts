import { createBrowserClient } from '@supabase/ssr'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import { APP_SCHEMA } from './constants'

// Browser client — used in 'use client' components
// MUST use createBrowserClient from @supabase/ssr for PKCE OAuth flow
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: APP_SCHEMA } }
  )
}

// Service role client — used for admin operations (server-side only)
export function createServiceClient() {
  return createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: APP_SCHEMA } }
  )
}
