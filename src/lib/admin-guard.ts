// MUKTI G8.6 — Guard centralisé super_admin pour APIs /api/admin/*

import { NextResponse } from 'next/server'
import { isSuperAdminCurrentUser } from './admin-settings'
import { rateLimit } from './rate-limit'

export interface AdminGuardOk {
  ok: true
  userId: string
  ip: string
  userAgent: string
}

export interface AdminGuardKo {
  ok: false
  response: NextResponse
}

export type AdminGuardResult = AdminGuardOk | AdminGuardKo

export async function requireSuperAdmin(req: Request, opts: { route: string; max?: number; windowSec?: number } = { route: 'admin' }): Promise<AdminGuardResult> {
  const { ok, userId } = await isSuperAdminCurrentUser()
  if (!ok || !userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès réservé au super administrateur.' }, { status: 403 }),
    }
  }
  const max = opts.max ?? 240
  const windowSec = opts.windowSec ?? 60
  const rl = rateLimit(`${opts.route}:${userId}`, max, windowSec)
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Trop de requêtes. Réessaie dans un instant.' }, { status: 429 }),
    }
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || ''
  const userAgent = req.headers.get('user-agent') || ''
  return { ok: true, userId, ip, userAgent }
}
