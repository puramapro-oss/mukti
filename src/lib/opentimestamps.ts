// MUKTI — Horodatage blockchain Bitcoin via OpenTimestamps
// Lib `javascript-opentimestamps` (open source, gratuit, ancrage natif Bitcoin)
// Remplace OriginStamp (retired 31 mai 2025).
// Usage : audit trail split 10% Asso, règlements jeux-concours, contrats ambassadeurs.
//
// IMPORTANT : utiliser uniquement côté serveur (Buffer, calendars publics hardcodés).
// Voir LEARNINGS.md JURISPURAMA L56 — types via src/types/javascript-opentimestamps.d.ts.

import { createHash } from 'node:crypto'

/** Compute SHA-256 hash of a string or Buffer (returns hex). */
export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Stamp a SHA-256 hash via OpenTimestamps.
 * Returns the proof as base64 (ready to store DB).
 * Non-blocking : if OTS calendars are unreachable, returns null.
 */
export async function stampHash(sha256HashHex: string): Promise<string | null> {
  try {
    // Dynamic import — lib is CommonJS + heavy, lazy-load only if used
    type OtsModule = {
      Ops: { OpSHA256: new () => unknown }
      DetachedTimestampFile: {
        fromHash: (op: unknown, hash: Buffer) => { serializeToBytes: () => Buffer }
      }
      stamp: (file: { serializeToBytes: () => Buffer }) => Promise<void>
    }
    const mod = (await import('javascript-opentimestamps')) as unknown as { default?: OtsModule } & OtsModule
    const ots = (mod.default ?? mod) as OtsModule

    const hashBuffer = Buffer.from(sha256HashHex, 'hex')
    const detached = ots.DetachedTimestampFile.fromHash(new ots.Ops.OpSHA256(), hashBuffer)
    await ots.stamp(detached)
    const proofBytes = detached.serializeToBytes()
    return Buffer.from(proofBytes).toString('base64')
  } catch {
    return null
  }
}

/**
 * Verify a previously-stamped proof.
 * Returns the Bitcoin block timestamp (Unix) if confirmed, else null.
 */
export async function verifyProof(proofBase64: string): Promise<number | null> {
  try {
    type OtsModule = {
      DetachedTimestampFile: {
        deserialize: (bytes: Buffer) => { timestamp: { allAttestations: () => Map<unknown, unknown> } }
      }
      verify: (file: unknown) => Promise<{ bitcoin?: { timestamp: number } }>
    }
    const mod = (await import('javascript-opentimestamps')) as unknown as { default?: OtsModule } & OtsModule
    const ots = (mod.default ?? mod) as OtsModule

    const proofBytes = Buffer.from(proofBase64, 'base64')
    const detached = ots.DetachedTimestampFile.deserialize(proofBytes)
    const result = await ots.verify(detached)
    return result?.bitcoin?.timestamp ?? null
  } catch {
    return null
  }
}

/** Format proof verification for human display */
export function formatBlockchainTimestamp(unixSeconds: number | null): string {
  if (!unixSeconds) return 'En attente de confirmation Bitcoin…'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(unixSeconds * 1000)) + ' (Bitcoin)'
}
