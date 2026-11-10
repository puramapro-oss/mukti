# AURORA — fiabilité du temps actif — 10 novembre 2026

## Résultat

**PASS — correction locale qualifiée.** La suite finale exécute **366 tests sur 24 fichiers**, tous réussis, sortie 0, en **24,45 s**. Elle comprend les 15 tests SQL PGlite et 13 nouveaux cas de temps retardé. TypeScript ciblé et build Vite du banc client réussissent.

**PARTIEL — intégration de production.** Cette livraison est une correction proposée sur GitHub, sans fusion, migration distante ni déploiement. Le navigateur actuel est bloqué avant qualification ; aucun succès visuel, vocal ou acoustique réel n'est revendiqué pour ce correctif.

## Continuité conservée

Base : `4efb1764435fad67fc345d79365e710858b5bdb4`, branche `codex/mukti-wellbeing-continuity-20261110`. Son parent direct est `6edfb20aa6d635444ac1439344611d08a8d768db`, tête de la PR #3 du rituel musical. Le lecteur, le rituel, le journal et les retours de séance sont donc repris ensemble.

La copie de travail est un extrait ciblé de **158 fichiers**, contrôlés contre les blobs Git avant modification, avec les imports transitifs du banc. Ce périmètre permet les tests autonomes ; il ne constitue pas une qualification du build Next complet ni de ses dépendances privées.

## Défauts reproduits et correction

L'ancien moteur passait au plus une phase par frame et redémarrait la suivante à l'instant d'arrivée de cette frame. Le dépassement était perdu. Neuf nouveaux tests ont d'abord échoué sur le moteur original, sortie 1 :

- à 8,250 secondes, le compteur affichait 8 secondes ;
- à 91,5 secondes, une frame pouvait laisser le moteur à la deuxième phase et à 8 secondes ;
- une frame dépassant toute la durée restante ne terminait pas correctement les quatre variantes.

Le moteur suit désormais les frontières temporelles prévues. Une seule mise à jour peut traverser plusieurs sous-étapes et plusieurs phases, en conservant le temps actif. Seules la phase et la consigne courantes sont émises ; les consignes dépassées ne sont pas jouées en rafale.

La même réconciliation s'applique à **Pause** et **Arrêter**, même avant une nouvelle frame. Elle n'émet alors aucune consigne. Un arrêt explicite conserve son motif, y compris l'inconfort, même si la durée totale vient d'être atteinte. La fin normale et l'arrêt restent uniques et libèrent la boucle d'animation.

Les pauses longues sont exclues du temps actif. La relecture conserve son recalage et retire les enregistrements postérieurs au point repris. Les cycles comptés décrivent le guidage programmé ; ils ne mesurent pas la respiration de la personne. Aucun échantillon artificiellement parfait n'est ajouté pour les sous-étapes non affichées.

Les **13 nouveaux tests** couvrent ces comportements, les quatre durées, la finalisation unique, les callbacks, l'arrêt en pause et la relecture. Une seule attente ancienne a été corrigée : elle imposait auparavant la perte de 10 ms.

## Fiabilité du banc de vérification

Les dépendances implicites de l'environnement ont été retirées :

1. Le contrôle TypeScript résout l'import racine `next` depuis le verrouillage du banc, comme ses sous-chemins. Cinq erreurs TS2307 étaient reproductibles sans installation à la racine de l'application. Son script limite aussi le tas JavaScript à 512 Mo pour éviter les interruptions constatées dans cet environnement.
2. Le processus Vitest reçoit explicitement une compilation WebAssembly à une tâche et un tas JavaScript de 512 Mo. Les limites posées seulement sur le processus parent n'étaient pas transmises par Vitest. Les tentatives antérieures étaient interrompues par SIGKILL ; les mêmes assertions et migrations passent avec ces réglages.

`RAYON_NUM_THREADS=1` a également été utilisé pour les commandes dans cet environnement. Toutes les assertions, migrations et règles de sécurité sont conservées. Le manifeste du banc change uniquement son script TypeScript ; les versions de dépendances et les verrouillages sont inchangés.

## Vérifications réellement exécutées

| Vérification | Résultat et portée |
| --- | --- |
| Installation propre du banc | PASS — `npm ci --ignore-scripts --no-audit --no-fund`, 218 paquets, sortie 0 |
| Reproduction avant correction | PASS comme reproduction — 9 nouveaux tests en échec sur la base originale, sortie 1 |
| Suite finale | PASS — 366/366 tests, 24 fichiers, sortie 0, 24,45 s |
| SQL PGlite inclus | PASS — 15 tests, migrations et rôles synthétiques locaux |
| TypeScript du banc | PASS — routes, composants et imports ciblés ; configuration autonome |
| Build Vite du banc | PASS — 1 869 modules, sortie 0 ; avertissements `use client` attendus pour ce banc client |
| Revue indépendante du correctif | PASS — aucun constat bloquant sur callbacks, pause/arrêt, finalisation et relecture |
| Chromium dans l'exécuteur | BLOQUÉ — `socket() failed: Operation not permitted (1)`, SIGABRT, avant une page AURORA |
| Navigateur distant autorisé | BLOQUÉ — connexion locale refusée, puis tentative de fichier partagé expirée et connexion du navigateur fermée |
| Build Next complet, lint global et déploiement | NON TESTÉ dans cette reprise |
| Authentification/base distantes, voix réelle, WebGL et appareil sonore | NON TESTÉ dans cette reprise |

Les tests DOM emploient les vrais composants et hooks, mais simulent les API, le son, les vibrations et le Canvas. PGlite exécute du SQL réel en WebAssembly ; ses rôles restent des données synthétiques. Il ne prouve ni le schéma Supabase distant ni la concurrence entre processus.

Les fichiers de preuve sont [le rapport Vitest final](evidence/aurora-timing-tests-2026-11-10.json) et [le reçu de qualification](evidence/aurora-timing-qualification-2026-11-10.json). Les sorties 137 et tentatives navigateur restent signalées dans le reçu ; les résultats positifs ne reposent pas sur ces exécutions interrompues.

## Commandes finales

Depuis `tests/aurora-regression` :

```sh
RAYON_NUM_THREADS=1 npm test -- --reporter=default --reporter=json --outputFile=/tmp/aurora-continuity-final-pass.json
RAYON_NUM_THREADS=1 npm run typecheck
```

Depuis `tests/aurora-regression/browser` :

```sh
RAYON_NUM_THREADS=1 node --max-old-space-size=384 ../node_modules/vite/bin/vite.js build --config vite.config.ts --outDir /tmp/aurora-continuity-browser-dist
```

## État des fonctions et suite d'intégration

Le rituel conserve son aperçu, sa confirmation, ses quatre durées, ses huit étapes, ses réglages de voix/musique/tonalité, son mode texte, sa pause, son arrêt et son export. Une action personnelle reste **prévue** après le guidage. Le brouillon du rituel reste en mémoire de page ; son export texte permet de le conserver, mais la synchronisation des objectifs avec PURAMA ONE/IAO reste à raccorder au modèle canonique.

Le lot précédent contient déjà des preuves de 353 tests et de 10 scénarios Chromium sur la base `4efb176…`. Ce sont des exécutions antérieures documentées dans [le rapport continuité](MUKTI_WELLBEING_2026-11-10.md), distinctes de la qualification navigateur de ce correctif.

La cible d'hébergement retenue est **Hostinger avec Cloudflare**. L'ancien statut Vercel « Account is blocked » est historique et ne constitue pas le chemin de livraison à réactiver. Le lancement commercial reste soumis à son calendrier et à la qualification de l'environnement canonique. Aucun déploiement n'a été effectué dans cette reprise.

Les limites déjà consignées dans le lot continuité (configuration ESLint partagée, dépendances OpenTimestamps, modèle d'objectifs et intégration distante) restent ouvertes. Ce correctif ne modifie pas ces autres chantiers.


## Contrôle indépendant après publication

La première CI du correctif, [run 42912965049](https://github.com/puramapro-oss/mukti/actions/runs/42912965049) sur `9a23f3ff6ffbdcb3ea0e1033e24d0ab63e2f4336`, a confirmé **366 tests, TypeScript et zéro vulnérabilité signalée dans le verrouillage du banc**.

L'installation du navigateur s'est ensuite arrêtée : `ubuntu-latest` a fourni Ubuntu 26.04.1, non pris en charge par le Playwright 1.59.1 verrouillé. Le test Playwright n'avait pas été exécuté. Le workflow cible maintenant **Ubuntu 24.04**, présent dans le registre des navigateurs et des dépendances de cette version de Playwright.

Ce complément conserve les permissions de lecture et toutes les étapes de contrôle. Le résultat de la CI sur le nouveau commit est à consulter dans [la PR #4](https://github.com/puramapro-oss/mukti/pull/4) ; les résultats du premier run ne constituent pas une validation Chromium.
