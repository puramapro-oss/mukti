// MUKTI G8.1 — i18n Batch Translator (Claude Haiku 4.5)
// Usage : node scripts/translate-batch.ts → lit messages/fr.json → génère 30+ locales

import type { LocaleExtended } from './constants'

export interface TranslateBatchParams {
  keys: Record<string, string>
  sourceLang: 'fr'
  targetLang: LocaleExtended
}

export interface TranslateBatchResult {
  translated: Record<string, string>
  lang: LocaleExtended
  keysCount: number
}

const LANG_NAMES: Record<string, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', cs: 'Czech', el: 'Greek', hu: 'Hungarian',
  ro: 'Romanian', tr: 'Turkish', ar: 'Arabic', he: 'Hebrew', hi: 'Hindi',
  zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean', th: 'Thai',
  vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', tl: 'Tagalog',
  ru: 'Russian', uk: 'Ukrainian', bn: 'Bengali', ur: 'Urdu',
}

export async function translateBatch(params: TranslateBatchParams): Promise<TranslateBatchResult> {
  const { keys, targetLang } = params
  if (targetLang === 'fr') {
    return { translated: keys, lang: 'fr', keysCount: Object.keys(keys).length }
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-4-5-20251001'
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant')
  const langName = LANG_NAMES[targetLang] ?? targetLang
  const jsonIn = JSON.stringify(keys, null, 2)
  const prompt = `Translate the following French app UI strings to ${langName}.
Rules:
- Keep the exact JSON structure and keys.
- Translate only the values.
- Preserve placeholders like {name}, {count}, %s, %d, <strong> tags.
- Keep the same tone: warm, tutoyer-equivalent (informal, close), concise.
- Output ONLY the resulting JSON, no markdown, no commentary.

Input:
${jsonIn}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Translate batch failed ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (data.content ?? []).find(c => c.type === 'text')?.text?.trim() ?? ''
  // Extract JSON (strip potential markdown fences)
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Record<string, string>
  return { translated: parsed, lang: targetLang, keysCount: Object.keys(parsed).length }
}

// Flatten nested messages object → { "a.b.c": "value" } for easier batching
export function flattenMessages(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  if (obj === null || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenMessages(v, key))
    } else if (typeof v === 'string') {
      out[key] = v
    }
  }
  return out
}

// Un-flatten { "a.b.c": "v" } → { a: { b: { c: "v" } } }
export function unflattenMessages(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let cur = out
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
      cur = cur[p] as Record<string, unknown>
    }
    cur[parts[parts.length - 1]!] = value
  }
  return out
}
