# MUKTI — audit logiciel exécuté le 25 octobre 2026

**Statut global : PARTIEL. Correctifs ciblés vérifiés ; livraison globale BLOQUÉE. Aucun déploiement, aucun essai matériel ou clinique.**

Ce rapport complète celui du 23 octobre sans effacer son historique. Les résultats ci-dessous concernent une version précise ; ils ne garantissent pas l'absence de tout défaut ni la réalisation de toutes les fonctions du projet.

## Version, périmètre et preuves

- Dépôt : `puramapro-oss/mukti`.
- Branche : `audit/mukti-hardware-compat-20261023`.
- Source de départ de cette passe : `99045f01f9e36912f5285fd311c67c11dc8dd5b5`.
- Version finale des sources et tests réellement vérifiée : `66d188e42061ca7e4cf7c0d081ca290935e0f928`.
- `main` relue inchangée à `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Déploiement Vercel désactivé pour la branche d'audit dans `vercel.json`.
- Aucun accès au Mac, achat, modification de données clients, migration de production, commande physique ou émission corporelle.
- Aucun changement de `package.json`, du verrou des dépendances ou des routes serveur pendant cette passe.

Preuves exécutées sur GitHub Actions, Ubuntu 24.04.5, Node 24.21.0 et npm 11.19.0 :

- Reproduction avant correction : https://github.com/puramapro-oss/mukti/actions/runs/40228264503 — job `121274276851` : 112 tests existants réussis et 18 nouveaux cas en échec.
- Contrôles finaux : https://github.com/puramapro-oss/mukti/actions/runs/40228985085
  - `121276439210` : régressions, typage des tests, différences Git et audit du banc isolé — succès.
  - `121276439480` : PostgreSQL jetable — succès.
  - `121276439446` : audit des dépendances applicatives — échec, conservé comme blocage.
- Application entière : https://github.com/puramapro-oss/mukti/actions/runs/40228985043 — job `121276460194` : installation, typage, lint et build terminés avec succès.

Le workflow des régressions est globalement en échec à cause de son audit applicatif. Il ne doit pas être présenté comme entièrement vert.

## Corrections implémentées

La logique du lecteur de nuit a été extraite dans `src/components/reprogrammation/useNightPlayerSession.ts`, et le composant `NightPlayer.tsx` utilise ce contrôleur. Les catégories, ambiances, voix facultative et choix du volume progressif ou fixe sont conservés.

| Défaut reproduit | Comportement vérifié après correction |
|---|---|
| Clics de démarrage répétés pendant l'attente | Une seule demande en cours par instance du lecteur, verrouillée avant le premier await. |
| Réponse tardive après fermeture du lecteur | Aucun démarrage audio ou vocal après démontage. |
| Démarrage sans possibilité d'annulation | Bouton d'annulation et invalidation des réponses devenues obsolètes. |
| Requête ou lecture JSON bloquée | Réutilisation du transport existant à délai borné, sans relance automatique de la mutation. |
| Réponse de démarrage incohérente | Validation de l'identifiant, des textes et des sources des affirmations avant la sortie audio. |
| Demandes de fin répétées | Arrêt local prioritaire et une seule demande de fin par transition du lecteur. |
| Confirmation affichée malgré une erreur HTTP ou un résultat invalide | Succès annoncé uniquement après confirmation ; sinon état d'enregistrement non confirmé. |
| Sauvegarde encore en cours | Redémarrage désactivé jusqu'au règlement de la demande ou de son délai. |
| Confirmation tardive après fermeture | Aucun message de succès après démontage. |
| Échec de l'annulation vocale facultative | La coupure de l'ambiance reste exécutée indépendamment. |

Une annulation côté client ne constitue pas l'annulation garantie d'une écriture déjà effectuée par le serveur. Le verrou local ne remplace pas une idempotence globale côté serveur. Aucun de ces deux résultats n'est revendiqué par cette correction.

## Tests ajoutés et contrôle d'intégration

- `night-player-lifecycle.test.tsx` : 18 cas nouveaux, tous en échec avant la correction et réussis ensuite. Plusieurs cas décrivent un même défaut ; ce n'est pas un décompte de 18 bugs indépendants.
- `night-player-integration.test.tsx` : 4 cas associant le vrai composant, le contrôleur de séance, le transport, le calcul de rampe et l'horloge du lecteur. Réseau et sorties audio sont simulés ; le temps est avancé par une horloge de test.

Ces quatre cas vérifient l'arrêt unique à l'échéance existante de 30 minutes avec volume progressif, le maintien du mode fixe jusqu'à l'arrêt utilisateur, un redémarrage explicite avec une nouvelle horloge, et l'invalidation d'un rappel temporel après démontage. Les 30 minutes sont simulées : ce n'est pas un essai d'endurance de 30 minutes sur un appareil.

Le premier passage d'intégration a échoué sur trois cas parce que le banc avait remplacé aussi la fonction de formatage du temps. Le mock a été corrigé pour conserver le vrai formateur, sans modifier les critères d'acceptation ni le produit. Cet incident de banc n'est pas comptabilisé comme un défaut produit.

## Registre des contrôles finaux

Les commandes suivantes ont été exécutées par les workflows sur le commit indiqué, pas seulement proposées. Le résultat attendu d'un contrôle réussi était une sortie 0.

| Répertoire | Commande | Sortie / résultat observé |
|---|---|---|
| Racine | `npm ci --ignore-scripts --no-audit --no-fund` | 0 — installation complète réussie, dépendance SMARANA verrouillée incluse. |
| Racine | `./node_modules/.bin/tsc --noEmit --pretty false` | 0 — typage de l'application réussi. |
| Racine | `npm run lint` | 0 — contrôle du code réussi. |
| Racine | `npm run build` | 0 — compilation réussie, sans déploiement ni identifiants de production. |
| `tests/aurora-regression` | `npm ci --ignore-scripts --no-audit --no-fund` | 0 — installation isolée réussie. |
| `tests/aurora-regression` | `npm test -- --reporter=verbose` | 0 — 134 tests réussis sur 134, dans 10 fichiers. |
| `tests/aurora-regression` | `node --test transport-regression.mjs audio-regression.mjs completion-wiring.mjs mediapipe-regression.mjs nature-regression.mjs` | 0 — 120 tests réussis sur 120, aucun ignoré. |
| `tests/aurora-regression` | `npm run typecheck` | 0 — typage du banc réussi. |
| Racine | `git diff --check HEAD^ HEAD` | 0 — contrôle du dernier correctif réussi. |
| `tests/aurora-regression` | `npm audit --package-lock-only --audit-level=high` | 0 — aucune vulnérabilité signalée dans ce verrou isolé. |
| Racine, PostgreSQL jetable configuré par le job | `python3 tests/aurora-regression/database_regression.py` | 0 — succès sur la base de test isolée, pas sur les données clients. |
| Racine | `npm audit --package-lock-only --omit=dev --audit-level=high` | 1 — 14 entrées : 2 critiques, 1 élevée, 10 modérées, 1 faible. BLOQUANT. |

Les 22 nouveaux tests sont déjà inclus dans les 134 tests React. Les séquences de nombreuses actions des tests existants ne sont pas comptées comme autant de tests indépendants. Les deux suites comportent des recouvrements fonctionnels et ne mesurent pas une couverture totale du projet.

## Sécurité des dépendances : non corrigée dans cette passe

Le dernier journal détaillé, job `121276439446`, signale toujours le SDK Anthropic et l'ancienne chaîne `javascript-opentimestamps`, notamment `bitcore-lib`, `request` et leurs dépendances. Aucun `npm audit fix --force` n'a été appliqué et aucune alerte n'a été masquée.

L'avis primaire Anthropic indique une correction à partir de 0.91.1 : https://github.com/anthropics/anthropic-sdk-typescript/security/advisories/GHSA-p7fg-763f-g4gf. Cette version n'a pas été adoptée ni testée ici. La migration des dépendances doit être préparée et validée en conservant les fonctions utilisées. Un changement de nom de paquet ne constitue pas une preuve de correction.

Les alertes de dépendances ne prouvent pas l'exploitabilité de chaque cas dans l'application déployée, mais leur analyse et leur remédiation restent requises avant la livraison. L'audit isolé des dépendances de test ne remplace pas l'audit applicatif.

## Non testé et blocages de livraison

| Domaine | Statut et prochaine preuve nécessaire |
|---|---|
| Lecteurs et modules couverts par les suites | VÉRIFIÉS uniquement pour les cas exécutés et la version indiquée. |
| Application entière | Installation, typage, lint et build VÉRIFIÉS ; fonctionnement de tous les écrans et services réels non établi. |
| Sécurité applicative | BLOQUÉE par l'audit à 14 entrées ; migration et tests de compatibilité nécessaires. |
| IAO et services réels de bout en bout | NON TESTÉS pendant cette passe ; essais avec identités et environnements dédiés nécessaires. |
| Migration AURORA de production | NON EXÉCUTÉE ; revue et validation dans l'environnement cible nécessaires. |
| iPhone, Android, Mac, Windows et accessoires physiques | NON TESTÉS ; aucune promesse de compatibilité universelle. |
| Portable et Salon : composants, coque, alimentation et firmware | NON QUALIFIÉS par ces tests ; références finales, montage et prototypes nécessaires. |
| Transfert filaire, débranchement et exécution autonome | NON TESTÉS sur les appareils. |
| Niveaux acoustiques, lumière, haptique, thermique, interférences et endurance | NON MESURÉS ; essais instrumentés des assemblages et combinaisons nécessaires. |
| Biorésonance, plasma corporel, effets à distance et traitement eau/aliments | Aucune validation physique ou clinique apportée par cet audit logiciel ; aucune nouvelle sortie de ce type activée. |

**Décision : conserver les correctifs sur la branche d'audit. Les deux appareils ne sont pas déclarés terminés ni prêts à vendre.** Le nombre de tests réussis n'est ni une certification, ni une preuve thérapeutique, ni une garantie de fonctionnement de fonctions non implémentées ou non éprouvées.
