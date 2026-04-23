import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { APP_NAME, APP_SLUG } from '@/lib/constants'

export const runtime = 'nodejs'
export const maxDuration = 15

const BodySchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court (min 2 caractères).').max(80),
  email: z.string().trim().email('Email invalide.').max(180),
  subject: z.string().trim().min(3, 'Sujet trop court.').max(120),
  message: z.string().trim().min(10, 'Message trop court (min 10 caractères).').max(4000),
  // Honeypot anti-spam
  website: z.string().max(0).optional(),
})

const TARGET_EMAIL = 'contact@purama.dev'
const FROM_EMAIL = 'MUKTI <noreply@purama.dev>'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  }

  // Honeypot caught a bot
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true }) // Silently accept (bot doesn't know it failed)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Service email indisponible. Écris directement à contact@purama.dev.' },
      { status: 503 },
    )
  }

  const { name, email, subject, message } = parsed.data
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeSubject = escapeHtml(subject)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>')

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#0A0A0F;color:#E5E7EB;padding:24px;border-radius:16px;">
      <h2 style="color:#10B981;margin:0 0 16px;">📩 Nouveau message ${APP_NAME}</h2>
      <p style="margin:8px 0;"><strong>De :</strong> ${safeName} &lt;${safeEmail}&gt;</p>
      <p style="margin:8px 0;"><strong>Sujet :</strong> ${safeSubject}</p>
      <hr style="border:none;border-top:1px solid #1f2937;margin:16px 0;">
      <p style="white-space:pre-wrap;line-height:1.6;">${safeMessage}</p>
      <hr style="border:none;border-top:1px solid #1f2937;margin:16px 0;">
      <p style="font-size:12px;color:#6B7280;">App : ${APP_SLUG} · Reçu le ${new Date().toLocaleString('fr-FR')}</p>
    </div>`

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TARGET_EMAIL,
      replyTo: email,
      subject: `[${APP_NAME}] ${subject}`,
      html,
      text: `De: ${name} <${email}>\nSujet: ${subject}\n\n${message}`,
    })
    if (error) {
      return NextResponse.json(
        { error: `Envoi impossible. Réessaie ou écris à ${TARGET_EMAIL}.` },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: `Envoi impossible. Réessaie ou écris à ${TARGET_EMAIL}.` },
      { status: 502 },
    )
  }
}
