// MUKTI G8.7.1 — Traduction batch FR → 32 locales via Claude Haiku 4.5
//
// Usage:
//   ANTHROPIC_API_KEY=... npx tsx scripts/translate-batch.ts            # 16 locales manquantes
//   ANTHROPIC_API_KEY=... npx tsx scripts/translate-batch.ts --force    # toutes y compris existantes
//   ANTHROPIC_API_KEY=... npx tsx scripts/translate-batch.ts --only=he  # une locale précise
//
// Lit messages/fr.json (source de vérité) et génère messages/<locale>.json pour chaque locale cible.
// Préserve la structure imbriquée, les clés ICU (placeholders {n}, {date}), les liens, le ton spirituel non-prosélyte.

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(__dirname, '..', 'messages')
const SOURCE = 'fr'

const LOCALES_EXTENDED = [
  'fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'no', 'da', 'fi',
  'cs', 'el', 'hu', 'ro', 'tr', 'ar', 'he', 'hi', 'zh', 'ja', 'ko', 'th',
  'vi', 'id', 'ms', 'tl', 'ru', 'uk', 'bn', 'ur',
] as const
type Locale = (typeof LOCALES_EXTENDED)[number]

const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese',
  nl: 'Dutch', pl: 'Polish', sv: 'Swedish', no: 'Norwegian Bokmål', da: 'Danish', fi: 'Finnish',
  cs: 'Czech', el: 'Greek', hu: 'Hungarian', ro: 'Romanian', tr: 'Turkish', ar: 'Arabic (RTL)',
  he: 'Hebrew (RTL)', hi: 'Hindi (Devanagari)', zh: 'Simplified Chinese', ja: 'Japanese', ko: 'Korean',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', tl: 'Tagalog/Filipino',
  ru: 'Russian (Cyrillic)', uk: 'Ukrainian (Cyrillic)', bn: 'Bengali', ur: 'Urdu (RTL)',
}

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const ONLY_ARG = args.find((a) => a.startsWith('--only='))
const ONLY: Locale | null = ONLY_ARG ? (ONLY_ARG.split('=')[1] as Locale) : null

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('✗ ANTHROPIC_API_KEY manquant. Export-le ou passe-le inline.')
  process.exit(1)
}
const client = new Anthropic({ apiKey })

const MODEL = process.env.ANTHROPIC_MODEL_FAST ?? 'claude-haiku-4-5-20251001'

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

function saveJson(path: string, data: Record<string, unknown>): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

interface FlatEntry {
  path: string[]
  value: string
}

function flatten(obj: unknown, path: string[] = []): FlatEntry[] {
  const out: FlatEntry[] = []
  if (typeof obj === 'string') {
    out.push({ path, value: obj })
    return out
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out.push(...flatten(v, [...path, k]))
    }
  }
  return out
}

function unflatten(entries: FlatEntry[]): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const { path, value } of entries) {
    let cursor: Record<string, unknown> = root
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
      cursor = cursor[key] as Record<string, unknown>
    }
    cursor[path[path.length - 1]] = value
  }
  return root
}

function buildSystemPrompt(targetLocale: Locale): string {
  const name = LOCALE_NAMES[targetLocale]
  return `You are a professional translator for MUKTI, a wellness app for addiction recovery and collective consciousness rituals.
Translate French (FR) source strings into ${name} (${targetLocale.toUpperCase()}).

CRITICAL RULES:
1. Preserve EXACTLY all ICU placeholders: {name}, {count}, {date}, {amount}, etc. Never translate placeholder names.
2. Preserve markdown links and HTML tags: [text](url), <strong>, <br/>.
3. Keep tone: warm, non-judgemental, spiritual but NEVER prosélyte. Avoid medical claims (no "cure", "heal").
4. Use informal "tu" form for direct user address (or culture-appropriate equivalent).
5. Keep technical UI words concise (1-3 words for buttons).
6. For RTL languages (ar, he, ur): translate as natural RTL prose, no Latin transliteration.
7. For Asian languages (zh, ja, ko, th): use natural sentence ending styles, omit articles.
8. Never invent content. Translate only what is given.
9. Output JSON ONLY: a flat object { "key": "translation", ... } matching exactly the input keys. No markdown, no explanation.`
}

interface TranslateBatch {
  keys: string[]
  values: string[]
}

async function translateChunk(targetLocale: Locale, batch: TranslateBatch): Promise<Record<string, string>> {
  const userMsg = `Translate these French UI strings to ${LOCALE_NAMES[targetLocale]}.
Output JSON object with exactly these keys: ${JSON.stringify(batch.keys)}

Source:
${JSON.stringify(Object.fromEntries(batch.keys.map((k, i) => [k, batch.values[i]])), null, 2)}`

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: buildSystemPrompt(targetLocale),
        messages: [{ role: 'user', content: userMsg }],
      })
      const block = response.content[0]
      if (!block || block.type !== 'text') throw new Error('Réponse vide ou non-textuelle.')
      const text = block.text.trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('JSON non trouvé dans la réponse.')
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
      // Sanity check : toutes les clés présentes
      for (const k of batch.keys) {
        if (typeof parsed[k] !== 'string') {
          throw new Error(`Clé manquante dans la réponse: ${k}`)
        }
      }
      return parsed
    } catch (e) {
      lastErr = e
      console.warn(`  ↻ retry ${attempt}/3 (${e instanceof Error ? e.message : 'erreur'})`)
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('translateChunk failed after 3 retries')
}

const CHUNK_SIZE = 40

function chunkEntries(entries: FlatEntry[], size: number): FlatEntry[][] {
  const out: FlatEntry[][] = []
  for (let i = 0; i < entries.length; i += size) {
    out.push(entries.slice(i, i + size))
  }
  return out
}

async function translateLocale(locale: Locale, source: FlatEntry[]): Promise<void> {
  const targetPath = join(MESSAGES_DIR, `${locale}.json`)
  if (existsSync(targetPath) && !FORCE) {
    const existing = loadJson(targetPath)
    const flatExisting = flatten(existing)
    if (flatExisting.length >= source.length * 0.95) {
      console.log(`✓ ${locale} : ${flatExisting.length} clés existantes, skip (--force pour réécrire)`)
      return
    }
  }

  console.log(`→ ${locale} (${LOCALE_NAMES[locale]}) : ${source.length} clés à traduire en ${Math.ceil(source.length / CHUNK_SIZE)} batches…`)

  const flatKeys = source.map((e) => e.path.join('.'))
  const flatValues = source.map((e) => e.value)
  const result: Record<string, string> = {}
  const chunks = chunkEntries(source, CHUNK_SIZE)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const keys = chunk.map((e) => e.path.join('.'))
    const values = chunk.map((e) => e.value)
    process.stdout.write(`  · batch ${i + 1}/${chunks.length} (${keys.length} clés)…`)
    const translated = await translateChunk(locale, { keys, values })
    for (const k of keys) result[k] = translated[k]
    process.stdout.write(' ok\n')
  }

  // Reconstruct nested structure
  const out = unflatten(flatKeys.map((k, i) => ({ path: k.split('.'), value: result[k] ?? flatValues[i] })))
  saveJson(targetPath, out)
  console.log(`✓ ${locale} écrit : ${targetPath}\n`)
}

async function main() {
  const sourcePath = join(MESSAGES_DIR, `${SOURCE}.json`)
  const sourceJson = loadJson(sourcePath)
  const sourceFlat = flatten(sourceJson)
  console.log(`📖 Source : messages/${SOURCE}.json — ${sourceFlat.length} clés totales`)
  console.log(`🤖 Modèle : ${MODEL}\n`)

  const targets = ONLY
    ? [ONLY]
    : LOCALES_EXTENDED.filter((l) => l !== SOURCE)

  for (const locale of targets) {
    try {
      await translateLocale(locale, sourceFlat)
    } catch (e) {
      console.error(`✗ ${locale} : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
    }
  }

  console.log('🎉 Terminé.')
}

main().catch((e) => {
  console.error('Erreur fatale :', e)
  process.exit(1)
})
