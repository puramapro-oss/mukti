// CRON quotidien : supprime les replays expirés (> 7 jours) des tables + Supabase Storage.
// MVP : la création de replays sera ajoutée en G8 (Expo + recording). Cette route purge
// proactivement tout enregistrement existant.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) return true
  if (req.headers.get('x-vercel-cron')) return true
  return false
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  }

  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  // Sélectionne replays expirés
  const { data: expired, error } = await service
    .from('circle_replays')
    .select('id, audio_url')
    .lt('expires_at', nowIso)
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (expired ?? []).map((r: { id: string }) => r.id)
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, purged: 0 })
  }

  // Supprime les fichiers Storage si URL pointe vers bucket Supabase
  const bucket = 'circles-replays'
  const paths: string[] = []
  for (const r of expired as Array<{ audio_url: string }>) {
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = r.audio_url.indexOf(marker)
    if (idx >= 0) {
      paths.push(r.audio_url.substring(idx + marker.length))
    }
  }
  if (paths.length > 0) {
    await service.storage.from(bucket).remove(paths).catch(() => null)
  }

  // Supprime les rows
  const { error: delErr } = await service.from('circle_replays').delete().in('id', ids)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, purged: ids.length })
}

export async function GET(req: Request) {
  return POST(req)
}
