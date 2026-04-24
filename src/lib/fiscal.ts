// MUKTI — G7 Fiscal : 4 profils auto-détectés + PDF annuel via pdf-lib

import { createServiceClient } from './supabase'
import { FISCAL_PROFILES, type FiscalProfileId, PDF_FOOTER_LEGAL, COMPANY_INFO, APP_NAME } from './constants'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function computeYearEarningsCents(userId: string, year: number): Promise<number> {
  const admin = createServiceClient()
  const yStart = new Date(Date.UTC(year, 0, 1)).toISOString()
  const yEnd = new Date(Date.UTC(year + 1, 0, 1)).toISOString()
  const { data: commissions } = await admin
    .from('commissions')
    .select('amount_cents')
    .eq('user_id', userId)
    .in('status', ['credited', 'paid'])
    .gte('created_at', yStart)
    .lt('created_at', yEnd)
  const { data: prizes } = await admin
    .from('contest_entries')
    .select('prize_cents')
    .eq('user_id', userId)
    .not('paid_at', 'is', null)
    .gte('paid_at', yStart)
    .lt('paid_at', yEnd)
  const sumCommissions = (commissions ?? []).reduce((a, r) => a + ((r as { amount_cents: number }).amount_cents ?? 0), 0)
  const sumPrizes = (prizes ?? []).reduce((a, r) => a + ((r as { prize_cents: number }).prize_cents ?? 0), 0)
  return sumCommissions + sumPrizes
}

export function detectProfileType(totalCentsYear: number, hasSiret: boolean): FiscalProfileId {
  if (hasSiret) return 'societe_is'
  const particulier = FISCAL_PROFILES.find(p => p.id === 'particulier')!
  const microBic = FISCAL_PROFILES.find(p => p.id === 'micro_bic')!
  if (totalCentsYear <= particulier.max_cents_per_year) return 'particulier'
  if (totalCentsYear <= microBic.max_cents_per_year) return 'micro_bic'
  return 'societe_is'
}

export async function upsertFiscalProfile(userId: string): Promise<FiscalProfileId> {
  const admin = createServiceClient()
  const year = new Date().getUTCFullYear()
  const earnings = await computeYearEarningsCents(userId, year)
  const { data: existing } = await admin
    .from('fiscal_profiles')
    .select('profile_type, override_manual, siret')
    .eq('user_id', userId)
    .maybeSingle()
  const row = existing as { profile_type: FiscalProfileId; override_manual: boolean; siret: string | null } | null
  if (row?.override_manual) return row.profile_type
  const type = detectProfileType(earnings, !!row?.siret)
  await admin.from('fiscal_profiles').upsert({
    user_id: userId,
    profile_type: type,
    detected_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  return type
}

export async function generateAnnualPDF(params: {
  userId: string
  year: number
  fullName: string
  email: string
}): Promise<{ buffer: Uint8Array; totalCents: number; profileType: FiscalProfileId }> {
  const admin = createServiceClient()
  const total = await computeYearEarningsCents(params.userId, params.year)
  const profileType = await upsertFiscalProfile(params.userId)
  const { data: commissions } = await admin
    .from('commissions')
    .select('amount_cents, type, created_at')
    .eq('user_id', params.userId)
    .in('status', ['credited', 'paid'])
    .gte('created_at', `${params.year}-01-01T00:00:00Z`)
    .lt('created_at', `${params.year + 1}-01-01T00:00:00Z`)
    .order('created_at', { ascending: true })

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 800
  const accent = rgb(0.486, 0.227, 0.929) // #7C3AED
  page.drawRectangle({ x: 0, y: 810, width: 595, height: 32, color: accent })
  page.drawText(`${APP_NAME} — Récapitulatif annuel`, {
    x: 40, y: 820, size: 16, font: fontBold, color: rgb(1, 1, 1),
  })
  y -= 50
  page.drawText(`Année fiscale : ${params.year}`, { x: 40, y, size: 12, font: fontBold })
  y -= 18
  page.drawText(`Bénéficiaire : ${params.fullName}`, { x: 40, y, size: 11, font })
  y -= 16
  page.drawText(`Email : ${params.email}`, { x: 40, y, size: 11, font })
  y -= 16
  page.drawText(`Profil fiscal détecté : ${FISCAL_PROFILES.find(p => p.id === profileType)?.label_fr ?? profileType}`, {
    x: 40, y, size: 11, font,
  })
  y -= 30
  page.drawText('Détail des gains', { x: 40, y, size: 13, font: fontBold })
  y -= 18
  page.drawText(`Total net versé : ${(total / 100).toFixed(2)} €`, { x: 40, y, size: 12, font: fontBold, color: accent })
  y -= 28
  // Table header
  page.drawText('Date', { x: 40, y, size: 10, font: fontBold })
  page.drawText('Type', { x: 200, y, size: 10, font: fontBold })
  page.drawText('Montant', { x: 420, y, size: 10, font: fontBold })
  y -= 14
  for (const c of (commissions ?? []) as Array<{ amount_cents: number; type: string; created_at: string }>) {
    if (y < 80) break
    const date = new Date(c.created_at).toLocaleDateString('fr-FR')
    page.drawText(date, { x: 40, y, size: 9, font })
    page.drawText(c.type, { x: 200, y, size: 9, font })
    page.drawText(`${(c.amount_cents / 100).toFixed(2)} €`, { x: 420, y, size: 9, font })
    y -= 12
  }
  // Footer
  page.drawText(PDF_FOOTER_LEGAL, { x: 40, y: 30, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
  page.drawText(
    `${COMPANY_INFO.name} — DPO ${COMPANY_INFO.dpo} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
    { x: 40, y: 20, size: 7, font, color: rgb(0.4, 0.4, 0.4) },
  )
  const buffer = await pdf.save()
  return { buffer, totalCents: total, profileType }
}

export async function storeAnnualDeclaration(params: {
  userId: string
  year: number
  totalCents: number
  profileType: FiscalProfileId
  pdfUrl: string
}): Promise<void> {
  const admin = createServiceClient()
  await admin.from('fiscal_declarations').upsert({
    user_id: params.userId,
    year: params.year,
    total_earned_cents: params.totalCents,
    profile_type: params.profileType,
    pdf_url: params.pdfUrl,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,year' })
}
