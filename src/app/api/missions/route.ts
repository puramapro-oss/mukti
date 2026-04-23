import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const type = url.searchParams.get('type')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '40'), 100)

  const sb = await createServerSupabaseClient()
  let query = sb
    .from('missions')
    .select('*')
    .eq('active', true)
    .order('reward_points', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ missions: data ?? [] })
}
