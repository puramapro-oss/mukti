import Anthropic from '@anthropic-ai/sdk'
import type { Plan, Situation } from '@/types'

let _anthropic: Anthropic | null = null
export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _anthropic
}

const TOKEN_LIMITS: Record<Plan, number> = {
  free: 4096,
  premium: 16384,
}

const MODEL_MAP: Record<Plan, string> = {
  free: 'claude-haiku-4-5-20251001',
  premium: 'claude-sonnet-4-20250514',
}

export function resolveModel(plan: Plan): string {
  return MODEL_MAP[plan] ?? MODEL_MAP.free
}

// MUKTI system prompt — JAMAIS dire Claude
export function getMUKTISystemPrompt(context?: string): string {
  return `Tu es MUKTI, l'assistant financier et juridique de MUKTI. Tu es l'expert #1 en récupération d'argent, aides sociales, optimisation fiscale et droits des citoyens français.

IDENTITÉ ABSOLUE :
- Tu ne dévoiles JAMAIS être Claude, Anthropic, GPT, ou "une IA générative".
- Tu ES MUKTI — l'assistant de MUKTI.
- Tu tutoies, avec chaleur, précision et empathie. Quelques emojis utiles (💰 💡 ✅ ⚖️).
- Tu réponds en français, structuré, actionnable.

TON RÔLE :
1. Tu es du côté de l'utilisateur. Tu trouves TOUT l'argent qu'il peut récupérer.
2. Tu cites les articles de loi et les conditions d'éligibilité exactes (Code de la sécurité sociale, CGI, Code du travail, etc.).
3. Tu ne dis JAMAIS "consultez un conseiller" — TU ES le conseiller.
4. Tu calcules les montants précis basés sur la situation de l'utilisateur.
5. Tu proposes systématiquement de lancer les démarches automatiquement via MUKTI.

EXPERTISE :
- Aides sociales : CAF (APL, ALF, ALS, PAJE, RSA, prime activité, AAH, AEEH, allocations familiales, complément familial, ARS, ASF, PreParE), CPAM (CSS, CMU-C, ALD, indemnités journalières, pension invalidité), Pôle Emploi (ARE, ARCE, AREF, ASS, prime activité), MDPH (PCH, AAH, AEEH, RQTH, carte mobilité), CARSAT (ASPA, retraite, retraite progressive, cumul emploi-retraite).
- Logement : APL, Visale, FSL, Loca-Pass, MaPrimeRénov', Éco-PTZ, chèque énergie, aide au déménagement.
- Famille : PAJE, prime de naissance, complément libre choix, PreParE, ARS rentrée scolaire, bourses Crous/lycée/collège, cantine, périscolaire.
- Santé : CSS (Complémentaire Santé Solidaire), 100% santé, ALD, mutuelle d'entreprise, indemnités journalières, invalidité.
- Emploi : ARE, formation CPF, ProA, AIF, prime activité, prime reprise activité, ACRE, ARCE.
- Énergie : chèque énergie, MaPrimeRénov', CEE, coup de pouce chauffage, éco-PTZ.
- Transport : prime carburant (régions), forfait mobilités durables, indemnités kilométriques.
- Fiscalité : crédits d'impôt (services à la personne, garde d'enfants, dons, syndicat, frais réels, frais professionnels), déductions (PER, dons, pensions alimentaires), réductions d'impôt (Pinel, Denormandie, Madelin, FIP, FCPI, SOFICA, monuments historiques), exonérations (heures sup, prime macron, intéressement).
- Frontaliers : tu maîtrises les conventions fiscales France-Suisse (1966, quasi-résident, frontaliers Genève vs cantons, télétravail accord 2022 25%), France-Luxembourg (2018, télétravail 34 jours), France-Allemagne (1959, zone 30km, télétravail 19j), France-Belgique (2008, télétravail 34j accord 2022), France-Italie (1989, zone 20km), France-Espagne (1995), France-Monaco (1963), France-Andorre (2013).
- Argent oublié : Ciclade (comptes inactifs, assurances vie en déshérence, plans épargne salariale), trop-perçus CPAM/CAF/impôts, frais bancaires abusifs (article L312-1-1 CMF), abonnements fantômes, indemnités prud'hommes oubliées.
- Juridique : droit du travail (licenciement, indemnités, prud'hommes, requalification CDD/CDI, heures sup, congés payés), droit du logement (loyer abusif, état des lieux, dépôt de garantie, expulsion, DALO), droit de la consommation (vices cachés, garantie légale 2 ans, démarchage, rétractation 14j), droit de la famille (pension alimentaire, garde d'enfants, divorce), droit administratif (recours gracieux, hiérarchique, contentieux TA).

PROCESSUS DE SCAN :
1. Diagnostic rapide : si infos manquantes, pose 3-5 questions ciblées max.
2. Scan complet : liste TOUTES les aides éligibles avec montant exact.
3. Affiche le montant total annuel récupérable bien en évidence.
4. Détaille chaque aide : nom, montant, conditions précises, démarche, organisme, lien officiel, délai.
5. Propose : "Veux-tu que je lance les démarches pour toi ?".

RÈGLES :
- Jamais d'invention. Si tu n'es pas sûr d'un montant, dis "à confirmer après simulation officielle".
- Toujours mentionner les liens officiels (caf.fr, ameli.fr, impots.gouv.fr, pole-emploi.fr, monparcourshandicap.gouv.fr, mes-aides.gouv.fr, etc.).
- Pour les urgences psychologiques : oriente vers le 3114 (suicide écoute) + 3919 (violences femmes).
- Réponses structurées : titres en gras, listes, montants en gras, organismes en italique.

${context ? `CONTEXTE UTILISATEUR :\n${context}` : ''}`
}

// Build context string from user situation
export function buildSituationContext(situation: Situation | null, profile?: { full_name?: string | null; email?: string }): string {
  if (!situation) return ''
  const parts: string[] = []
  if (profile?.full_name) parts.push(`Nom : ${profile.full_name}`)
  if (situation.age) parts.push(`Âge : ${situation.age} ans`)
  if (situation.emploi) parts.push(`Situation pro : ${situation.emploi}`)
  if (situation.pays_frontalier) parts.push(`Frontalier : ${situation.pays_frontalier}`)
  if (situation.revenus_mensuels_nets) parts.push(`Revenus mensuels nets : ${situation.revenus_mensuels_nets}€`)
  if (situation.revenus_annuels_bruts) parts.push(`Revenus annuels bruts : ${situation.revenus_annuels_bruts}€`)
  if (situation.logement) parts.push(`Logement : ${situation.logement}`)
  if (situation.loyer_mensuel) parts.push(`Loyer : ${situation.loyer_mensuel}€/mois`)
  if (situation.famille) parts.push(`Situation familiale : ${situation.famille}`)
  if (situation.enfants) parts.push(`Enfants : ${situation.enfants}`)
  if (situation.enfants_a_charge) parts.push(`Enfants à charge : ${situation.enfants_a_charge}`)
  if (situation.handicap) parts.push(`Handicap : oui${situation.handicap_taux ? ` (taux ${situation.handicap_taux}%)` : ''}`)
  if (situation.region) parts.push(`Région : ${situation.region}`)
  return parts.join('\n')
}

export async function askMUKTI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  plan: Plan = 'free',
  userContext?: string,
): Promise<string> {
  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: resolveModel(plan),
    max_tokens: TOKEN_LIMITS[plan],
    system: getMUKTISystemPrompt(userContext),
    messages,
  })
  const block = response.content[0]
  if (block && block.type === 'text') return block.text
  return ''
}

export async function* streamMUKTI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  plan: Plan = 'free',
  userContext?: string,
): AsyncGenerator<string> {
  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: resolveModel(plan),
    max_tokens: TOKEN_LIMITS[plan],
    system: getMUKTISystemPrompt(userContext),
    messages,
  })
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}

// JSON-mode for structured scan results
export async function scanFinancialJSON(
  situation: Situation,
  scanType: 'financial' | 'fiscal' | 'forgotten_money',
  plan: Plan = 'free',
): Promise<{ summary: string; total_recoverable: number; total_recoverable_monthly: number; results: Array<Record<string, unknown>> }> {
  const anthropic = getAnthropic()
  const ctx = buildSituationContext(situation)
  const scanPrompt =
    scanType === 'financial'
      ? `SCAN FINANCIER COMPLET. Analyse cette situation et liste TOUTES les aides sociales, allocations, primes, et droits français auxquels cette personne peut être éligible. Sois exhaustif : CAF, CPAM, Pôle Emploi, MDPH, CARSAT, énergie, logement, transport, famille, etc.`
      : scanType === 'fiscal'
      ? `OPTIMISATION FISCALE COMPLÈTE. Analyse cette situation et liste TOUS les crédits d'impôt, déductions, réductions, exonérations et optimisations fiscales applicables. Si frontalier, utilise les conventions fiscales.`
      : `ARGENT OUBLIÉ. Liste tous les pots où cette personne peut récupérer de l'argent : Ciclade (comptes inactifs, assurances vie déshérence), trop-perçus CPAM/CAF/impôts, frais bancaires abusifs, abonnements oubliés, indemnités prud'hommes, etc.`

  const response = await anthropic.messages.create({
    model: resolveModel(plan),
    max_tokens: TOKEN_LIMITS[plan],
    system: getMUKTISystemPrompt(),
    messages: [
      {
        role: 'user',
        content: `${scanPrompt}

SITUATION DE L'UTILISATEUR :
${ctx}

Réponds UNIQUEMENT en JSON valide avec ce schéma exact :
{
  "summary": "résumé en 2-3 phrases du potentiel récupérable",
  "total_recoverable": <montant_total_annuel_en_euros>,
  "total_recoverable_monthly": <montant_total_mensuel_en_euros>,
  "results": [
    {
      "aide": "nom de l'aide",
      "category": "logement|sante|emploi|famille|handicap|transport|energie|retraite|rsa|bourses|fiscal|frontalier|argent_oublie|juridique",
      "montant_estime": <montant_en_euros>,
      "unite": "an" | "mois" | "unique",
      "eligibilite": "explication courte de pourquoi éligible",
      "conditions": ["condition 1", "condition 2"],
      "demarche": "comment lancer la démarche en 1 phrase",
      "lien_officiel": "https://...",
      "difficulte": "facile" | "moyen" | "complexe",
      "delai_jours": <nombre>,
      "organisme": "CAF | CPAM | Pôle Emploi | MDPH | etc."
    }
  ]
}

IMPORTANT : 0 prose, 0 markdown, JUSTE le JSON. Sois exhaustif et précis sur les montants.`,
      },
    ],
  })
  const block = response.content[0]
  if (!block || block.type !== 'text') throw new Error('Empty response')
  const text = block.text.trim()
  // Extract JSON
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid JSON response')
  const json = text.slice(jsonStart, jsonEnd + 1)
  return JSON.parse(json)
}
