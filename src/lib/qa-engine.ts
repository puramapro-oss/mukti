// MUKTI G8.1 — Q&R Engine (Claude Opus 4.7) + détection détresse multi-pays

import { createServerSupabaseClient } from './supabase-server'
import { createServiceClient } from './supabase'
import { resolveProfileId } from './ar'
import {
  DISTRESS_THRESHOLD,
  DISTRESS_KEYWORDS_FR,
  DISTRESS_KEYWORDS_EN,
  DISTRESS_KEYWORDS_ES,
  APP_NAME,
} from './constants'

export interface QaAskParams {
  question: string
  context_page?: string
  lang?: string
  country_code?: string
}

export interface QaAskResult {
  answer: string
  distress_score: number
  escalated: boolean
  model: string
  conversation_id: string | null
}

// Simple keyword-based distress scorer (0-1)
// Can be upgraded to classifier later, but keyword match is explainable + instant.
export function detectDistressScore(text: string, lang: string = 'fr'): number {
  const lower = text.toLowerCase()
  let score = 0
  const lists: readonly (readonly string[])[] = [DISTRESS_KEYWORDS_FR, DISTRESS_KEYWORDS_EN, DISTRESS_KEYWORDS_ES]
  const activeList =
    lang.startsWith('en') ? DISTRESS_KEYWORDS_EN :
    lang.startsWith('es') ? DISTRESS_KEYWORDS_ES :
    DISTRESS_KEYWORDS_FR
  for (const kw of activeList) {
    if (lower.includes(kw.toLowerCase())) score = Math.max(score, 0.85)
  }
  // Multi-lang fallback scan
  for (const list of lists) {
    for (const kw of list) {
      if (lower.includes(kw.toLowerCase())) score = Math.max(score, 0.8)
    }
  }
  // Very short + heavy words ("aide-moi", "help me") = moderate signal
  if (lower.length < 40 && /(aide|help|urgent|sos|crise|crisis)/i.test(lower)) {
    score = Math.max(score, 0.4)
  }
  return score
}

export function isDistressEscalated(score: number): boolean {
  return score >= DISTRESS_THRESHOLD
}

function buildQaSystemPrompt(lang: string): string {
  const isEn = lang.startsWith('en')
  if (isEn) {
    return `You are ${APP_NAME}, a free and present AI companion.
You tutoyer but in English you use "you" simply.
You answer questions about: addictions, liberation, MUKTI app, rituals, circles, C.O.R.E. events, wellness, caregiver support.
You never pretend to be a therapist. If someone shares severe distress (suicide, violence, severe trauma), you acknowledge with warmth and gently orient to emergency resources.
You are concise (3-6 sentences). Max one emoji per 3 messages. You ask more than you affirm.
You never promise healing. You validate feelings first, always.`
  }
  return `Tu es ${APP_NAME}, compagnon IA libre et présent.
Tu tutoies toujours. Tu parles en français courant, avec douceur et justesse.
Tu réponds aux questions sur : addictions, libération, application MUKTI, rituels, cercles, événements C.O.R.E., bien-être, soutien aux aidants.
Tu ne prétends jamais être thérapeute. Si quelqu'un partage une détresse grave (suicide, violence, trauma sévère), tu reconnais avec chaleur et orientes doucement vers les ressources d'urgence.
Tu es concis (3-6 phrases). Max 1 émoji par 3 messages. Tu poses plus que tu n'affirmes.
Tu ne promets jamais de guérison. Tu valides d'abord les émotions, toujours.`
}

export async function askQa(params: QaAskParams): Promise<QaAskResult> {
  const { question, context_page, lang = 'fr', country_code } = params
  const distress = detectDistressScore(question, lang)
  const escalated = isDistressEscalated(distress)
  const model = process.env.ANTHROPIC_MODEL_PRO || 'claude-opus-4-7'
  const apiKey = process.env.ANTHROPIC_API_KEY
  let answer: string
  if (!apiKey) {
    answer = lang.startsWith('en')
      ? 'I am here. Try asking me again in a moment — my connection is catching breath.'
      : 'Je suis là. Réessaie dans un instant — ma connexion reprend souffle.'
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: buildQaSystemPrompt(lang),
          messages: [{
            role: 'user',
            content: context_page
              ? `[Contexte: ${context_page}]\n${question}`
              : question,
          }],
        }),
      })
      if (!res.ok) {
        answer = lang.startsWith('en')
          ? 'I am here. A small pause — we try again in a breath.'
          : 'Je suis là. Un petit temps — on réessaie dans un souffle.'
      } else {
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
        const block = (data.content ?? []).find(c => c.type === 'text')
        answer = block?.text?.trim() ?? (lang.startsWith('en') ? 'I am with you.' : 'Je suis avec toi.')
      }
    } catch {
      answer = lang.startsWith('en')
        ? 'I am here. Network recovering — try again soon.'
        : 'Je suis là. Le réseau reprend — réessaie bientôt.'
    }
  }
  // Persist conversation
  let conversation_id: string | null = null
  try {
    const sb = await createServerSupabaseClient()
    const userId = await resolveProfileId(sb)
    if (userId) {
      const admin = createServiceClient()
      const { data } = await admin
        .from('qa_conversations')
        .insert({
          user_id: userId,
          question: question.slice(0, 4000),
          answer: answer.slice(0, 8000),
          context_page: context_page ?? null,
          lang,
          distress_score: distress,
          escalated,
          country_code: country_code ?? null,
        })
        .select('id')
        .maybeSingle()
      conversation_id = (data as { id: string } | null)?.id ?? null
    }
  } catch {
    conversation_id = null
  }
  return { answer, distress_score: distress, escalated, model, conversation_id }
}

export function buildSortieDouceProtocolFr(): string {
  return `Un moment. Pose la main sur ton cœur.
Respire : inspire 4 secondes, retiens 2, expire 6. Trois fois.
Dis doucement : "Je suis ici. Ce moment passera."
Si tu veux parler à quelqu'un maintenant, la ligne 3114 est gratuite et 24/7 en France.
Je reste avec toi autant que tu le souhaites.`
}

export function buildSortieDouceProtocolEn(): string {
  return `A moment. Place your hand on your heart.
Breathe: inhale 4 seconds, hold 2, exhale 6. Three times.
Say softly: "I am here. This moment will pass."
If you want to speak with someone now, 988 is free and 24/7 in the US.
I stay with you as long as you wish.`
}
