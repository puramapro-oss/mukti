// MUKTI — G7 CRON concours hebdo clôture + distribue + stamp OTS
// Schedule : dim 23h59 UTC. Redistribue 6% du CA de la semaine sur top 10.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { ensureContest, computeWeeklyRanking, distributePrizes, stampRulesPdfOTS } from '@/lib/contests-karma'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { PDF_FOOTER_LEGAL, APP_NAME } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PRIZE_DISTRIBUTION = [0.33, 0.17, 0.12, 0.08, 0.07, 0.05, 0.045, 0.045, 0.045, 0.045]

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return true
  return !!req.headers.get('x-vercel-cron')
}

async function buildRulesPdf(contestId: string, poolCents: number, startAt: string, endAt: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold)
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: rgb(0.486, 0.227, 0.929) })
  page.drawText(`${APP_NAME} — Règlement concours hebdo`, { x: 40, y: 808, size: 14, font: fontB, color: rgb(1, 1, 1) })
  page.drawText(`ID ${contestId.slice(0, 8)}`, { x: 40, y: 796, size: 9, font, color: rgb(1, 1, 1) })
  let y = 760
  page.drawText(`Période : du ${new Date(startAt).toLocaleDateString('fr-FR')} au ${new Date(endAt).toLocaleDateString('fr-FR')}`, { x: 40, y, size: 11, font })
  y -= 18
  page.drawText(`Cagnotte : ${(poolCents / 100).toFixed(2).replace('.', ',')}€`, { x: 40, y, size: 11, font: fontB })
  y -= 24
  page.drawText('Critères score hebdo :', { x: 40, y, size: 11, font: fontB })
  y -= 14
  const rules = [
    '• Parrainage réussi : +5 points',
    '• Premier paiement abo : +10 points',
    '• Addiction déclarée libération : +20 points',
    '• Streak 7/30/100 jours : +2/+5/+15 points',
    '• Rituel 7s complété : +1 point',
    '• Événement C.O.R.E. rejoint : +2 points',
    '• Cercle rejoint : +1 point',
    '• Upgrade tier ambassadeur : +8 points',
  ]
  for (const r of rules) {
    page.drawText(r, { x: 50, y, size: 10, font })
    y -= 13
  }
  y -= 10
  page.drawText('Distribution :', { x: 40, y, size: 11, font: fontB })
  y -= 14
  const dist = ['1er : 33%', '2e : 17%', '3e : 12%', '4e : 8%', '5e : 7%', '6e : 5%', '7-10e : 4,5% chacun']
  for (const d of dist) {
    page.drawText('• ' + d, { x: 50, y, size: 10, font })
    y -= 13
  }
  y -= 20
  page.drawText('Horodatage blockchain Bitcoin via OpenTimestamps — proof vérifiable publiquement.', { x: 40, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
  page.drawText(PDF_FOOTER_LEGAL, { x: 40, y: 30, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
  return pdf.save()
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  const admin = createServiceClient()
  // Période semaine qui vient de se terminer
  const now = new Date()
  const dow = now.getUTCDay() // 0 = dim
  const end = new Date(now); end.setUTCHours(23, 59, 59, 999); end.setUTCDate(now.getUTCDate() - (dow === 0 ? 0 : dow))
  const start = new Date(end); start.setUTCDate(end.getUTCDate() - 7)
  const contest = await ensureContest('weekly', start, end)
  // Génère règlement + stamp OTS
  const pdfBuffer = Buffer.from(await buildRulesPdf(contest.id, contest.pool_cents, contest.start_at, contest.end_at))
  const { sha256, proofBase64 } = await stampRulesPdfOTS(pdfBuffer)
  // Upload PDF to Supabase Storage
  const rulesPath = `regulations/weekly-${contest.id}.pdf`
  await admin.storage.from('public').upload(rulesPath, pdfBuffer, { contentType: 'application/pdf', upsert: true }).catch(() => null)
  const { data: { publicUrl: rulesUrl } } = admin.storage.from('public').getPublicUrl(rulesPath)
  const proofPath = `regulations/weekly-${contest.id}.ots.txt`
  if (proofBase64) {
    await admin.storage.from('public').upload(proofPath, Buffer.from(proofBase64), { contentType: 'text/plain', upsert: true }).catch(() => null)
  }
  const { data: { publicUrl: proofUrl } } = admin.storage.from('public').getPublicUrl(proofPath)
  await admin.from('contests_karma').update({
    rules_pdf_url: rulesUrl,
    ots_proof_url: proofBase64 ? proofUrl : null,
    ots_sha256: sha256,
    status: 'closed',
    closed_at: new Date().toISOString(),
  }).eq('id', contest.id)
  // Compute ranking + distribute
  const ranking = await computeWeeklyRanking(contest.id, 10)
  if (ranking.length === 0 || contest.pool_cents <= 0) {
    return NextResponse.json({ ok: true, contest_id: contest.id, winners: 0, pool_cents: contest.pool_cents })
  }
  const winners = ranking.map((r, i) => ({
    user_id: r.user_id,
    rank: i + 1,
    prize_cents: Math.floor(contest.pool_cents * (PRIZE_DISTRIBUTION[i] ?? 0)),
  }))
  await distributePrizes({ contestId: contest.id, winners })
  return NextResponse.json({
    ok: true,
    contest_id: contest.id,
    winners: winners.length,
    pool_cents: contest.pool_cents,
    rules_pdf_url: rulesUrl,
    ots_proof_url: proofBase64 ? proofUrl : null,
  })
}

export async function GET(req: Request) { return POST(req) }
