import { NextResponse } from 'next/server'
import { getImpactStats } from '@/lib/wealth-engine'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET() {
  const stats = await getImpactStats(false)
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
  })
}
