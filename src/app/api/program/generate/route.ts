// POST /api/program/generate
// Génère un programme Opus 4.7 en streaming SSE. Rate-limit 3/jour/user (Opus cher).
// Persiste via storeProgram à la fin + marque anciennes versions is_current=false.
// Wording non-médical garanti dans le system prompt (lib/programs.ts).

import { z } from 'zod'
import {
  canRegenerateProgram,
  createOpusProgramStream,
  getOpusModelName,
  storeProgram,
  type ProgramStructure,
} from '@/lib/programs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120  // Opus 16K peut prendre ~60-90s

const BodySchema = z.object({
  addiction_id: z.string().uuid('ID addiction invalide.'),
})

function sseChunk(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new TextEncoder().encode(payload)
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return jsonError('Connexion requise.', 401)

  const ip = getClientIp(req)
  // Opus coûte cher → 3/jour/user max
  const rl = rateLimit(`program:generate:${user.id}`, 3, 86400)
  if (!rl.ok) {
    return jsonError(
      `Tu as atteint la limite journalière (3/jour). Réessaie dans ${Math.ceil(rl.retryAfterSec / 3600)}h.`,
      429,
    )
  }

  const json = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Données invalides.', 400)
  }

  // Owner-check via RLS — si pas le sien, maybeSingle retourne null
  const { data: addiction } = await sb
    .from('addictions')
    .select('id, user_id, type, severity, frequency_daily, started_ago_months, triggers, goal, status, custom_label, declared_at, liberated_at, created_at, updated_at')
    .eq('id', parsed.data.addiction_id)
    .maybeSingle()

  if (!addiction) return jsonError('Addiction introuvable ou non autorisée.', 404)
  if (addiction.status !== 'active') {
    return jsonError(
      'Cette addiction n\'est plus active — réactive-la pour générer un nouveau programme.',
      409,
    )
  }

  const canRegen = await canRegenerateProgram(addiction.id)
  if (!canRegen.allowed) {
    return jsonError(
      canRegen.reason ?? 'Régénération non autorisée pour le moment.',
      409,
    )
  }

  // Variable ip conservée pour logs futurs si besoin
  void ip

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseChunk(event, data))
        } catch {
          /* client closed */
        }
      }

      try {
        send('status', {
          phase: 'initializing',
          message: 'MUKTI prépare ton programme de libération…',
        })

        const opusStream = createOpusProgramStream(addiction)

        let accumulatedJson = ''
        let outputTokensSeen = 0

        send('status', { phase: 'streaming', message: 'Opus 4.7 compose ton chemin 90 jours…' })

        for await (const event of opusStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'input_json_delta'
          ) {
            accumulatedJson += event.delta.partial_json
            // chunk toutes les ~800 chars pour UX premium sans flood
            if (accumulatedJson.length % 800 < (event.delta.partial_json.length || 1)) {
              send('progress', { chars: accumulatedJson.length })
            }
          } else if (event.type === 'message_delta' && event.usage) {
            outputTokensSeen = event.usage.output_tokens
            send('usage', {
              input_tokens: 0,
              output_tokens: outputTokensSeen,
            })
          }
        }

        const finalMessage = await opusStream.finalMessage()
        const toolUse = finalMessage.content.find(
          b => b.type === 'tool_use' && b.name === 'produce_program',
        )
        if (!toolUse || toolUse.type !== 'tool_use') {
          send('error', {
            message: 'Opus n\'a pas retourné la structure attendue — réessaie.',
          })
          controller.close()
          return
        }

        const program = toolUse.input as ProgramStructure

        send('status', { phase: 'persisting', message: 'Je sauvegarde ton programme…' })

        const stored = await storeProgram({
          addictionId: addiction.id,
          userId: addiction.user_id,
          program,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          model: getOpusModelName(),
        })

        send('done', {
          program_id: stored.id,
          version: stored.version,
          model: stored.model_used,
          summary: {
            phases: program.phases.length,
            micro_meditations: program.micro_meditations.length,
            affirmations: program.affirmations.length,
            plants: program.plants_info.length,
            anti_pulsion_actions: program.anti_pulsion_actions.length,
            hypnose_scripts: program.hypnose_scripts.length,
          },
          intention: program.intention,
          tokens: {
            input: finalMessage.usage.input_tokens,
            output: finalMessage.usage.output_tokens,
          },
        })
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message.includes('rate_limit')
              ? 'Service IA saturé — réessaie dans 30 secondes.'
              : `Génération interrompue : ${err.message}`
            : 'Erreur inconnue pendant la génération.'
        try {
          controller.enqueue(sseChunk('error', { message: msg }))
        } catch {
          /* already closed */
        }
      } finally {
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      // Client a fermé la connexion — aucune action nécessaire (stream consommé)
    },
  })

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
