import { createServerSupabaseClient } from './supabase-server'

/** Authentication comes from verified server cookies, never from a request user_id. */
export async function wellbeingProfile(): Promise<
  { id: string; status: 200 } | { id: null; status: 401 | 503 }
> {
  const sb = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (!user) return { id: null, status: authError && authError.status && authError.status >= 500 ? 503 : 401 }
  const { data, error } = await sb.schema('mukti').from('profiles')
    .select('id').eq('auth_user_id', user.id).maybeSingle()
  if (error) return { id: null, status: 503 }
  return data?.id ? { id: data.id as string, status: 200 } : { id: null, status: 401 }
}
