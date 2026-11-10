# Régressions MUKTI — AURORA et continuité

Tests locaux du code AURORA réel, avec réseau, audio, vibrations et rendu 3D simulés. Aucun compte, secret, service payant, serveur MUKTI ni appareil physique n'est utilisé.

## Exécution reproductible

Node >= 22.12 est requis. Reprise du 10 novembre vérifiée avec Node 24.22.1 et npm 11.9.0.

```sh
cd tests/aurora-regression
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm audit --package-lock-only
```

Après installation, `npm run test:aurora` fonctionne aussi depuis la racine du dépôt. Le verrouillage de ce dossier est autonome : il ne remplace pas celui de l'application.

`.npmrc` désactive la résolution automatique des pairs : cette suite web utilise React 19.2.4 et ne doit pas installer la pile native optionnelle Expo/React Native des composants 3D. Les dépendances nécessaires sont déclarées explicitement et verrouillées. Les scripts d'installation sont désactivés ; l'installation propre et les tests ont été exécutés avec cette configuration.

## Couverture et limites

| Fichier | Cas | Vérification |
| --- | ---: | --- |
| `phase.test.tsx` | 13 | Horloge, pauses, arrêt, changements de phase, SOFT, durée des quatre variantes |
| `audio.test.ts` | 9 | Activation, silence, synthèse vocale, destruction, reprise tardive, paramètres invalides, délai audio |
| `session.test.tsx` | 19 | Contrôles réels, double clic, réponses API, arrêt, arrière-plan, reprise tardive, sauvegarde, états visibles, politique de rendu et mouvements réduits |
| `api.test.ts` | 5 | Forme JSON, annulation préalable, réponse tardive après annulation |

Le contrôle TypeScript couvre les fichiers testés et leurs imports transitifs. Les dépendances publiques de cet environnement, dont Next 16.4.6, sont verrouillées séparément de celles de production. Ce contrôle ne prouve donc pas le build complet avec le verrouillage de production.

Le `fetch` par défaut lève une erreur si un test ne le simule pas explicitement. Les composants 3D, les sorties audio et les vibrations sont remplacés dans les tests d'interface. Le moteur audio est testé séparément avec une API Web Audio simulée. Aucun résultat n'établit un niveau acoustique, un effet physiologique ou une compatibilité matérielle réelle.

Résultat du 11 octobre 2026 : **41 tests réussis**, TypeScript ciblé réussi, zéro alerte npm dans ce verrouillage de tests à cette date. Consulter `../../docs/AURORA_AUDIT_2026-10-11.md` pour les blocages de l'application complète.

Reprise du 12 octobre 2026 : **46 tests réussis** et TypeScript ciblé réussi. Les 5 scénarios ajoutés vérifient la cohérence des états affichés et les transitions de politique de rendu. Le composant Canvas r3f reste remplacé : ces tests vérifient la demande de rendu continu/à la demande, pas le débit d'images ni la consommation GPU réelle. Aucun nouvel audit npm, test navigateur réel ou essai matériel n'est compris dans cette reprise.


## Lot continuité du 10 novembre 2026

Cette même suite couvre désormais le journal personnel, les habitudes adaptées et le repos, la reconnaissance quotidienne, le contexte partagé et les retours après séance. Elle reprend aussi les tests du rituel AURORA avec musique de la PR #3. Aucun second moteur de test n'est créé. Après intégration et correction des dépendances, la passe consolidée a exécuté **353 tests sur 23 fichiers**, tous réussis ; le rapport complet est dans `../../docs/evidence/wellbeing-tests-2026-11-10.json`.

Les **15 tests PostgreSQL PGlite** exécutent les cinq migrations du lot et vérifient leurs droits, l'idempotence, les rollbacks et la préservation de l'historique. Il s'agit du moteur PostgreSQL en WebAssembly, avec rôles et utilisateurs synthétiques ; ce n'est ni une instance Supabase distante ni une épreuve concurrente entre plusieurs processus.

Un harness navigateur séparé dans `browser/` importe les vrais composants et remplace les API par des réponses synthétiques. Son état de qualification est consigné dans [le rapport de livraison](../../docs/MUKTI_WELLBEING_2026-11-10.md). Pour l'exécuter depuis ce dossier :

```sh
npx --no-install playwright install --only-shell chromium
npm run test:browser
```

La configuration de build de l'application exclut ce dossier et ses dépendances imbriquées. `npm run typecheck` vérifie séparément les tests, les composants, les routes du lot et leurs imports. Le workflow `wellbeing-regression.yml` exécute la suite, son contrôle TypeScript et les scénarios navigateur avec un seul worker, sans secret et sans URL de production.

## Correctif d’horloge du 10 novembre 2026

Le moteur conserve le temps actif après une frame tardive, y compris si plusieurs phases sont traversées. Pause et arrêt réconcilient la même horloge sans jouer de consignes manquées. Les 13 nouveaux cas sont dans `phase-timing.test.ts`.

Le banc résout maintenant aussi l’import racine `next` depuis ses dépendances locales. La compilation WebAssembly de PGlite est limitée à une tâche et le tas JavaScript à 512 Mo dans le **processus de test**, via `test.execArgv` : Vitest ne transmet pas automatiquement les options V8 du processus parent. Ces limites de ressources conservent toutes les assertions et les migrations testées.

Dans un environnement disposant de peu de ressources, les commandes réellement qualifiées sont :

```sh
cd tests/aurora-regression
RAYON_NUM_THREADS=1 npm test
RAYON_NUM_THREADS=1 npm run typecheck
cd browser
RAYON_NUM_THREADS=1 node ../node_modules/vite/bin/vite.js build --config vite.config.ts
```

Le rapport de cette reprise, les empreintes des sources et la portée exacte des vérifications sont dans [AURORA_TIMING_2026-11-10.md](../../docs/AURORA_TIMING_2026-11-10.md). Ce build Vite qualifie le banc client ; il ne remplace pas le build Next de production.

