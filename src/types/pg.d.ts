// Ambient shim — PRÉ-EXISTANT, hors périmètre NIYAMA (audit CONFORMITE.md 2026-08-23).
// `@purama/smarana` (dépendance workspace github:puramapro-oss/purama-smarana) importe
// `pg` sans fournir ni consommer `@types/pg`, ce qui casse `tsc --noEmit` et `next build`
// sur la branche `main` AVANT toute modification de cette session (vérifié via
// `git stash` : erreur identique sur le commit de base). Ajouté uniquement pour pouvoir
// vérifier tsc/build verts sur les vraies corrections NIYAMA de cette session — ne fait
// partie d'aucun des 8 écarts listés dans CONFORMITE.md.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'pg' {
  export class Pool {
    constructor(config?: Record<string, unknown>)
    // Retour volontairement `any` (pas un type précis) : ce shim comble juste
    // l'absence de @types/pg pour que `tsc` ne bloque plus sur le module — il ne
    // doit PAS être plus strict que le comportement implicite précédent (`any`
    // cascadé depuis TS7016), sous peine de faire ressurgir des erreurs latentes
    // préexistantes ailleurs dans `@purama/smarana` (dépendance externe, hors
    // périmètre NIYAMA).
    query(text: string, params?: unknown[]): Promise<any>
    end(): Promise<void>
    on(event: string, listener: (...args: unknown[]) => void): void
  }
}
