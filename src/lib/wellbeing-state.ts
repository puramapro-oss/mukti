import { z } from 'zod'
import { AURORA_PHASES, AURORA_VARIANTS, type AuroraVariant } from './constants/aurora'
import { normalizeTimeZone } from './wellbeing-date'

const availability = z.enum(['available', 'limited', 'rest'])
export const WellbeingInput = z.object({
  physical: availability, cognitive: availability, sensory: availability, social: availability,
  minutes: z.number().int().min(0).max(120),
  time_zone: z.string().max(80).optional().transform((value, ctx) => {
    try { return normalizeTimeZone(value) } catch {
      ctx.addIssue({ code: 'custom', message: 'Fuseau horaire invalide.' })
      return z.NEVER
    }
  }),
  consent: z.literal(true),
}).strict()
export type WellbeingValues = z.infer<typeof WellbeingInput>
export interface WellbeingContext extends Omit<WellbeingValues, 'consent'> {
  day: string
  updated_at: string
}

export const FeedbackInput = z.object({
  session_id: z.string().uuid(),
  stage: z.enum(['immediate', 'later']),
  feeling: z.enum(['better', 'same', 'worse', 'unsure']),
  discomfort: z.boolean(),
  consent: z.literal(true),
}).strict()
export type FeedbackValues = z.infer<typeof FeedbackInput>
export const FeedbackReceipt = z.object({
  already: z.boolean(), feeling: z.enum(['better', 'same', 'worse', 'unsure']), discomfort: z.boolean(),
}).strict()
export const FEEDBACK_DELAY_MS = 4 * 60 * 60 * 1000

export function shouldPauseSuggestion(feedback: Pick<FeedbackValues, 'feeling' | 'discomfort'>): boolean {
  return feedback.feeling === 'worse' || feedback.discomfort
}

/** Transparent product rules based only on the user's stated availability. */
export function availableAuroraVariants(context: WellbeingContext | null, paused: readonly string[]): AuroraVariant[] {
  if (!context || context.minutes === 0 || context.physical === 'rest' || context.cognitive === 'rest') return []
  return AURORA_VARIANTS.filter((v) => {
    const duration = AURORA_PHASES[v.id].reduce((sum, phase) => sum + phase.duration_sec, 0)
    return !paused.includes(v.id) && duration <= context.minutes * 60
  }).map((v) => v.id)
}
