# MUKTI — audit exécuté le 26 octobre 2026

**Statut : remédiation logicielle ciblée vérifiée. Produit complet PARTIEL, commande du kit définitif et commercialisation NON VALIDÉES. Aucun déploiement ni essai matériel.**

Ce rapport complète ceux des 23 et 25 octobre. Il remplace leur constat de 14 alertes applicatives pour la version testée ci-dessous, sans effacer l'historique. Un résultat npm audit à zéro n'est ni un audit de sécurité complet du code ni une certification du produit.

## Version et contrôle des changements

- Dépôt : `puramapro-oss/mukti`.
- Branche isolée : `audit/mukti-hardware-compat-20261023`.
- Départ : `0e84f3ac36c62de8936e5968e4f8fcb06a3443bd`.
- Sources, verrou et contrôles permanents adoptés : **`c7a9681f7212daea3eafc26ae73211ecc2ce46dc`**.
- `main` relue inchangée : `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Aucun changement des moteurs audio, des parcours, de la configuration Capacitor, des bases clientes ou des équipements physiques pendant cette passe.
- Aucun achat, déploiement, migration de production, transmission de documents personnels ou commande physique.
- Le workflow temporaire d'évaluation, qui ne déposait que des blobs publics immuables, a été retiré. Les contrôles permanents ont `contents: read` et aucun accès d'écriture aux branches.

## Blocage traité : dépendances applicatives

Le contrôle initial `npm audit --package-lock-only --omit=dev --json` signalait **14 entrées : 2 critiques, 1 élevée, 10 modérées, 1 faible**. Le candidat puis la version intégrée signalent **0 entrée** au même périmètre, avec un contrôle final strict `--audit-level=low`.

Corrections :

1. SDK Anthropic fixé à `0.91.1`, version corrective indiquée dans l'avis officiel GHSA-p7fg-763f-g4gf, sans passage aveugle à une nouvelle version majeure.
2. Remplacement de l'ancienne chaîne `javascript-opentimestamps` / `request` / `web3` / `bitcore-lib` par le code TypeScript du dépôt officiel OpenTimestamps, version source figée.
3. Maintien des fonctions publiques `sha256Hex`, `stampHash`, `verifyProof` et `formatBlockchainTimestamp`, ainsi que du format standard `.ots` stocké en base64. Ajout facultatif de la vérification de l'empreinte attendue du document.
4. Référence Git verrouillée de la dépendance privée SMARANA comparée avant/après : inchangée. Aucun contenu privé recopié dans le dépôt public.

Sources primaires :
- Avis Anthropic : https://github.com/anthropics/anthropic-sdk-typescript/security/advisories/GHSA-p7fg-763f-g4gf
- Source OpenTimestamps : https://github.com/opentimestamps/typescript-opentimestamps/tree/12ba7b2c4f4cd1b8ce52d2c17be5efedca3bceab

### Provenance et paquet local

Le paquet annoncé par le dépôt amont n'était pas disponible sur npm : la première installation a échoué avec E404. Le candidat a donc été construit à partir du commit public exact `12ba7b2c4f4cd1b8ce52d2c17be5efedca3bceab`, et non remplacé par un paquet de provenance inconnue.

- Archive : `vendor/typescript-opentimestamps-upstream-12ba7b2.tgz`.
- SHA-256 : `cbedebecadb716f90806131a212ed7fb64e8700140c380054a4fcdb870089f26`.
- Licence amont conservée : `LGPL-3.0-or-later`.
- Les 18 fichiers TypeScript d'origine, leur empreinte, la licence, le manifeste amont et la recette de reconstruction sont inclus.
- Adaptation de conditionnement : extensions ajoutées aux imports ESM émis. Le texte des sources TypeScript d'origine est préservé. Les obligations de distribution du produit final restent à examiner selon son conditionnement effectif.
- Aucun script d'installation dans le paquet local. Les autres scripts d'installation sont également désactivés dans les commandes de validation.

Un essai de conditionnement a échoué parce qu'une expression régulière rencontrait un exemple d'import dans un commentaire. La correction parcourt les véritables déclarations import/export avec l'analyseur TypeScript, sans modifier les exemples documentaires. Cet incident de préparation n'est pas compté comme un bug produit.

## Frontière réseau de l'horodatage

Le nouveau module `opentimestamps-network.ts` autorise uniquement des destinations HTTPS explicites. Il refuse les redirections, identifiants dans les URL et destinations arbitraires contenues dans une preuve. Les délais couvrent aussi la lecture du corps de réponse ; la taille des réponses et la complexité des opérations de preuve sont bornées.

Une preuve encore en attente n'est jamais déclarée confirmée. La vérification Bitcoin compare le résultat des opérations de preuve avec la racine de Merkle retournée par un explorateur HTTPS fixé. **Ce modèle fait confiance à ce fournisseur ; il ne constitue pas une vérification par un nœud Bitcoin local.**

La compatibilité testée concerne le format `.ots` v1 et les destinations explicitement autorisées. Les anciennes preuves référençant un calendrier HTTP ou une destination non approuvée ne sont pas suivies automatiquement. Aucun appel réel aux calendriers ou à l'explorateur n'a été fait pendant les tests : le protocole est réel, les réponses HTTP sont simulées.

## Exécutions vérifiées

Candidat exécuté avant adoption :
- Run `40360938862`, job `121705853840` : succès de tous les contrôles du candidat.
- https://github.com/puramapro-oss/mukti/actions/runs/40360938862

Contrôles permanents exécutés APRÈS adoption sur `c7a9681f7212daea3eafc26ae73211ecc2ce46dc` :
- Application complète : run `40361760390`, job `121708789784` — **succès**.
- https://github.com/puramapro-oss/mukti/actions/runs/40361760390
- Régressions / base / audit applicatif : run `40361760492` — **succès des trois jobs**.
  - `121708791328` : régressions et audit du banc isolé.
  - `121708791360` : PostgreSQL jetable.
  - `121708790749` : audit des dépendances applicatives.
- https://github.com/puramapro-oss/mukti/actions/runs/40361760492

Environnement observé : Ubuntu 24.04.5, Node 24.21.0, npm 11.19.0.

| Répertoire / périmètre | Commande ou contrôle | Résultat observé |
|---|---|---|
| Racine | Vérification SHA-256 de l'archive et de chaque source amont conservée | Succès ; aucun script d'installation dans le paquet |
| Racine | `npm ci --ignore-scripts --no-audit --no-fund` | Sortie 0 |
| Racine | `node --test tests/security-regression/opentimestamps-regression.mjs` | Sortie 0 ; **44/44** |
| Racine | `./node_modules/.bin/tsc --noEmit --pretty false` | Sortie 0 |
| Racine | `npm run lint -- --max-warnings=0` | Sortie 0 |
| Racine | `npm run build` | Sortie 0 |
| Racine | `npm audit --package-lock-only --omit=dev --audit-level=low` | Sortie 0 ; **0 signalement** |
| `tests/aurora-regression` | `npm ci --ignore-scripts --no-audit --no-fund` | Sortie 0 |
| `tests/aurora-regression` | `npm test -- --reporter=verbose` | Sortie 0 ; **134/134** |
| `tests/aurora-regression` | `node --test transport-regression.mjs audio-regression.mjs completion-wiring.mjs mediapipe-regression.mjs nature-regression.mjs` | Sortie 0 ; **120/120** |
| `tests/aurora-regression` | `npm run typecheck` | Sortie 0 |
| `tests/aurora-regression` | `npm audit --package-lock-only --audit-level=high` | Succès du contrôle du banc isolé |
| Racine / PostgreSQL isolé | `python3 tests/aurora-regression/database_regression.py` | Succès, aucune base cliente utilisée |
| Racine | `git diff --check HEAD^ HEAD` | Succès |

Les 44 nouveaux cas couvrent notamment l'intégrité d'une preuve, le format v1, les échecs des fournisseurs, le maintien de l'état en attente, les données incohérentes, le blocage des URL arbitraires, les corps de réponse trop volumineux et les délais d'attente. Ce n'est pas un audit de pénétration exhaustif. Les suites existantes ont des recouvrements fonctionnels ; les répétitions d'actions ne sont pas additionnées comme des tests indépendants.

Le build conserve des avertissements de dépréciation Next concernant `middleware` et Edge Runtime. Ils n'ont pas été supprimés artificiellement. Le contrôle ESLint, lui, a été exécuté avec zéro avertissement autorisé.

## Preuves conservées et relues

L'archive de preuves du candidat téléchargée a été contrôlée :
- Artefact Actions `12666769108`.
- SHA-256 ZIP : `67a94b99ce3ee137b267e3092aa4a4b0f8e7648b4329833ca27e813f82535364`.
- Rapports JSON avant/après : 14 puis 0 signalement sur le périmètre production.
- Empreintes Git et SHA-256 des huit fichiers du candidat : conformes.
- Empreintes des 18 sources originales contenues dans le paquet : conformes.

Les tests HTTP ne sont pas des essais des services publics en direct ; les suites audio utilisent des doublures de périphériques. Le rapport ne revendique donc ni une émission acoustique réelle ni une compatibilité physique universelle.

## Registre de livraison des deux modèles

| Domaine | État après cette passe | Preuve restant nécessaire |
|---|---|---|
| Dépendances applicatives et code modifié | VÉRIFIÉ sur le périmètre ci-dessus | Maintenir les audits ; compléter la revue de sécurité globale et les tests des services réels |
| Audio logiciel existant et lecteur de nuit | RÉGRESSIONS RÉUSSIES | Essais de restitution sur les sorties physiques et tous les parcours concernés |
| Application mobile locale | PARTIEL | `capacitor.config.ts` charge encore le site distant ; fonctionnement hors ligne de bout en bout non démontré |
| IAO, comptes et services réels | NON TESTÉS DE BOUT EN BOUT ici | Identités de test, parcours complets, consentements, erreurs et permissions |
| Transfert filaire puis débranchement | NON QUALIFIÉ | Contrôleur, stockage, format du programme et firmware exécutés sur un Portable et un Salon |
| Liste de pièces et assemblage | NON FIGÉS | Références et révisions, schémas, plans mécaniques, câbles, bilan électrique et thermique |
| Origine européenne intégrale | NON ÉTABLIE | Traçabilité fournisseur ; Hypex indique une fabrication des modules en Malaisie |
| Haut-parleurs et basses | CANDIDATS, PAS UN KIT VALIDÉ | Coffret, accord, filtrage, amplification et limites mesurées par voie |
| Cuivre, pierres, joints, grilles | NON ÉPROUVÉS ENSEMBLE | Fixations, amortissement, isolation, vibrations, températures et tenue mécanique |
| Volume maximal propre et protections | NON MESURÉS | Réponse acoustique, distorsion, excursion, température, niveaux d'écoute et défauts |
| Batterie / secteur / recharge | NON QUALIFIÉS | Assemblages réels, protections, endurance et comportement aux défauts |
| Plasma, biorésonance, eau/aliments, effets distants | AUCUNE VALIDATION APPORTÉE | Ne pas activer de sorties ou publier de performances non démontrées |
| Fabrication / vente | BLOQUÉES | Deux prototypes complets, essais applicables, dossier technique, notices, traçabilité et évaluation de conformité |

La qualité d'une fréquence, le niveau sonore, la conformité d'un assemblage et un bénéfice thérapeutique sont des validations distinctes. Aucun résultat logiciel ci-dessus ne les remplace.

Références matérielles/réglementaires revérifiées :
- Hypex, origine des amplificateurs et DSP : https://www.hypexdirect.com/company/about-hypex-direct/
- UE, responsabilité du fabricant du produit complet et éléments de conformité : https://europa.eu/youreurope/business/product-rules-compliance/general-product-compliance/ce-marking/index_fr.htm

**Décision : correctif logiciel adopté sur la branche d'audit et revalidé. Ne pas annoncer MUKTI Portable ou Salon comme finalisé, certifié, prêt à commander en kit définitif ou prêt à vendre sur la base de ces seuls contrôles.**
