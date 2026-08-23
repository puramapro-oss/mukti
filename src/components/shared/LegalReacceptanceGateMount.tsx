import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeDocsEnAttente } from '@/lib/legal/versions'
import type { LegalDocType } from '@/lib/legal/types'
import LegalReacceptanceGateClient from './LegalReacceptanceGateClient'

// Calcule côté serveur les documents légaux (CGU/CGV/confidentialité) dont l'utilisateur
// connecté a accepté une version strictement antérieure à la version courante
// (`CURRENT_LEGAL_VERSIONS`). Fail-open : si la table `legal_acceptances` n'existe pas
// encore (migration non exécutée, cf ERRORS.md) ou toute autre erreur réseau, on ne
// bloque JAMAIS l'app — on renvoie simplement `[]` (même logique que l'appel
// fire-and-forget du signup).
async function getDocsEnAttente(userId: string): Promise<Array<Exclude<LegalDocType, 'mentions'>>> {
  const supabase = await createServerSupabaseClient()
  try {
    const { data: acceptances, error } = await supabase
      .from('legal_acceptances')
      .select('doc_type, version')
      .eq('user_id', userId)

    if (error || !acceptances) return []

    const dernieresAcceptations = acceptances.reduce<Partial<Record<LegalDocType, string>>>((acc, row) => {
      acc[row.doc_type as LegalDocType] = row.version as string
      return acc
    }, {})

    // Seuls cgu/cgv/confidentialite sont des documents "acceptés" par l'utilisateur
    // (comme à l'inscription, cf signup/page.tsx) — les mentions légales sont
    // informationnelles, jamais acceptées, donc jamais re-sollicitées ici.
    return computeDocsEnAttente(dernieresAcceptations).filter(
      (doc): doc is Exclude<LegalDocType, 'mentions'> => doc !== 'mentions'
    )
  } catch {
    return []
  }
}

export default async function LegalReacceptanceGateMount() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const docsEnAttente = await getDocsEnAttente(user.id)
  if (docsEnAttente.length === 0) return null

  return <LegalReacceptanceGateClient docsEnAttente={docsEnAttente} />
}
