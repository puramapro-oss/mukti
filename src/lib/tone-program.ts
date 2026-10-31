/** Audible tone instructions only. No account, conversation, actuator or volume commands. */
export const TONE_FREQUENCIES = [396, 417, 432, 528, 639, 741, 852] as const
export const TONE_DURATIONS = [60, 180, 300, 600] as const
export interface ToneProgram { version: 1; hz: number; seconds: number }
export const DEFAULT_TONE_PROGRAM: Readonly<ToneProgram> = Object.freeze({ version: 1, hz: 432, seconds: 60 })

export function validateToneProgram(input: unknown): ToneProgram {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Programme invalide.')
  const value = input as Record<string, unknown>
  if (Object.keys(value).length !== 3 || !['version', 'hz', 'seconds'].every(key => Object.hasOwn(value, key))) {
    throw new Error('Le programme doit contenir uniquement sa version, sa fréquence et sa durée.')
  }
  if (value.version !== 1 || !TONE_FREQUENCIES.some(hz => hz === value.hz) || !TONE_DURATIONS.some(seconds => seconds === value.seconds)) {
    throw new Error('Fréquence, durée ou version non prise en charge. Aucun son lancé.')
  }
  return { version: 1, hz: value.hz as number, seconds: value.seconds as number }
}

export function decodeToneHash(hash: string): ToneProgram {
  if (!hash || hash === '#') return { ...DEFAULT_TONE_PROGRAM }
  if (hash.length > 96 || !/^#v=1&hz=\d{3}&seconds=\d{2,3}$/.test(hash)) throw new Error('Lien de tonalité invalide.')
  const params = new URLSearchParams(hash.slice(1))
  const program = validateToneProgram({ version: 1, hz: Number(params.get('hz')), seconds: Number(params.get('seconds')) })
  if (encodeToneHash(program) !== hash) throw new Error('Lien non canonique.')
  return program
}

export function encodeToneHash(input: unknown): string {
  const p = validateToneProgram(input)
  return `#v=1&hz=${p.hz}&seconds=${p.seconds}`
}
