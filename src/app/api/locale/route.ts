import { NextResponse } from 'next/server'
import { z } from 'zod'
import { locales } from '@/i18n/config'

const Schema = z.object({
  locale: z.enum(locales as unknown as [string, ...string[]]),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Requête invalide. Réessaye dans un instant.' },
      { status: 400 }
    )
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Langue non supportée. Choisis une langue dans la liste.' },
      { status: 400 }
    )
  }

  const response = NextResponse.json({ ok: true, locale: parsed.data.locale })
  response.cookies.set('locale', parsed.data.locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
