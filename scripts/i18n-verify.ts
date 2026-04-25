// MUKTI G8.7.2 — Vérification cohérence clés × locales
//
// Usage:
//   npx tsx scripts/i18n-verify.ts            # rapport seul
//   npx tsx scripts/i18n-verify.ts --fix      # ajoute les clés manquantes avec valeur FR + suffix _TODO
//   npx tsx scripts/i18n-verify.ts --strict   # exit 1 si une clé critique manque
//
// Exit code 0 si toutes les locales = 100 % de couverture des clés FR (source).

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

// Clés critiques : si manquantes → exit 1 en mode strict
const CRITICAL_KEY_PREFIXES = ['common.', 'auth.', 'errors.', 'sos.', 'distress.']

const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const STRICT = args.includes('--strict')

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

function loadLocale(locale: string): FlatEntry[] | null {
  const p = join(MESSAGES_DIR, `${locale}.json`)
  if (!existsSync(p)) return null
  return flatten(JSON.parse(readFileSync(p, 'utf-8')))
}

function dottedKey(e: FlatEntry): string {
  return e.path.join('.')
}

function isCritical(key: string): boolean {
  return CRITICAL_KEY_PREFIXES.some((p) => key.startsWith(p))
}

function main(): void {
  const sourceFlat = loadLocale(SOURCE)
  if (!sourceFlat) {
    console.error(`✗ Source manquante : messages/${SOURCE}.json`)
    process.exit(2)
  }
  const sourceKeys = new Set(sourceFlat.map(dottedKey))
  const total = sourceKeys.size
  console.log(`📖 Source : ${SOURCE}.json — ${total} clés\n`)

  const report: Array<{ locale: string; missing: string[]; extra: string[]; coverage: number; critical: number }> = []
  let strictFail = false

  for (const locale of LOCALES_EXTENDED) {
    if (locale === SOURCE) continue
    const flat = loadLocale(locale)
    if (!flat) {
      console.warn(`⚠ ${locale.padEnd(3)} : fichier absent (messages/${locale}.json)`)
      const missingAll = Array.from(sourceKeys)
      report.push({ locale, missing: missingAll, extra: [], coverage: 0, critical: 0 })
      if (STRICT) strictFail = true
      if (FIX) {
        // Créer le fichier from-scratch avec FR fallback + suffix ⟦TODO⟧
        const sourceMap = new Map(sourceFlat.map((e) => [dottedKey(e), e.value]))
        const merged: FlatEntry[] = []
        for (const k of sourceKeys) {
          const fr = sourceMap.get(k) ?? ''
          merged.push({ path: k.split('.'), value: `${fr} ⟦TODO ${locale}⟧` })
        }
        const out = unflatten(merged)
        writeFileSync(join(MESSAGES_DIR, `${locale}.json`), JSON.stringify(out, null, 2) + '\n', 'utf-8')
        console.log(`  · ${locale} : créé from-scratch ${missingAll.length} ⟦TODO⟧ entries`)
      }
      continue
    }
    const localeKeys = new Set(flat.map(dottedKey))
    const missing = Array.from(sourceKeys).filter((k) => !localeKeys.has(k))
    const extra = Array.from(localeKeys).filter((k) => !sourceKeys.has(k))
    const coverage = ((total - missing.length) / total) * 100
    const criticalMissing = missing.filter(isCritical)

    report.push({ locale, missing, extra, coverage, critical: criticalMissing.length })

    if (STRICT && criticalMissing.length > 0) strictFail = true

    if (FIX && (missing.length > 0 || extra.length > 0)) {
      const sourceMap = new Map(sourceFlat.map((e) => [dottedKey(e), e.value]))
      const localeMap = new Map(flat.map((e) => [dottedKey(e), e.value]))
      // ajoute clés manquantes avec FR fallback + suffix _TODO
      for (const k of missing) {
        const fr = sourceMap.get(k) ?? ''
        localeMap.set(k, `${fr} ⟦TODO ${locale}⟧`)
      }
      // supprime extras
      for (const k of extra) localeMap.delete(k)
      // reconstruit
      const merged: FlatEntry[] = []
      for (const k of sourceKeys) {
        merged.push({ path: k.split('.'), value: localeMap.get(k) ?? '' })
      }
      const out = unflatten(merged)
      writeFileSync(join(MESSAGES_DIR, `${locale}.json`), JSON.stringify(out, null, 2) + '\n', 'utf-8')
      console.log(`  · ${locale} : +${missing.length} ⟦TODO⟧, -${extra.length} extras → corrigé`)
    }
  }

  console.log('\n──────────────────────────────────────────────────────')
  console.log('Locale | Coverage | Missing | Extra | Critical missing')
  console.log('──────────────────────────────────────────────────────')
  for (const r of report) {
    const cov = r.coverage.toFixed(1).padStart(5) + '%'
    const ico = r.coverage === 100 ? '✓' : r.critical > 0 ? '✗' : '·'
    console.log(
      `${ico} ${r.locale.padEnd(4)}|  ${cov}  |  ${String(r.missing.length).padStart(4)}  |  ${String(r.extra.length).padStart(4)} |  ${String(r.critical).padStart(4)}`,
    )
  }
  console.log('──────────────────────────────────────────────────────\n')

  const allComplete = report.every((r) => r.coverage === 100)
  const totalMissing = report.reduce((s, r) => s + r.missing.length, 0)
  const totalCritical = report.reduce((s, r) => s + r.critical, 0)

  console.log(`Résumé : ${allComplete ? '🎉 100 % couverture' : `${totalMissing} clés manquantes au total`}`)
  if (totalCritical > 0) console.log(`⚠ ${totalCritical} clés critiques manquantes`)

  if (STRICT && strictFail) {
    console.error('\n✗ Mode strict : clés critiques manquantes détectées.')
    process.exit(1)
  }
  if (FIX) {
    console.log('\n✓ Mode --fix : clés manquantes ajoutées avec valeurs FR + suffix ⟦TODO⟧.')
  }
}

main()
