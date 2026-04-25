'use client'

// MUKTI G8.6 — Editor wording bank : tabs 6 sections + form key/value + JSON brut

import { useMemo, useState, useTransition } from 'react'
import { Plus, Trash2, Save, AlertCircle, Check, Code, LayoutList } from 'lucide-react'
import type { WordingBankSection } from '@/lib/constants'

type Bank = Record<WordingBankSection, Record<string, string>>

interface Props {
  initialBank: Bank
  sections: ReadonlyArray<WordingBankSection>
}

const SECTION_LABELS: Record<WordingBankSection, string> = {
  greetings: 'Greetings',
  errors: 'Errors',
  success: 'Success',
  cta: 'CTA',
  faq: 'FAQ',
  meta: 'Meta',
}

export default function WordingEditor({ initialBank, sections }: Props) {
  const [bank, setBank] = useState<Bank>(initialBank)
  const [activeSection, setActiveSection] = useState<WordingBankSection>(sections[0])
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [jsonDraft, setJsonDraft] = useState<string>(() => JSON.stringify(initialBank, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number>(0)
  const [pending, startTransition] = useTransition()

  const entries = useMemo(() => Object.entries(bank[activeSection] ?? {}), [bank, activeSection])

  function updateEntry(section: WordingBankSection, key: string, newKey: string, value: string) {
    setBank((prev) => {
      const next = { ...prev }
      const sectionMap = { ...(next[section] ?? {}) }
      if (newKey !== key) delete sectionMap[key]
      if (newKey) sectionMap[newKey] = value
      next[section] = sectionMap
      return next
    })
  }

  function removeEntry(section: WordingBankSection, key: string) {
    setBank((prev) => {
      const next = { ...prev }
      const sectionMap = { ...(next[section] ?? {}) }
      delete sectionMap[key]
      next[section] = sectionMap
      return next
    })
  }

  function addEntry(section: WordingBankSection) {
    setBank((prev) => {
      const next = { ...prev }
      const sectionMap = { ...(next[section] ?? {}) }
      let i = 1
      while (sectionMap[`new_key_${i}`] !== undefined) i++
      sectionMap[`new_key_${i}`] = ''
      next[section] = sectionMap
      return next
    })
  }

  function applyJson() {
    setJsonError(null)
    try {
      const parsed = JSON.parse(jsonDraft)
      if (!parsed || typeof parsed !== 'object') throw new Error('Le JSON doit être un objet.')
      const out: Bank = { greetings: {}, errors: {}, success: {}, cta: {}, faq: {}, meta: {} }
      for (const s of sections) {
        const v = (parsed as Record<string, unknown>)[s]
        if (v && typeof v === 'object') {
          out[s] = Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .filter(([, val]) => typeof val === 'string')
              .map(([k, val]) => [k, val as string]),
          )
        }
      }
      setBank(out)
      setMode('form')
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'JSON invalide.')
    }
  }

  function saveAll() {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/settings/wording_bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: bank }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Impossible d\'enregistrer.')
        return
      }
      setSavedAt(Date.now())
      setJsonDraft(JSON.stringify(bank, null, 2))
    })
  }

  const showSaved = savedAt && Date.now() - savedAt < 3000

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Modes d'édition" className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            role="tab"
            aria-selected={mode === 'form'}
            type="button"
            onClick={() => setMode('form')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'form' ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
            Form structuré
          </button>
          <button
            role="tab"
            aria-selected={mode === 'json'}
            type="button"
            onClick={() => {
              setJsonDraft(JSON.stringify(bank, null, 2))
              setMode('json')
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mode === 'json' ? 'bg-cyan-500 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Code className="h-3.5 w-3.5" aria-hidden="true" />
            Mode JSON brut
          </button>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/40"
        >
          {showSaved ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Enregistré
            </>
          ) : pending ? (
            'Enregistrement…'
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              Appliquer
            </>
          )}
        </button>
      </div>

      {mode === 'form' ? (
        <div className="space-y-4">
          <div role="tablist" aria-label="Sections wording" className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={activeSection === s}
                type="button"
                onClick={() => setActiveSection(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeSection === s
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                {SECTION_LABELS[s]}{' '}
                <span className="ml-1 text-[10px] text-white/40">{Object.keys(bank[s] ?? {}).length}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            {entries.length === 0 ? (
              <p className="py-4 text-center text-sm text-white/45">
                Aucune entrée dans cette section. Clique sur <span className="font-medium text-white/75">Ajouter</span> pour commencer.
              </p>
            ) : null}
            {entries.map(([key, value]) => (
              <div key={key} className="grid grid-cols-1 gap-2 rounded-lg border border-white/10 bg-black/30 p-3 sm:grid-cols-[1fr_2fr_auto]">
                <input
                  type="text"
                  defaultValue={key}
                  onBlur={(e) => updateEntry(activeSection, key, e.target.value.trim(), value)}
                  className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-mono text-white/80 outline-none focus:border-cyan-400/60"
                  aria-label="Clé"
                  placeholder="ex. welcome_morning"
                />
                <textarea
                  rows={2}
                  defaultValue={value}
                  onBlur={(e) => updateEntry(activeSection, key, key, e.target.value)}
                  className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-sm text-white outline-none focus:border-cyan-400/60"
                  aria-label="Valeur traduite"
                  placeholder="Texte affiché aux utilisateurs"
                />
                <button
                  type="button"
                  onClick={() => removeEntry(activeSection, key)}
                  aria-label={`Supprimer ${key}`}
                  className="inline-flex items-center justify-center rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-rose-300 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addEntry(activeSection)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Ajouter une entrée
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-mono text-xs text-white/85 outline-none focus:border-cyan-400/60"
            aria-label="JSON brut wording bank"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={applyJson}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Appliquer le JSON au formulaire
            </button>
            {jsonError ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-rose-300">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {jsonError}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}
    </div>
  )
}
