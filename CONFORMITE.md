# CONFORMITÉ NIYAMA — MUKTI

**Date de l'audit** : 2026-08-23
**Auditeur** : terminal audit/conformité (lecture seule, code applicatif non modifié)
**Référence** : `~/purama/NIYAMA-BRIEF.md` (§7 checklist, §2 famille 1)
**Famille déclarée** : `karma_wellness` (`src/lib/legal/config.ts:13`) = famille 1 "Apps qui paient les utilisateurs (KARMA/wellness)" — cohérent avec le code réel (Stripe réel + wallet/missions/parrainage).

## VERDICT : ORANGE — 8 écarts

Aucune mécanique d'avis/note/installation **rémunérée et fonctionnelle** trouvée (pas de ROUGE). Mais un bloqueur runtime documenté (migration SQL non exécutée — 5 routes API légales échoueront en prod tant qu'elle n'a pas tourné) et du code mort dangereux identique au piège akasha-ai ("noter l'app" → XP) qui doit être supprimé avant qu'il ne soit un jour branché.

---

## 1. Pages légales

| Page | Statut | Preuve |
|---|---|---|
| `/mentions-legales` | ✅ présente, contenu réel MUKTI | `src/app/mentions-legales/page.tsx` → `buildMentionsLegales(MUKTI_LEGAL_CONFIG)` |
| `/cgu` | ✅ présente, contenu réel MUKTI | `src/app/cgu/page.tsx` → `buildCGU(MUKTI_LEGAL_CONFIG)` |
| `/politique-confidentialite` | ✅ présente | `src/app/politique-confidentialite/page.tsx` |
| `/cgv` | ✅ présente — **justifiée** : Stripe réel actif (`aPaiement: true`, `src/lib/legal/config.ts:18`, checkout/webhook/portal réels dans `src/app/api/stripe/`) | `src/app/cgv/page.tsx` → `buildCGV(MUKTI_LEGAL_CONFIG)` |

**Historique corrigé (preuve dans `ERRORS.md:5` et `:7`)** : les 4 pages légales affichaient auparavant le contenu d'une AUTRE app (VIDA Aide — "Scanner financier IA", CAF/CPAM/MDPH) et une adresse Vercel obsolète. Corrigé le 2026-08-23 via le socle NIYAMA partagé (`src/lib/legal/`), avec `descriptionActivite` réelle et clauses spécifiques MUKTI (`src/lib/legal/config.ts:16-47` — âge 16 ans, plans 0€/9,99€/83,90€, échec paiement 3 tentatives).

**Écart mineur — médiateur de la consommation** : la clause existe (`src/lib/legal/content/mentions-legales.ts:11-12,80`) mais le contenu généré dit littéralement *"en cours de désignation — à ce jour aucun médiateur de la consommation agréé n'est souscrit pour l'écosystème PURAMA"*. C'est honnête (pas de fausse coordonnée inventée) mais c'est une obligation légale L612-1 non remplie pour une app qui vend en ligne (`aPaiement: true`). **Action requise : souscrire un médiateur agréé** (point business, pas un bug de code).

## 2. Bandeau cookies

✅ **Fonctionnel**. `src/components/shared/CookieBanner.tsx` monté globalement dans `src/app/layout.tsx:7,93`. Persiste le choix (`vida_cookie_consent` en `localStorage`), boutons Accepter/Refuser réels (lignes 20-28), lien vers `/politique-confidentialite` et `/cookies`.
`/cookies` (`src/app/cookies/page.tsx`) déclare une liste de cookies **tous essentiels** (auth, thème, langue, consentement, code parrainage) — aucun cookie tiers publicitaire/tracking, PostHog en mode anonymisé sans cookie (lignes 97-108). Cohérent avec l'absence de consentement bloquant nécessaire pour des cookies non-essentiels.

**Nuance** : il existe un second système de consentement plus riche, non monté — `src/lib/legal/hooks/useCookieConsent.ts` + `src/lib/legal/components/CookieConsentBanner.tsx` + `POST /api/legal/cookie-consent` (`src/app/api/legal/cookie-consent/route.ts:1-4` — commentaire explicite : *"réservé à un usage futur ... MUKTI a déjà un bandeau cookies fonctionnel"*). Pas un écart : le composant réellement utilisé est fonctionnel, l'autre est un module partagé du socle non activé ici, documenté comme tel.

## 3. Preuve d'acceptation CGU horodatée

Le code est réel et correctement conçu :
- `POST /api/legal/accept` (`src/app/api/legal/accept/route.ts:19-49`) — version **toujours calculée serveur** (`CURRENT_LEGAL_VERSIONS[docType]`, jamais envoyée par le client, ligne 36), `upsert` sur `(user_id, doc_type)`, capture IP + user-agent + timestamp.
- Appelé automatiquement à l'inscription pour `cgu`/`cgv`/`confidentialite` (`src/app/(auth)/signup/page.tsx:69-75`).
- Table cible : `legal_acceptances`.

**🔴 ÉCART CRITIQUE (bloqueur runtime documenté)** : `ERRORS.md:8` — la migration SQL créant `legal_acceptances` / `cookie_consents` / `account_deletion_requests` sur le schéma `mukti` **n'a jamais été exécutée sur le VPS** (accès SSH port 22 indisponible depuis la session sandbox). Conséquence explicite documentée : *"les routes ... sont codées et buildent ... mais échoueront en runtime (`relation "mukti.legal_acceptances" does not exist`) tant que la migration n'a pas tourné."* Autrement dit, **aujourd'hui en production, l'appel `/api/legal/accept` à l'inscription échoue silencieusement** (le fetch est `.catch(() => {})` côté signup, ligne 74 — non bloquant pour l'UX, mais aucune preuve n'est réellement écrite en base). Remédiation prête et documentée dans `ERRORS.md:8` (script + commande `docker exec` + régénération des types), reste à exécuter dès qu'une session avec accès SSH VPS est disponible.

**Écart secondaire** : `LegalReacceptanceGate` (`src/lib/legal/components/LegalReacceptanceGate.tsx`) — le composant qui doit ré-afficher un accord de ré-acceptation quand une version de CGU/CGV change — existe et est exporté (`src/lib/legal/index.ts:15`) mais **n'est jamais importé dans `src/app`** (grep confirmé : 0 usage hors de son propre fichier et d'un commentaire dans `api/legal/accept/route.ts:4`). Pas d'impact aujourd'hui (une seule version en vigueur) mais le mécanisme de ré-consentement n'est pas monté — à faire avant la première évolution de CGU/CGV.

## 4. Page « Ma mémoire »

✅ Réelle, montée sur `/dashboard/ma-memoire` (`src/app/(dashboard)/dashboard/ma-memoire/page.tsx`), protégée par auth (redirect si non connecté, ligne 18).
- **Export RGPD réel** (art. 20) : `GET /api/legal/my-data` (`src/app/api/legal/my-data/route.ts:8-35`) lit réellement `profiles`, `legal_acceptances`, `cookie_consents` et renvoie un JSON téléchargeable — pas un stub, commentaire ligne 3 explicite ("jamais un stub {success:true}").
- **Suppression de compte réelle** (art. 17) : `POST/DELETE /api/account/delete` (`src/app/api/account/delete/route.ts:1-50`) — programme une suppression à 30 jours (période de grâce), confirmation textuelle obligatoire (`'DELETE_MY_ACCOUNT'`), rate-limité, annulable. Cron dédié `src/app/api/cron/account-deletion/` exécute la suppression effective (CASCADE + `auth.admin.deleteUser`, cf commentaire `AccountDeletionButton.tsx:18-21`). Implémentation reprise d'une app déjà en production (`arogya`) — pas improvisée (`account/delete/route.ts:4`).

**Même écart critique que le point 3** : `account_deletion_requests`, `legal_acceptances` et `cookie_consents` sont dans la migration bloquée (`ERRORS.md:8`) → export et suppression **échoueront eux aussi en runtime tant que la migration n'a pas tourné sur le VPS**.

## 5. Déclaration IA sur chaque UI de chat IA réelle

MUKTI a **deux** interfaces de chat IA conversationnel réel identifiées (recherche exhaustive des pages avec input libre + réponse IA en dialogue, par opposition aux fonctionnalités IA à sens unique) :

| UI chat | Fichier page | Composant chat | `AIDisclosure` présent |
|---|---|---|---|
| Aide IA (Q&A + écoute) | `src/app/(dashboard)/dashboard/aide-ia/page.tsx` | `QaChat` (`src/components/qa/QaChat.tsx`) | ✅ ligne 68 : `<AIDisclosure appName="MUKTI" .../>` |
| NAMA-Aidant (coach IA aidants) | `src/app/(dashboard)/dashboard/accompagnants/nama-aidant/page.tsx` | `NamaAidantChat` | ✅ ligne 47 : `<AIDisclosure appName="MUKTI" .../>` |

`AIDisclosure` (`src/lib/legal/components/AIDisclosure.tsx:14-19`) affiche le texte fixe *"Vous échangez avec l'assistant IA de MUKTI, pas avec un humain."* — conforme IA Act, wording identique auditable par grep (commentaire du composant, ligne 11).
Les deux pages ajoutent en plus un disclaimer santé mentale ("Je ne suis pas thérapeute" / "NAMA n'est pas un thérapeute ... compose le 3114").

**Fonctionnalités IA à sens unique vérifiées** (pas des "chats", donc hors obligation stricte mais transparence déjà présente dans le copy) : Journal mental (`journal-mental/page.tsx:12,53` — "l'IA analyse ton état mental" écrit explicitement dans l'UI), affirmations personnalisées (Exorcisme/Subconscient), détection de patterns (Boîte noire). Aucune n'imite une conversation humaine.

## 6. Lexique interdit et mécaniques d'avis/notes rémunérés

**Lexique santé/promesses interdit** (guérit/soigne/garanti/100% sûr/diagnostic médical) : `0 occurrence` dans `src/app` et `src/components` (grep exhaustif `.tsx`).

**🔴 MÉCANIQUE D'AVIS REMUNÉRÉ — CODE MORT DANGEREUX TROUVÉ (à supprimer immédiatement)** :
`src/lib/constants.ts:405` :
```
{ id: 'note_app', name: 'Noter l\'app', icon: '⭐', color: '#fbbf24', reward: 200, description: 'Noter MUKTI sur App Store' },
```
et `src/lib/constants.ts:422` : `note_app: 200` dans `MISSION_REWARDS`. Également `src/lib/constants.ts:408` : `{ id: 'feedback', ..., reward: 150, description: 'Donner un avis constructif' }`.

C'est **exactement** le piège akasha-ai ("laisse un avis 5 étoiles = +XP"). **Vérification qu'il n'est PAS actif** :
- `MISSION_CATEGORIES` / `MISSION_REWARDS` ne sont importés **nulle part ailleurs** dans le repo (`grep -rl "MISSION_CATEGORIES\|MISSION_REWARDS" src/` → seul `constants.ts` lui-même).
- Le système de missions réellement en production lit la table Postgres `mukti.missions` (`src/app/api/missions/route.ts:14`, `src/app/(dashboard)/dashboard/missions/page.tsx:24`), **pas** ces constantes.
- Le seed réel (`migrations/0011_g86_admin_missions.sql:67-74`) contient 6 missions propres (bienvenue, première méditation, rejoindre un cercle, parrainer, témoigner, rituel hebdo) — **aucune mission "noter l'app" ni "avis" n'est seedée**.
- L'admin CRUD missions (`MissionsClient.tsx`) est un formulaire libre (titre/description/points), pas un sélecteur pré-rempli avec ces catégories — un admin ne peut pas accidentellement instancier `note_app` d'un clic.

**Verdict sur ce point : code mort, non exploitable aujourd'hui, mais à supprimer** — c'est une mine identique au bug déjà trouvé ailleurs dans l'écosystème ; un futur dev qui copie `constants.ts` comme référence "canonique" pourrait le brancher par erreur. Recommandation : supprimer `MISSION_CATEGORIES`, `MISSION_REWARDS` (lignes 403-429) de `src/lib/constants.ts`, ou au minimum retirer les entrées `note_app` et `feedback`.

Recherche complémentaire (variantes "rate app", "leave review", "5 stars", "play store avis") : `0 occurrence` ailleurs dans `src/`.

## 7. Chiffres affichés vs `FACTS.md`

| Chiffre | MUKTI | FACTS.md | Statut |
|---|---|---|---|
| Split KARMA | `WEALTH_SPLIT_PCT` 50/10/40 (`src/lib/constants.ts:826-830`) | 50/10/40 | ✅ cohérent |
| Parrainage N1 | `REFERRAL_V4.n1_pct: 50`, `recurring_pct: 10` (`src/lib/constants.ts:774-775`) | 50% premier paiement + 10% récurrent | ✅ cohérent |
| WALLET_MIN | `WALLET_MIN_WITHDRAWAL = 5` (`src/lib/constants.ts:105`) | 5€ | ✅ cohérent |

**Écart mineur — libellé de réduction annuelle incorrect** : `src/lib/constants.ts:752-753` affiche *"Annuel — 83,90€/an (-33%)"*. Calcul réel : 9,99€×12 = 119,88€ ; 83,90€/119,88€ ⇒ réduction de **-30%**, pas -33%. La clause CGV (`src/lib/legal/config.ts:36`) dit d'ailleurs correctement *"-30 %"*. Le prix facturé (83,90€, `PLANS_STRIPE.main_annual.price_cents: 8390`) est identique partout où il compte réellement (page `/pricing` publique et Stripe checkout lisent tous les deux `PLANS_STRIPE`, `src/app/pricing/page.tsx:63-65`, `src/lib/stripe.ts:92,126`) — donc **pas de double prix facturé/affiché**, seul le pourcentage textuel est faux. À corriger : `-33%` → `-30%`.

**Écart annexe (hors NIYAMA strict, trouvé pendant l'audit)** : la page admin `/dashboard/admin/pricing` (`src/app/(dashboard)/dashboard/admin/pricing/page.tsx:20`) affirme que les prix modifiés y sont *"appliqués en live partout dans MUKTI (page /pricing, Stripe checkout, anti-churn flow)"*. C'est faux : `/pricing` et le checkout Stripe lisent la constante figée `PLANS_STRIPE`, pas `admin_settings.pricing_main_annual_cents` que cette page édite (79,90€ par défaut en base, `migrations/0011_g86_admin_missions.sql:81` vs 83,90€ réellement facturé). Un admin qui change le prix ici croira avoir changé le tarif réel — il n'en est rien. Bug produit, pas un risque légal en soi, mais source potentielle de confusion/faux affichage futur.

## 8. Migration SQL légale

**Documenté dans `ERRORS.md:8`** (ligne complète datée 2026-08-23) : migration `legal_acceptances` / `cookie_consents` / `account_deletion_requests` codée et prête (`packages/legal/sql/001_legal_core.sql` adapté schéma `mukti`) mais **non exécutée sur le VPS** — bloqueur réseau de la session (pas un problème de conception), remédiation précise déjà écrite (commande `docker exec` + `GRANT` + `NOTIFY pgrst`). **À exécuter avant toute mise en production réelle du parcours légal** — tant que ce n'est pas fait, les points 3 et 4 de ce rapport sont du code correct mais non fonctionnel.

---

## Écarts hors périmètre app individuelle (à vérifier au niveau écosystème, pas MUKTI seul)

- Registre des traitements RGPD (art. 30), DPA sous-traitants, runbook violation de données 72h CNIL, exports FEC, fiches App Privacy/Data Safety — non trouvés dans le repo MUKTI ; NIYAMA-BRIEF §5 les positionne comme un dossier de contrôle transverse à l'écosystème, pas par app.
- **Sign in with Apple** : absent (`useAuth.ts` n'expose que `signInWithGoogle`). MUKTI a les dépendances Capacitor iOS (`package.json` : `@capacitor/ios`) mais **aucun projet natif `ios/` généré** (aucun build encore lancé). Pas bloquant aujourd'hui, mais **obligatoire avant toute soumission App Store** (guideline 4.8 — login tiers présent = Apple Sign-In requis) et à préparer avant le pilier mobile.

---

## Récapitulatif des 8 écarts

1. 🔴 Migration SQL légale non exécutée sur VPS → `/api/legal/accept`, `/api/legal/my-data`, `/api/legal/cookie-consent`, `/api/account/delete`, `/api/cron/account-deletion` échouent en runtime (`ERRORS.md:8`).
2. Médiateur de la consommation non souscrit (`src/lib/legal/content/mentions-legales.ts:11-12`) — action business requise.
3. `LegalReacceptanceGate` codé mais jamais monté — pas de ré-consentement si CGU/CGV changent de version.
4. Code mort dangereux `note_app`/`feedback` (avis rémunéré) dans `src/lib/constants.ts:403-429` — à supprimer (piège identique akasha-ai).
5. Sign in with Apple absent malgré Capacitor iOS présent — requis avant soumission App Store.
6. Fiches App Privacy / Data Safety non générées — à faire avant soumission stores.
7. Libellé "-33%" incorrect (réel -30%) sur le prix annuel, `src/lib/constants.ts:752-753`.
8. Page admin Pricing prétend éditer les prix "live partout" alors que `/pricing` et Stripe checkout lisent une constante figée non connectée à `admin_settings`.

Aucun écart n'est une mécanique d'avis/note/installation rémunérée **fonctionnelle** — d'où ORANGE et non ROUGE. L'écart le plus urgent à corriger reste le n°1 (bloqueur runtime des 5 routes légales) et le n°4 (supprimer le code mort avant qu'il ne soit branché par erreur).

VERDICT:mukti:ORANGE:8

---

## REMÉDIATION — 2026-08-23 (session dédiée, périmètre strict = les 8 écarts ci-dessus)

1. **NON CORRIGÉ** — Migration SQL légale (`packages/legal/sql/001_legal_core.sql`, schéma `mukti`) toujours pas exécutée. Re-testé cette session avec le VRAI mot de passe (`grep VPS_SSH_PASSWORD .env.secrets`) : `sshpass -p "$VPS_SSH_PASSWORD" ssh root@72.62.191.111` → `ssh: connect to host 72.62.191.111 port 22: Connection refused`, confirmé 2 fois. Test de contraste dans le même environnement : `nc -zv 72.62.191.111 22` → refusé (RST immédiat, pas timeout) ; `nc -zv 72.62.191.111 443` → réussi. Conclusion : **ce n'est pas un problème de mot de passe** (la connexion TCP est coupée avant même la négociation SSH) — c'est un vrai blocage réseau sortant sur le port 22 depuis cet environnement sandbox, port 443 seul autorisé. Migration + commande d'exécution complète prêtes (`ERRORS.md`, ligne du 2026-08-23), à lancer dès qu'une session avec accès SSH port 22 est disponible.
2. **NON CORRIGÉ** — Médiateur de la consommation toujours non souscrit. Laissé honnête (le texte généré continue de dire explicitement qu'aucun médiateur n'est encore souscrit) — action business (souscription réelle), pas un bug de code.
3. **CORRIGÉ** — `LegalReacceptanceGate` monté. `src/components/shared/LegalReacceptanceGateMount.tsx` (server, calcule `docsEnAttente` via `computeDocsEnAttente`, fail-open si `legal_acceptances` absent/erreur) + `LegalReacceptanceGateClient.tsx` (`'use client'`, poste vers `/api/legal/accept`), montés dans `src/app/(dashboard)/layout.tsx`. Scope volontairement limité à `cgu`/`cgv`/`confidentialite` (exclu `mentions`, qui n'est jamais accepté à l'inscription non plus — sinon le gate aurait bloqué tous les utilisateurs en permanence). Fonctionnera pleinement dès que la migration du point 1 aura tourné (avant ça, fail-open → aucun blocage, comportement identique à aujourd'hui).
4. **CORRIGÉ** — Entrées `note_app` (avis rémunéré App Store) et `feedback` (avis rémunéré) supprimées de `MISSION_CATEGORIES`/`MISSION_REWARDS` dans `src/lib/constants.ts`. Vérifié `0` usage ailleurs dans `src/` avant suppression. Commentaire explicatif laissé en place pour empêcher toute réintroduction future.
5. **NON CORRIGÉ** — Sign in with Apple toujours absent. Hors périmètre code (dépend du build natif iOS + Apple Developer Program), non traité cette session comme demandé.
6. **NON CORRIGÉ** — Fiches App Privacy / Data Safety toujours non générées. Hors périmètre de cette remédiation code (livrables de soumission stores, pas du code applicatif) — non traité cette session.
7. **CORRIGÉ** — `src/lib/constants.ts` : `-33%` → `-30%`. `src/app/pricing/page.tsx` : le badge `-X%` est maintenant calculé dynamiquement (`round((mensuel×12 − annuel) / (mensuel×12) × 100)`) au lieu d'un texte figé, pour ne plus jamais se désynchroniser d'un futur changement de prix. `PricingEditor.tsx` (admin) : description du champ annuel reformulée sans pourcentage figé.
8. **CORRIGÉ** — La page admin Pricing édite désormais réellement la source utilisée par `/pricing` et Stripe. Ajouté `getEffectivePriceCents`/`getEffectivePricing` (`src/lib/admin-settings.ts`, lit `admin_settings.pricing_*`, repli sur `PLANS_STRIPE` si absent). `src/lib/stripe.ts` (`createSubscriptionCheckoutV7` + `switchSubscriptionToAntiChurn`) utilise cette valeur effective pour le `unit_amount` Stripe réel. Créé `GET /api/pricing` (public), consommé par `/pricing` au montage. **Effet de bord détecté et corrigé avant commit** : `admin_settings.pricing_main_annual_cents` contenait un seed stale à 79,90€ (`migrations/0011_g86_admin_missions.sql:81`) jamais aligné sur le prix réellement facturé (83,90€) — brancher la source telle quelle aurait fait BAISSER silencieusement le prix au prochain déploiement. Migration corrective `migrations/0012_fix_pricing_main_annual_default.sql` créée (aligne la valeur en base sur 8390 centimes), bloquée par le même accès SSH indisponible que le point 1 — à exécuter en même temps.

**Score** : 4/8 corrigés par le code (3, 4, 7, 8). 2/8 honnêtement non corrigés pour raison métier (2, business — souscription médiateur) ou hors périmètre explicite de cette session (5, natif iOS/Apple ; 6, livrables stores). 2/8 bloqués par un vrai blocage réseau VPS indépendant de cette session, code+migration prêts (1, 8-bis migration 0012) — testés avec les vraies credentials, blocage confirmé au niveau TCP, pas un problème d'authentification.

**Vérification avant commit** : `npx tsc --noEmit` → 0 erreur. `npm run build` → succès (exit 0), route `/api/pricing` bien générée. `npx eslint .` → 23 erreurs/7 warnings identiques avant/après (comparé via `git stash` sur la branche de base) — 0 nouvelle erreur introduite ; les 23 erreurs pré-existantes sont toutes `max-lines`/`no-empty` dans des fichiers non touchés par cette session (déjà trackées, session refactoring dédiée en cours cf commit `8196bc3`). Un blocage `tsc`/`build` pré-existant et sans lien avec NIYAMA (dépendance externe `@purama/smarana` à référence git flottante import `pg` sans types) a été neutralisé par un shim ambient minimal (`src/types/pg.d.ts`) uniquement pour pouvoir vérifier les 4 vraies corrections — documenté en détail dans `ERRORS.md`.

REMEDIATION:mukti:4/8:pending-commit
