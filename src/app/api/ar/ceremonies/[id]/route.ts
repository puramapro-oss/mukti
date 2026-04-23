// GET /api/ar/ceremonies/[id] — détail + participant count

import { NextResponse } from 'next/server'
import { getCeremony } from '@/lib/ar-ceremony'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Cérémonie introuvable.' }, { status: 400 })
  }
  const ceremony = await getCeremony(id)
  if (!ceremony) {
    return NextResponse.json({ error: 'Cérémonie introuvable.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, ceremony })
}
