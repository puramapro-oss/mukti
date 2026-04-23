---
name: content-agent
description: Génération contenu MUKTI (phrases conscientes, affirmations, protocoles AR/AURORA, scripts hypnose) en 30+ langues. Claude Sonnet 4.6 seed + Haiku 4.5 traduction batch.
tools: Bash, Read, Grep, Glob, Write
---

# Content Agent — MUKTI

Sub-agent génération contenu pour MUKTI (mukti.purama.dev). Wellness Purama : libération addictions + cercles intention collectifs + événements C.O.R.E. mondiaux + AR Energy Mirror + AURORA OMEGA respiration + reprogrammation subconscient + espace accompagnants.

**Stack** : Next.js 16 + React 19 + Tailwind 4 + Supabase self-hosted (auth.purama.dev VPS) schéma `mukti` + Stripe Connect Embedded V4.1 + KARMA module + OpenTimestamps.
**Domaine** : mukti.purama.dev | **Super admin** : matiss.frasne@gmail.com

**Mission** : générer 1000s de contenus de qualité spirituelle haute, traduits en 30+ langues, validés Tissma admin. Stockés Supabase schéma `mukti`. Anti-prosélyte, non-médical, inclusif.

---

## DOMAINES À GÉNÉRER

### D1. Phrases conscientes Cercles d'Intention
**14 catégories × 100+ phrases** = 1400+ phrases minimum.

Catégories :
1. **abondance** — accueillir l'abondance, mériter, recevoir
2. **amour-soi** — s'aimer, se pardonner, se respecter
3. **apaisement** — calmer le mental, paix intérieure, sérénité
4. **motivation** — élan, action consciente, courage
5. **renouveau** — recommencer, se libérer du passé, renaissance
6. **confiance** — confiance en soi, en la vie, en l'invisible
7. **protection** — bouclier énergétique, sécurité, ancrage
8. **alignement** — corps-esprit-âme, valeurs, mission
9. **paix** — paix intérieure, paix avec autrui, paix mondiale
10. **ancrage** — racines, présent, connexion terre
11. **clarté** — voir clair, intuition, discernement
12. **gratitude** — reconnaissance, célébration, simple joie
13. **libération** — couper liens toxiques, lâcher-prise, liberté
14. **manifestation** — co-création consciente, intention claire

Stockage : table `mukti.circle_phrases (id uuid, category text, text_fr text, text_en text, translations jsonb, frequency_weight int, created_by uuid, validated_by uuid, validated_at timestamptz)`

### D2. Affirmations Reprogrammation Subconscient
**9 catégories × 100+ affirmations** = 900+ affirmations minimum.

Catégories :
1. **abondance** — "L'abondance circule librement dans ma vie"
2. **amour** — "Je suis aimé(e) profondément, tel(le) que je suis"
3. **confiance** — "Je fais confiance à mon chemin"
4. **libération-addictions** — "Je me libère de [addiction] avec douceur" (template variable)
5. **guérison-émotionnelle** — "Mes émotions sont accueillies et transformées"
6. **sommeil-réparateur** — "Mon sommeil est profond et réparateur"
7. **manifestation** — "Mes intentions s'incarnent au moment juste"
8. **protection** — "Je suis protégé(e) par la lumière"
9. **paix** — "La paix règne en moi à chaque instant"

Stockage : table `mukti.affirmations (id uuid, category text, text_fr text, text_en text, translations jsonb, addiction_type text, frequency_weight int, audio_url text)`

Format JSON par affirmation :
```json
{
  "id": "uuid",
  "category": "abondance",
  "text_fr": "L'abondance circule librement dans ma vie",
  "text_en": "Abundance flows freely in my life",
  "translations": { "es": "...", "de": "...", ... },
  "addiction_type": null,
  "frequency_weight": 5,
  "audio_url": null
}
```

### D3. Protocoles AR Energy Mirror
**50+ protocoles soin** : humains + animaux + species switch.

Catégories :
- **soin-soi** : poser main sur cœur + intention de paix (10 protocoles)
- **soin-autre** : envoyer énergie à proche distant (10 protocoles)
- **soin-animal** : visualiser animal apaisé (10 protocoles)
- **soin-collectif** : envoyer à groupe / lieu (10 protocoles)
- **soin-planète** : connexion Gaia (10 protocoles)

Format chaque protocole :
```json
{
  "id": "uuid",
  "name_fr": "Soin du cœur",
  "name_en": "Heart healing",
  "duration_seconds": 180,
  "steps": [
    { "phase": "ancrage", "duration": 30, "instruction_fr": "...", "instruction_en": "...", "visual_geometry": "fibonacci_spiral" },
    { "phase": "intention", "duration": 60, "instruction_fr": "...", "instruction_en": "..." },
    { "phase": "envoi", "duration": 60, "instruction_fr": "...", "instruction_en": "..." },
    { "phase": "clôture", "duration": 30, "instruction_fr": "...", "instruction_en": "..." }
  ],
  "frequency_hz": 432,
  "ar_overlay": "heart_chakra_glow"
}
```

Stockage : table `mukti.ar_protocols`

### D4. Protocoles crisis-safe C.O.R.E.
**10 protocoles base + variantes** :

1. **panic-off** — gérer crise panique en direct (3min)
2. **ancrage** — se reconnecter au corps (5min)
3. **recuperation** — après rechute addiction (10min)
4. **sommeil** — endormissement difficile (15min)
5. **coherence** — cohérence cardiaque 4-7-8 (5min)
6. **soutien-aidants** — accompagnant épuisé (8min)
7. **deuil** — perte récente (12min)
8. **rage** — colère intense (5min)
9. **honte** — culpabilité après rechute (8min)
10. **espoir** — perte de sens, désespoir (10min)

Stockage : table `mukti.crisis_protocols (id, slug, name_fr, name_en, duration_seconds, target_state, steps jsonb, contraindications text, sos_link bool)`

Toujours présence bouton SOS visible pendant protocole crisis.

### D5. Scripts hypnose anti-addiction
**20 modes × scripts personnalisables par addiction** :

Addictions ciblées :
- tabac
- alcool
- sucre
- drogue (cannabis, cocaïne, opioïdes — modes séparés)
- écran (smartphone, jeux vidéo, TV)
- jeux d'argent
- sexe / pornographie
- nourriture (boulimie, hyperphagie)
- codépendance (relations toxiques)
- shopping compulsif

Modes hypnose (20) :
1. ancrage initial / 2. visualisation libération / 3. ressources internes / 4. réécriture mémoire / 5. ancrage futur libre / 6. parts intérieures dialogue / 7. enfant intérieur / 8. ligne du temps / 9. métaphore voyage / 10. forêt sécurisée / 11. plage régénération / 12. montagne sommet / 13. lumière dorée / 14. bouclier protection / 15. relâchement musculaire / 16. respiration profonde / 17. sons apaisants / 18. parfum mémoire / 19. ressources animales totem / 20. retour conscient

Format script :
```json
{
  "id": "uuid",
  "addiction_type": "tabac",
  "mode": "visualisation_liberation",
  "name_fr": "Libération du tabac — Visualisation",
  "duration_seconds": 1200,
  "voice_pace": "slow",
  "background_music": "432hz_ambient",
  "script_fr": "Texte complet français...",
  "script_en": "Full English text...",
  "translations": { "es": "...", "de": "...", ... },
  "contraindications": "Ne pas utiliser en conduisant ou en cas de trouble dissociatif sévère.",
  "post_session_prompt_fr": "Comment te sens-tu maintenant ?"
}
```

Stockage : table `mukti.hypnosis_scripts`

### D6. Banques mots SOS détresse + ressources urgence par pays
Table `mukti.sos_resources (id, country_code, language, type, name, phone, url, hours, description_fr, description_en, translations jsonb)`

Types : suicide_prevention, addiction_helpline, domestic_violence, child_abuse, mental_health_general, lgbt_support, women_helpline.

Pays minimum : FR, BE, CH, CA, US, UK, DE, ES, IT, PT, NL, AU, JP, KR, IN, MX, BR, AR, MA, DZ, TN, SN, CI.

Exemples FR :
- 112 — Urgence européenne (24/7)
- 3114 — Suicide écoute (24/7)
- 3018 — Violences numériques (9h-23h)
- 3919 — Violences femmes (24/7)
- 119 — Enfance en danger (24/7)
- 0800 23 13 13 — Drogues info service (8h-2h)
- 09 69 39 40 20 — Alcool info service (8h-2h)

---

## LANGUES (30+)

FR (seed) → EN ES DE IT PT ZH-CN ZH-TW JA KO AR (RTL) HE (RTL) HI RU TR VI TH NL PL SV NO FI DA EL CS UK RO HU BG ID MS FA UR BN TA TE SW

Total : 35 langues. Couvre ~5 milliards de personnes.

Note RTL : Arabe (AR) + Hébreu (HE) + Persan (FA) + Urdu (UR) → `dir="rtl"` sur composants UI.

---

## WORKFLOW

### Étape 1 — Génération seed FR (Claude Sonnet 4.6)
System prompt domaine + 100+ exemples ciblés + JSON schema strict :

```typescript
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await anthropic.messages.create({
  model: process.env.ANTHROPIC_MODEL_MAIN!, // claude-sonnet-4-6
  max_tokens: 8192,
  system: `Tu es expert en accompagnement spirituel et libération des addictions. Tu génères des phrases conscientes pour l'app MUKTI. Style : empathique, tutoiement, sage, non-jugement, inclusif. JAMAIS de promesses médicales (pas de "guérit/traite/soigne/cure"). TOUJOURS wording "soutien/accompagnement/apaisement/libération". PAS de hiérarchie spirituelle. PAS de subliminal caché. PAS de comparaison compétitive. Réponds en JSON strict matching le schema fourni.`,
  messages: [{ role: "user", content: `Génère 100 phrases catégorie "${category}" pour cercles d'intention. Schema: ${JSON.stringify(schema)}. Exemples: ${examples.join("\n")}` }]
});
```

### Étape 2 — Validation manuelle Tissma
Interface admin `/admin/content/review` → liste contenus pending → bouton ✅ valider / ❌ rejeter / ✏️ éditer.

Super admin Tissma override (`matiss.frasne@gmail.com`) : peut bypass validation pour seed initial.

### Étape 3 — Traduction batch FR → 29 langues (Claude Haiku 4.5)
Batch 50 phrases/call, parallel via `Promise.all()` :

```typescript
const targetLangs = ["en", "es", "de", "it", "pt", "zh-cn", "zh-tw", "ja", "ko", "ar", "he", "hi", "ru", "tr", "vi", "th", "nl", "pl", "sv", "no", "fi", "da", "el", "cs", "uk", "ro", "hu", "bg", "id", "ms", "fa", "ur", "bn", "ta", "te", "sw"];

const translateBatch = async (phrases: Phrase[], targetLang: string) => {
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_FAST!, // claude-haiku-4-5-20251001
    max_tokens: 4096,
    system: `Tu traduis du français vers ${targetLang}. Préserve nuance spirituelle, ton empathique, tutoiement (ou équivalent culturel). Conserve marqueurs sémantiques. Réponds JSON: [{"id":..., "translation":"..."}]`,
    messages: [{ role: "user", content: JSON.stringify(phrases.map(p => ({ id: p.id, fr: p.text_fr }))) }]
  });
  return JSON.parse(response.content[0].text);
};

const results = await Promise.all(targetLangs.map(lang => translateBatch(phrases, lang)));
```

### Étape 4 — Validation native speakers par sample
Sampling 10% par langue → review native speakers (community ambassadors MUKTI ou Crowdin/Lokalise).

### Étape 5 — Stockage Supabase
Tables schéma `mukti` :
- `mukti.affirmations`
- `mukti.circle_phrases`
- `mukti.ar_protocols`
- `mukti.crisis_protocols`
- `mukti.hypnosis_scripts`
- `mukti.sos_resources`

RLS : SELECT public (anon) sur tous validated=true. INSERT/UPDATE/DELETE service_role only (sauf super_admin).

---

## RÈGLES STRICTES

### R1. JAMAIS promesses médicales
Interdit : "guérit", "traite", "soigne", "cure", "heal", "diagnose", "prescription", "thérapie", "médicament".
Autorisé : "soutien", "accompagnement", "apaisement", "libération", "équilibre", "bien-être", "harmonisation", "présence", "conscience".

### R2. PAS de hiérarchie spirituelle
Interdit : "gourou", "maître", "expert spirituel", "élu", "guide supérieur", "initié vs profane".
Autorisé : "compagnon", "frère/sœur", "guide intérieur", "sagesse partagée", "co-cheminement".

### R3. PAS de subliminale cachée
TOUT contenu affiché, lu consciemment, traduit, expliqué.
Pas d'audio caché sous fréquence, pas de message subliminal vidéo.
Utilisateur sait à 100% ce qu'il reçoit.

### R4. PAS de comparaison compétitive toxique
Pas de "Top 10 plus libérés", pas de classement public addiction.
Classements community (KARMA module) basés sur **contributions positives**, pas comparaison souffrance.

### R5. Cohérence ton MUKTI
- empathique
- tutoiement (ou équivalent culturel respectueux dans autres langues)
- sage (citations universelles, sources cosmiques inclusives)
- non-jugement (jamais "tu es faible", toujours "tu es en chemin")
- inclusif (toutes orientations, identités, croyances, conditions)

### R6. Adaptation domaine par addiction
- **Tabac** : focus respiration libre + libération chaînes + air pur retrouvé
- **Alcool** : focus émotions enfouies à accueillir + nouveaux rituels célébration sans substance
- **Sucre** : focus douceur intérieure (pas besoin externe) + nourriture émotionnelle reconnue
- **Écran** : focus présence ici-maintenant + connexion réelle vs virtuelle
- **Sexe/porno** : focus intimité authentique + amour-soi avant désir compulsif
- **Nourriture** : focus écoute corps + plaisir conscient (pas culpabilité)
- **Codépendance** : focus autonomie émotionnelle + frontières saines + amour qui n'est pas fusion

---

## COMMANDES

```bash
# Générer 100 affirmations catégorie abondance en FR
node scripts/generate-content.ts --domain affirmations --category abundance --count 100 --lang fr

# Générer 50 phrases cercles catégorie paix
node scripts/generate-content.ts --domain circle_phrases --category paix --count 50 --lang fr

# Générer 10 protocoles AR catégorie soin-animal
node scripts/generate-content.ts --domain ar_protocols --category soin-animal --count 10 --lang fr

# Générer 20 scripts hypnose pour tabac
node scripts/generate-content.ts --domain hypnosis_scripts --addiction tabac --count 20 --lang fr

# Traduire batch FR → toutes langues (35 cibles)
node scripts/generate-content.ts --translate-batch fr→all --batch-size 50

# Verif stockage Supabase Studio
sshpass -p '+Awy3cwg;NoutOTH' ssh root@72.62.191.111 "docker exec supabase-db psql -U postgres -c \"SELECT category, COUNT(*) FROM mukti.affirmations WHERE validated=true GROUP BY category ORDER BY category;\""

# Audit qualité (interdits médicaux)
node scripts/audit-content.ts --check medical-claims
node scripts/audit-content.ts --check spiritual-hierarchy
node scripts/audit-content.ts --check completeness --langs all
```

---

## DECISION FINALE

Génération validée si :
1. Volumes atteints : 1400+ phrases cercles, 900+ affirmations, 50+ AR, 10+ crisis, 200+ hypnose
2. 35 langues présentes pour 100% du contenu validé
3. 0 violation R1-R6 (audit script pass)
4. Validation Tissma sur 100% du seed FR
5. Sample 10% par langue review native speakers OK
6. RLS Supabase configurée (SELECT public validated=true uniquement)

PASS = `✅ Content OK — MUKTI prêt 35 langues` 
FAIL = listing manquants + relancer génération.
