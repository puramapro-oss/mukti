import { NextResponse } from 'next/server'
import { getAnonymizedFeed } from '@/lib/wealth-engine'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET() {
  const feed = await getAnonymizedFeed(20)
  return NextResponse.json({ feed }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  })
}
