import { z } from 'zod'
import { MENTAL_JOURNAL_MAX_AUDIO_SEC } from './constants/core-events'
export { MENTAL_JOURNAL_MAX_AUDIO_SEC } from './constants/core-events'

export const JOURNAL_CONSENT_VERSION = '2026-11-10'
export const JOURNAL_MAX_TEXT_LENGTH = 8000
// Base64 plus the JSON envelope remains below the platform request-body limit.
export const JOURNAL_MAX_AUDIO_BYTES = 3 * 1024 * 1024
export const JOURNAL_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
] as const

export const JournalReflectionSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  questions: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
}).strict()

// The complete browser/API projection. Legacy inferred values are never included.
export const MentalJournalEntrySchema = z.object({
  id: z.string().uuid(),
  transcript: z.string().max(JOURNAL_MAX_TEXT_LENGTH).nullable(),
  transcript_lang: z.string().max(40).nullable(),
  audio_duration_sec: z.number().int().min(0).max(300).nullable(),
  entry_source: z.enum(['legacy', 'text', 'audio']),
  reflection: JournalReflectionSchema.nullable(),
  reflection_status: z.enum(['not_requested', 'available', 'unavailable']),
  created_at: z.string().refine(value => Number.isFinite(Date.parse(value))),
}).refine(entry => (entry.reflection_status === 'available') === (entry.reflection !== null))

export type MentalJournalEntry = z.infer<typeof MentalJournalEntrySchema>
export type JournalReflection = z.infer<typeof JournalReflectionSchema>

const commonInput = {
  client_entry_id: z.string().uuid(),
  lang_hint: z.enum(['fr', 'en']).default('fr'),
  reflection_consent: z.literal(JOURNAL_CONSENT_VERSION).nullable().default(null),
}
export const TextJournalSchema = z.object({
  ...commonInput,
  text: z.string().trim().min(1).max(JOURNAL_MAX_TEXT_LENGTH),
}).strict()
export const AudioJournalSchema = z.object({
  ...commonInput,
  audio_base64: z.string().min(684).max(4 * Math.ceil(JOURNAL_MAX_AUDIO_BYTES / 3))
    .regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(value => value.length % 4 === 0),
  audio_mime_type: z.enum(JOURNAL_AUDIO_MIME_TYPES),
  declared_duration_sec: z.number().int().min(1).max(MENTAL_JOURNAL_MAX_AUDIO_SEC),
  transcription_consent: z.literal(JOURNAL_CONSENT_VERSION),
}).strict()
export type TextJournalInput = z.infer<typeof TextJournalSchema>
export type AudioJournalInput = z.infer<typeof AudioJournalSchema>

export class JournalError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'JournalError'
  }
}
