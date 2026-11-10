import { type Page } from '@playwright/test'
import { test, expect } from './browser-test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  NOW, TODAY, ZONE, LEGACY_JOURNAL_ID, OWN_SESSION_ID, legacyJournal, habitStatuses, recognitionOverview,
} from './fixtures'

test.beforeAll(async ({ browser }) => {
  const directory = fileURLToPath(new URL('./test-results', import.meta.url))
  mkdirSync(directory, { recursive: true })
  writeFileSync(`${directory}/browser-version.json`, JSON.stringify({ browserVersion: browser.version() }, null, 2))
})
const asObject = (value: unknown) => value as Record<string, unknown>
function savedEntry(id: unknown, transcript: unknown, extra: Record<string, unknown> = {}) {
  return {
    id, transcript, transcript_lang: 'fr', audio_duration_sec: null, entry_source: 'text',
    reflection: null, reflection_status: 'not_requested', created_at: NOW, ...extra,
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW))
})

async function openView(page: Page, view: string) {
  await page.goto(`/?view=${view}`)
  await expect(page.getByTestId('browser-harness')).toBeVisible()
}

test('journal: saved text has no default AI processing and deletion targets the selected entry', async ({ page }) => {
  const writes: Record<string, unknown>[] = []
  const deletions: Record<string, unknown>[] = []
  let current: Record<string, unknown> | null = null
  await page.route('**/api/mental-journal/entries**', async route => {
    if (route.request().method() === 'POST') {
      const body = asObject(route.request().postDataJSON())
      writes.push(body)
      current = savedEntry(body.client_entry_id, body.text)
      await route.fulfill({ status: 201, json: { entry: current, warning: null } })
    } else if (route.request().method() === 'DELETE') {
      const body = asObject(route.request().postDataJSON())
      deletions.push(body)
      expect(body.id).toBe(current?.id)
      current = null
      await route.fulfill({ json: { ok: true, id: body.id } })
    } else {
      await route.fulfill({ json: { entries: [...(current ? [current] : []), legacyJournal] } })
    }
  })
  await openView(page, 'journal')
  await expect(page.getByText(legacyJournal.transcript!, { exact: true })).toBeVisible()
  await page.getByRole('textbox').fill('Nouvel écrit synthétique du compte A.')
  await page.getByRole('button', { name: 'Enregistrer mon texte', exact: true }).click()
  await expect(page.getByText('Ton journal est enregistré.', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0].reflection_consent).toBeNull()
  expect(writes[0]).not.toHaveProperty('relapse_risk')
  await expect(page.getByText(/Risque \d+%/)).toHaveCount(0)
  const latest = page.getByRole('article').filter({ hasText: 'Nouvel écrit synthétique du compte A.' })
  await latest.getByRole('button', { name: 'Supprimer cette entrée' }).click()
  expect(deletions).toHaveLength(0)
  await latest.getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByText('Entrée supprimée de ton journal.', { exact: true })).toBeVisible()
  expect(deletions).toHaveLength(1)
  expect(deletions[0].id).not.toBe(LEGACY_JOURNAL_ID)
  await expect(page.getByText(legacyJournal.transcript!, { exact: true })).toBeVisible()
  await expect(page.getByText('Nouvel écrit synthétique du compte A.', { exact: true })).toHaveCount(0)
})

test('journal: an error preserves the draft, retry id and explicit reflection choice', async ({ page }) => {
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/mental-journal/entries', async route => {
    const body = asObject(route.request().postDataJSON())
    writes.push(body)
    if (writes.length === 1) {
      await route.fulfill({ status: 503, json: { error: 'Erreur de stockage synthétique.' } })
    } else {
      await route.fulfill({ status: 201, json: {
        entry: savedEntry(body.client_entry_id, body.text, {
          reflection_status: 'available', reflection: { summary: `Dans tes mots : « ${body.text} »`, questions: ['Que souhaites-tu retenir de ce moment ?'] },
        }), warning: null,
      } })
    }
  })
  await openView(page, 'journal')
  await page.getByRole('textbox').fill('Brouillon synthétique à conserver.')
  const consent = page.getByRole('checkbox', { name: /Je souhaite une réflexion facultative/ })
  await expect(consent).not.toBeChecked()
  await consent.check()
  await page.getByRole('button', { name: 'Enregistrer mon texte', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Erreur de stockage synthétique.')
  await expect(page.getByRole('textbox')).toHaveValue('Brouillon synthétique à conserver.')
  await expect(consent).toBeChecked()
  await page.getByRole('button', { name: 'Enregistrer mon texte', exact: true }).click()
  await expect(page.getByText('Ton journal est enregistré.', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(2)
  expect(writes[0].client_entry_id).toBe(writes[1].client_entry_id)
  expect(writes[1].reflection_consent).toBe('2026-11-10')
  await expect(consent).not.toBeChecked()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await expect(page.getByText('Que souhaites-tu retenir de ce moment ?', { exact: true })).toBeVisible()
})

test('audio: real Chromium MediaRecorder releases synthetic tracks and waits for transcription consent', async ({ page }) => {
  const uploads: Record<string, unknown>[] = []
  await page.addInitScript(() => {
    const tracked = window as typeof window & { __journalTracks?: MediaStreamTrack[] }
    const media = navigator.mediaDevices
    const original = media.getUserMedia.bind(media)
    media.getUserMedia = async constraints => {
      const stream = await original(constraints)
      tracked.__journalTracks = stream.getTracks()
      return stream
    }
  })
  await page.route('**/api/mental-journal/analyze', async route => {
    const body = asObject(route.request().postDataJSON())
    uploads.push(body)
    expect(String(body.audio_mime_type)).toMatch(/^audio\/webm/)
    expect(Buffer.from(String(body.audio_base64), 'base64').subarray(0, 4).toString('hex')).toBe('1a45dfa3')
    expect(Number(body.declared_duration_sec)).toBeGreaterThanOrEqual(1)
    expect(Number(body.declared_duration_sec)).toBeLessThanOrEqual(180)
    expect(body.transcription_consent).toBe('2026-11-10')
    expect(body.reflection_consent).toBeNull()
    await route.fulfill({ status: 201, json: { entry: savedEntry(body.client_entry_id, 'Transcription audio synthétique.', {
      entry_source: 'audio', audio_duration_sec: body.declared_duration_sec,
    }), warning: null } })
  })
  await openView(page, 'journal')
  await page.getByRole('button', { name: 'Enregistrer un audio', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Arrêter l’enregistrement', exact: true })).toBeVisible()
  // A real encoder needs actual samples from Chromium's synthetic audio device.
  await page.waitForTimeout(1250)
  await page.getByRole('button', { name: 'Arrêter l’enregistrement', exact: true }).click()
  const upload = page.getByRole('button', { name: 'Transcrire et enregistrer', exact: true })
  await expect(upload).toBeVisible()
  await expect(upload).toBeDisabled()
  expect(uploads).toHaveLength(0)
  await expect.poll(() => page.evaluate(() => {
    const tracks = (window as typeof window & { __journalTracks?: MediaStreamTrack[] }).__journalTracks
    return !!tracks?.length && tracks.every(track => track.readyState === 'ended')
  })).toBe(true)
  await page.getByRole('checkbox', { name: /J’accepte d’envoyer cet audio/ }).check()
  await upload.click()
  await expect(page.getByText('Transcription audio synthétique.', { exact: true })).toBeVisible()
  expect(uploads).toHaveLength(1)
})

test('minimal ritual: rest preserves progress without declaring a completed exercise', async ({ page }) => {
  const writes: Record<string, unknown>[] = []
  let habits = habitStatuses()
  await page.route('**/api/minimal-ritual/today', route => route.fulfill({ json: { day: TODAY, time_zone: ZONE, habits } }))
  await page.route('**/api/minimal-ritual/tick', async route => {
    const body = asObject(route.request().postDataJSON())
    writes.push(body)
    expect(body).toEqual({ habit_slug: 'respiration_consciente', participation_mode: 'rest' })
    habits = habits.map(habit => habit.slug === body.habit_slug ? {
      ...habit, recorded_today: true, ticked_today: false, participation_mode: 'rest', progress_days: 3, rest_days: 1,
    } : habit)
    await new Promise(resolve => setTimeout(resolve, 250))
    await route.fulfill({ json: { recorded: true, already: false, ticked: false, participation_mode: 'rest', day: TODAY, time_zone: ZONE, habits } })
  })
  await openView(page, 'minimal')
  const card = page.getByTestId('minimal-card-respiration_consciente')
  await card.getByRole('radio', { name: /^Repos/ }).check()
  await card.getByRole('button', { name: 'Enregistrer ce choix de repos', exact: true }).dblclick()
  await expect(page.getByTestId('minimal-habits-list').getByRole('status')).toHaveText('Repos enregistré. Aucun exercice n’est déclaré réalisé.')
  expect(writes).toHaveLength(1)
  await expect(card.getByText('Repos enregistré', { exact: true })).toBeVisible()
  await expect(page.getByText(/Aujourd’hui : 0 geste déclaré · 1 choix de repos/)).toBeVisible()
  await expect(page.getByTestId('minimal-progress-respiration_consciente')).toContainText('3 jours reconnus au total')
  await expect(card.getByRole('radio', { name: /^Repos/ })).toBeDisabled()
})

test('recognition: a retry produces one non-financial daily entry and retains historical receipts', async ({ page }) => {
  let attempts = 0
  const overview = recognitionOverview()
  const recognition = { id: 'current-recognition', recognition_date: TODAY, recognized_at: NOW }
  await page.route('**/api/mystery-rewards/history', route => route.fulfill({ json: { ok: true, ...overview } }))
  await page.route('**/api/mystery-rewards/claim-daily', async route => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({ status: 503, json: { error: 'Erreur de reconnaissance synthétique.' } })
      return
    }
    overview.recognition = recognition
    overview.recognitions = [recognition, ...overview.recognitions.filter(value => value.id !== recognition.id)]
    await route.fulfill({ json: { ok: true, format: overview.format, time_zone: 'UTC', financial_value: false, already_recorded: false, recognition } })
  })
  await openView(page, 'recognition')
  await expect(page.getByText(/sans valeur financière/)).toBeVisible()
  await page.getByRole('button', { name: 'Reconnaître ma journée', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Erreur de reconnaissance synthétique.')
  await page.getByRole('button', { name: 'Reconnaître ma journée', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Journée enregistrée', exact: true })).toBeDisabled()
  expect(attempts).toBe(2)
  await expect(page.getByTestId('daily-recognition-history').getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: 'Actualiser', exact: true }).click()
  await expect(page.getByTestId('daily-recognition-history').getByRole('listitem')).toHaveCount(2)
  await page.getByText('Historique des anciens reçus', { exact: true }).click()
  await expect(page.getByText('Valeur enregistrée : 100', { exact: true })).toBeVisible()
  await expect(page.getByText('Délivrance non vérifiée', { exact: true })).toBeVisible()
})

test('wellbeing: explicit choices persist and feedback on the supplied session pauses its suggestion', async ({ page }) => {
  let context = { physical: 'available', cognitive: 'available', sensory: 'available', social: 'available', minutes: 20, day: TODAY, time_zone: ZONE, updated_at: NOW }
  const feedback: Array<Record<string, unknown>> = []
  let paused: string[] = []
  const choices: Record<string, unknown>[] = []
  const returns: Record<string, unknown>[] = []
  const feed = () => ({ ok: true, sessions: [{ id: OWN_SESSION_ID, variant: 'calm', completed_at: '2026-11-10T11:30:00.000Z', later_available_at: '2026-11-10T15:30:00.000Z', feedback }], paused_variants: paused })
  await page.route('**/api/wellbeing/context', async route => {
    if (route.request().method() === 'PUT') {
      const body = asObject(route.request().postDataJSON())
      choices.push(body)
      expect(body.consent).toBe(true)
      context = { ...context, physical: String(body.physical), cognitive: String(body.cognitive), sensory: String(body.sensory), social: String(body.social), minutes: Number(body.minutes) }
    }
    await route.fulfill({ json: { ok: true, context, day: TODAY, time_zone: ZONE } })
  })
  await page.route('**/api/wellbeing/feedback', async route => {
    if (route.request().method() === 'POST') {
      const body = asObject(route.request().postDataJSON())
      returns.push(body)
      expect(body).toEqual({ session_id: OWN_SESSION_ID, stage: 'immediate', feeling: 'worse', discomfort: true, consent: true })
      feedback.push({ stage: body.stage, feeling: body.feeling, discomfort: body.discomfort, created_at: NOW })
      paused = ['calm']
      await route.fulfill({ json: { ok: true, already: false, feeling: body.feeling, discomfort: body.discomfort } })
    } else await route.fulfill({ json: feed() })
  })
  await openView(page, 'wellbeing')
  const checkin = page.getByRole('region', { name: 'Ma disponibilité du jour', exact: true })
  const checkinSave = checkin.getByRole('button', { name: 'Enregistrer mes choix', exact: true })
  await expect(checkin.getByRole('spinbutton')).toHaveValue('20')
  await expect(checkinSave).toBeDisabled()
  await expect(page.locator('a[href="/dashboard/aurora/calm"]')).toBeVisible()
  await checkin.getByRole('spinbutton').fill('9')
  await checkin.getByRole('combobox', { name: 'Attention', exact: true }).selectOption('limited')
  expect(choices).toHaveLength(0)
  await checkin.getByRole('checkbox', { name: /J’accepte d’enregistrer ces réponses/ }).check()
  await checkinSave.click()
  await expect(checkin.getByRole('status')).toContainText('Tes choix du jour sont enregistrés')
  expect(choices).toHaveLength(1)
  expect(choices[0].minutes).toBe(9)
  await expect(checkin.getByRole('checkbox')).not.toBeChecked()
  const review = page.getByRole('region', { name: 'Retour facultatif sur mes séances', exact: true })
  const saveFeedback = review.getByRole('button', { name: 'Enregistrer mon retour', exact: true })
  await expect(saveFeedback).toBeDisabled()
  await review.getByRole('radio', { name: 'Moins bien', exact: true }).check()
  await review.getByRole('checkbox', { name: 'J’ai ressenti un inconfort', exact: true }).check()
  expect(returns).toHaveLength(0)
  await review.getByRole('checkbox', { name: /J’accepte d’enregistrer ce retour/ }).check()
  await saveFeedback.click()
  await expect(review.getByRole('status')).toHaveText('Retour enregistré.')
  expect(returns).toHaveLength(1)
  await expect(review.getByText('Variantes retirées des suggestions :', { exact: true })).toBeVisible()
  await expect(page.locator('a[href="/dashboard/aurora/calm"]')).toHaveCount(0)
  await expect(review.getByRole('button', { name: 'Je choisis de réactiver les suggestions', exact: true })).toBeVisible()
})
