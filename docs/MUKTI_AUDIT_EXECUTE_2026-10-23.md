# MUKTI — audit de stabilisation exécuté le 23 octobre 2026

**Statut : correctifs AURORA ciblés testés ; livraison globale bloquée, aucun déploiement.**

Le travail répond à une demande de stabilisation, sans nouveaux modes produit ni nouvelles fonctions matérielles. Les corrections de `codex/mukti-aurora-lifecycle-20261011` au commit `1e68ef01759e28bf2c47f599ea5435a6d7a1ba12` ont été reprises plutôt que réinventées. Le chevauchement du correctif de pauses `7a8cbb143ec3c49e76ca025db22a8fc118e39bbb` a été résolu avec l'horloge plus complète de cette branche ; les deux historiques sont conservés.

## Versions et périmètre

- Branche : `audit/mukti-hardware-compat-20261023`.
- Correctifs et suite centrale testés : `8479161d1501629e5ea77098c00a8a55b5337e99`.
- Dernier ajout technique : `66f4fa2e7c31ec37c27a906d071ec2052f10b8c4`, ajout du contrôle d'installation de l'application entière, sans changement des sources AURORA testées.
- `main` vérifiée inchangée : `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Pas d'utilisation du Mac, pas de déploiement, de migration de production, d'écriture dans les données clients, d'achat ou de commande d'un appareil physique.
- Déploiement Vercel désactivé pour la branche d'audit. Les workflows permanents ont des permissions de lecture.

## Corrections et garanties réellement exercées

| Partie | Correctif / comportement vérifié |
|---|---|
| Chronométrage | Temps actif distinct des pauses, y compris après transition et arrêt pendant une pause. |
| Déroulement | Première consigne à chaque phase, fin unique, reprise et redémarrage cohérents. |
| Soft | Le réglage existant sans rétention est effectivement appliqué. Pas de validation médicale déduite. |
| Démarrage | Préparation audio silencieuse, verrou contre doubles clics, annulation et réponses tardives. |
| Pause/arrêt | Coupure des consignes et sorties du parcours ; reprise explicite après arrière-plan. |
| Audio | Remise à zéro de toutes les couches, pas de reprise d'ancienne enveloppe, nettoyage poursuivi malgré erreur d'une API facultative. |
| Disponibilité | Absence de Web Audio annoncée au lieu de prétendre démarrer. |
| Réseau | Délai borné même si fetch ou JSON ignore abort ; temporisateurs/écouteurs libérés ; pas de relance automatique d'une mutation. |
| Sauvegarde | Fin d'expérience et enregistrement confirmé distincts. |
| Base | Mise à jour séance/progression dans une transaction ; propriétaire vérifié ; concurrence et doubles terminaisons maîtrisées. |
| Interface | Indicateur de chronométrage distinct d'une mesure corporelle ; durée CALM cohérente ; rendu réduit/suspendu selon réglages. |

## Résultats exécutés

Suite GitHub Actions sous Ubuntu 24.04.5, Node 24.21.0 et npm 11.19.0.

| Vérification | Résultat | Limite |
|---|---:|---|
| React/Vitest | 95/95 réussis | Composants et hooks réels avec services/périphériques simulés. |
| Node : transport, audio, helper serveur | 73/73 réussis | TypeScript réel exécuté avec doublures explicites. |
| PostgreSQL jetable 16.15 | 13/13 méthodes réussies | Tables AURORA réelles ; identités artificielles ; pas tout Supabase/PostgREST. |
| TypeScript ciblé | Réussi | Ce n'est pas le contrôle du projet complet. |
| Vérification des différences Git | Réussie | Portée du correctif. |
| Dépendances du banc isolé | 0 vulnérabilité signalée | Next de test verrouillé à 16.4.2 ; pas la dépendance Next de production. |
| Audit applicatif hors dépendances de développement | ÉCHEC | 25 entrées : 5 critiques, 7 élevées, 12 modérées, 1 faible. |
| Installation de l'application entière | ÉCHEC | Authentification de la dépendance Git privée indisponible ; paquet ESLint local absent. |

Les 12 séances complètes couvrant 4 variantes × 3 réglages sont déjà incluses dans les 95 tests. Une séquence de 1 000 actions déterministes est un test parmi les 73, pas 1 000 tests indépendants. Les sous-cas PostgreSQL ne sont pas additionnés artificiellement.

Un banc local séparé a également exécuté le vrai graphe Web Audio dans Chromium 144.0.7559.96, en mode sans interface et avec sortie physique muette : 7/7 contrôles réussis après correction, contre 5/7 avant. Le signal numérique RMS d'un redémarrage inactif passe d'environ 0,00715 à 0. Aucune mesure acoustique au casque, aucun niveau SPL et aucune conclusion thérapeutique n'en résultent.

Sur les 69 scénarios transport/audio du nouveau banc Node, l'ancienne version obtient 58 réussites/11 échecs et la version corrigée 69 réussites. Plusieurs scénarios peuvent représenter le même défaut.

### Preuves GitHub Actions

- Suite centrale, base et audit : https://github.com/puramapro-oss/mukti/actions/runs/39920668325
  - `120304837381` : régressions, typage ciblé et audit du banc — succès.
  - `120304837747` : PostgreSQL — succès.
  - `120304837720` : dépendances applicatives — échec visible.
- Application entière : https://github.com/puramapro-oss/mukti/actions/runs/39921142455
  - `120306394159` : installation — échec ; typage global/lint/build non exécutés.
- Évaluation du correctif Next du banc : https://github.com/puramapro-oss/mukti/actions/runs/39919110578
  - `120299755224` : succès avant adoption du verrou testé.

Le run de la suite centrale est globalement rouge à cause de l'audit applicatif ; il ne doit pas être présenté comme entièrement vert.

## Écriture atomique et migration

Le nouveau helper appelle `mukti.aurora_complete_session_atomic_v1` via `src/lib/aurora-completion.ts`. La migration correspondante est `migrations/20261023_aurora_atomic_completion.sql`.

Le banc PostgreSQL a vérifié 8 appels concurrents sur la même séance (un seul comptage), 16 séances distinctes concurrentes (16 incréments), et une erreur injectée dans l'écriture de progression (annulation de toute la transaction sans perte d'historique). Les valeurs incohérentes, le mauvais propriétaire et les appels directs anon/authenticated sont refusés. La fonction utilise `SECURITY INVOKER`, un search_path vide et un droit d'exécution réservé au rôle serveur.

**Cette migration doit être revue et validée dans l'environnement cible avant le déploiement du serveur correspondant.** Elle n'a été exécutée que dans la base jetable, puis détruite avec le job. Sans elle, le helper échoue explicitement plutôt que revenir à des écritures non atomiques. Le compteur historique des tentatives, y compris une durée nulle, est conservé ; il ne mesure pas un progrès physiologique.

## Blocages de livraison restant établis

1. Le verrou applicatif signale encore 25 entrées vulnérables, notamment Next, Capacitor et l'ancienne chaîne OpenTimestamps. Un signalement de dépendance n'est pas une preuve d'exploitabilité de chaque cas déployé. Aucun `npm audit fix --force` n'a été appliqué ; le verrou de production est inchangé.
2. Le runner ne peut pas télécharger la dépendance privée `puramapro-oss/purama-smarana` verrouillée à `6b97a377fd17022286e88ab8e09be1e9bceb4ada`. L'accès du connecteur GitHub ne confère pas automatiquement cet accès au runner. Aucun contenu privé n'a été publié pour contourner ce défaut d'accès.
3. `@purama/eslint-config` pointe vers `file:../packages/eslint-config-purama`, absent d'un checkout autonome. Il est réellement importé dans `eslint.config.mjs` ; ni suppression des règles ni faux module de remplacement.
4. Installation complète, typage global, lint et build doivent aboutir avant toute validation du logiciel entier. Les tests AURORA isolés ne remplacent pas ce contrôle.
5. Firmware des deux appareils, pilotes physiques, synchronisation réelle, casques, coques, alimentation, fonctionnement natif/hors ligne et IAO de bout en bout restent à éprouver sur les versions et matériels concernés. Aucun de ces points n'est certifié par cette suite.

## Reproduction

Dans le checkout de la branche :

```sh
cd tests/aurora-regression
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --reporter=verbose
node --test runtime-regression.cjs completion-wiring.cjs
npm run typecheck
npm audit --package-lock-only --audit-level=high
```

Le job `database-regression` utilise une base jetable locale nommée `mukti_regression`. Son script refuse un hôte non local ou un autre nom de base. Ne pas l'exécuter sur une base client.

**Décision : corrections ciblées éprouvées, mise en production non autorisée par ces résultats.** Les échecs de contrôle restent visibles ; aucun nouveau produit ou mode n'est requis pour les résoudre.
