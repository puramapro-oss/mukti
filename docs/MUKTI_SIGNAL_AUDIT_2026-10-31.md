# MUKTI — tonalités partagées et audit du 31 octobre 2026

## Conclusion et périmètre

**PASS pour les contrôles logiciels exécutés sur le commit `4472b4374ac3c69f5b3121984a73d2bea9f7e901`. PARTIEL pour le produit MUKTI complet. Aucun déploiement, aucun appareil physique validé, aucune autorisation de commercialisation délivrée.**

La demande porte sur deux modèles, Portable et Salon, un logiciel commun et un partage de fréquences distinct des conversations. Cette passe réalise un canal de **paramètres de tonalités audibles**, reproduites localement, et corrige les nouvelles alertes de dépendances détectées. Elle ne réalise pas une réception d'ultrasons par une antenne cellulaire, une transmission d'énergie thérapeutique, un réseau de stations physiques ou une connexion mondiale illimitée.

## Versions et conservation de l'existant

- Dépôt : `puramapro-oss/mukti`.
- Branche de travail : `audit/mukti-hardware-compat-20261023`.
- Départ : `e3eaa82be4ecaf805399f48883ba9767ff8d5d83`.
- Ajout des tonalités et tests : `573e9abeeeee61ee7b24631306b25b3e2f5cd425`.
- Correction des dépendances et contrôles permanents : **`4472b4374ac3c69f5b3121984a73d2bea9f7e901`**.
- `main` relue inchangée à `1ead78251bf48df493fb9bca14e4cb90f2df1c9a`.
- Déploiement de cette branche désactivé dans `vercel.json`, sans modification de ce réglage.
- Les conversations, le lecteur d'écoute seule, AURORA et les sons de nature sont conservés. Aucun troisième modèle ou nouvelle plateforme n'a été créé.
- Les quatorze associations thème/fréquence de `ContinuousSoundMode` sont conservées. Le composant réutilise désormais le lecteur commun : chaque démarrage y dure dix minutes au maximum, puis un nouveau démarrage volontaire est requis. Ce changement de durée est explicite ; ce n'est pas une conservation bit à bit de tous les anciens comportements.
- Aucun achat, migration de production, accès à un service audio réel, publication de conversation ou commande matérielle pendant cette passe.

## Réalisation du canal de tonalités

| Élément | Comportement implémenté |
|---|---|
| `/frequences` | Page accessible sans compte ni possession d'un appareil dans la version d'audit. Elle n'est pas déployée. |
| Choix | 396, 417, 432, 528, 639, 741 et 852 Hz ; durées de 1, 3, 5 ou 10 minutes. 432 Hz et une minute par défaut. |
| Partage | Lien contenant seulement `version`, `hz` et `seconds` dans le fragment. Aucun identifiant personnel, volume, URL de destination, droit de publication ou commande d'accessoire. |
| Lecture | Une sinusoïde générée localement, sans couche de musique, voix, bruit ou conversation ajoutée. Aucun accès au microphone. |
| Commande | Démarrage volontaire, annulation du démarrage, arrêt et volume local. Un lien ne lance pas la lecture. |
| Cycle de vie | Un arrêt invalide les réponses tardives. Pas de deuxième contexte sur double démarrage. La sortie est libérée après arrêt, fin, interruption ou démontage. |
| Fin de séance | Arrêt programmé dans l'horloge audio et nettoyage de secours. Une tâche JavaScript en retard ne prolonge pas volontairement la source au-delà de sa fin audio. |
| Arrière-plan | Cette version s'arrête lorsque la page est masquée ou quittée ; elle ne reprend pas automatiquement au retour. |
| Erreurs | Entrées invalides refusées ; délai de reprise audio limité ; erreur affichée plutôt qu'une fausse confirmation. |

Le format accepte uniquement les fréquences audibles listées. Les ultrasons et commandes de stimulation corporelle sont refusés par ce format, pas simulés comme disponibles. La demande d'ultrasons reste un développement distinct non validé.

Le moteur utilise un tampon d'une seconde, calculé à la fréquence d'échantillonnage du contexte, avec un nombre entier de cycles. Il est lu en boucle à vitesse 1 et sans décalage de hauteur. Une seule source et un gain composent le graphe. Les rampes sont de 50 ms. Le gain numérique initial vaut 0,04 et le plafond 0,12 : **ce ne sont pas des décibels ni une calibration de sécurité acoustique**.

L'exception du middleware concerne exactement `/frequences` ; les chemins privés et préfixes proches conservent leurs contrôles. Elle évite l'interrogation d'authentification pour cette page. Toutefois, la compilation indique encore `/frequences` comme route dynamique, avec l'organisation générale de l'application. Cette passe n'a pas établi une page entièrement statique, une distribution CDN, un fonctionnement hors ligne complet ou un coût d'hébergement nul.

Pour cette tonalité, la lecture ne dépend pas d'un flux audio continu ni d'un appel IA par auditeur. Cela retire ce besoin de transport audio de la conception, sans constituer un benchmark de coût ni une preuve de charge mondiale. Le service existant et le chargement de la page restent à héberger.

## Contrôles logiciels finaux

### Régression finale — tous les jobs réussis

Run **41223356211**, même commit **4472b4374ac3c69f5b3121984a73d2bea9f7e901** :
https://github.com/puramapro-oss/mukti/actions/runs/41223356211

- Job `124602305854` : suites fonctionnelles, typage du banc, différences Git et audit du banc — PASS.
- Job `124602305851` : PostgreSQL isolé — PASS.
- Job `124602305672` : audit applicatif au seuil élevé — PASS. Le contrôle strict tous niveaux est confirmé séparément ci-dessous.

| Suite | Résultat |
|---|---:|
| React/Vitest, lecteurs et interfaces | 148/148 PASS |
| Node audio, requêtes, sauvegarde et modèles existants | 120/120 PASS |
| Écoute seule à distance, tests existants | 55/55 PASS |
| Nouveau lecteur et format de tonalités | 57/57 PASS |
| Isolation de la route publique | 7/7 PASS |
| Typage du banc et contrôle des différences | PASS |
| Audit du verrou du banc isolé | PASS, zéro signalement dans l'exécution détaillée vérifiée |

Les **14 nouveaux cas React** sont déjà compris dans les 148. Les 57 + 7 cas Node constituent les **64 nouveaux cas** supplémentaires. Une boucle de cent démarrages/arrêts compte comme un scénario, pas comme cent tests indépendants.

Les contrôles d'interface exécutent les vrais composants avec des doublures explicites du lecteur audio. Les tests Node exécutent les véritables sources TypeScript avec des contextes audio, temporisateurs et réponses d'authentification simulés. Ce n'est pas un test de navigation complet sur un téléphone réel. Les services privés et la base de production ne sont pas utilisés.

### Application complète — toutes les étapes réussies

Run **41223356048**, même commit, job **124602304391** :
https://github.com/puramapro-oss/mukti/actions/runs/41223356048

Le journal final a été relu : installation verrouillée, intégrité de la bibliothèque d'horodatage, **44/44 tests d'horodatage**, **6/6 nouveaux tests de compatibilité des dépendances**, TypeScript global, ESLint avec zéro avertissement autorisé, compilation et audit strict — PASS.

Commande finale de sécurité :

`npm audit --package-lock-only --omit=dev --audit-level=low`

Résultat final observé : **`found 0 vulnerabilities`**. Ce résultat ne constitue pas un test d'intrusion ni une garantie d'absence de défaut dans le code applicatif. Il porte sur les avis connus de l'audit et le verrou examiné à cette date.

La compilation utilise Next.js 16.4.3 verrouillé, Node 24.22.1 et npm 11.19.1 dans ces exécutions. Des avertissements de dépréciation `middleware`/Edge et des actions ciblant Node 20 restent visibles. Ils ne sont pas masqués ni déclarés corrigés par cette passe. Les six tests de dépendances ne constituent pas une compilation native iOS/Android.

## Mesures numériques réelles, distinctes des doublures

Huit rendus ont également été exécutés localement avec les fonctions du véritable moteur dans `OfflineAudioContext`, sous Chromium **144.0.7559.96**, sans sortie acoustique et sans accès réseau pendant le rendu.

Source `src/lib/pure-tone-player.ts` :

- Git blob : `055bd903cec299b432c05c5ca7c4a129bcfbfcfa`.
- SHA-256 : `5944a3e827178dde9447f4976bac4572cb9b5807b544b24e7943da5415f2f1ce`.

| Cas | Observation numérique |
|---|---|
| 432 Hz, 44 100 échantillons/s | Estimation 432,000000791 Hz ; résidu relatif à la sinusoïde environ 3,34 × 10⁻⁸ ; silence après fin. |
| 432 Hz, 48 000 échantillons/s | Estimation 432,000000741 Hz ; résidu environ 3,28 × 10⁻⁸ ; silence après fin. |
| 432 Hz, 96 000 échantillons/s, gain 0,12 | Estimation 432,000000116 Hz ; crête inférieure ou égale au plafond ; silence après fin. |
| 852 Hz, 48 000 échantillons/s | Estimation 852,000005348 Hz ; silence après fin. |
| Gain nul | Tous les échantillons du rendu sont nuls. |
| Arrêt en cours de rendu | Échantillons nuls après l'arrêt appliqué à l'instant audio 0,501333 s. |
| Coupure puis réactivation du volume | Silence pendant la coupure, retour au niveau demandé, silence après la fin prévue. |
| Demande de gain excessive pendant la lecture | Plafond numérique respecté ; la fin prévue et son silence sont conservés. |

Les seuils des premiers rendus étaient une erreur de fréquence inférieure à 0,01 Hz, un résidu relatif inférieur à 10⁻⁵ et une crête ne dépassant pas 0,12001. Ils n'ont pas été assouplis pour faire passer les contrôles. Les résultats détaillés sont conservés dans `docs/evidence/MUKTI_DIGITAL_TONE_2026-10-31.json`.

**Les décimales ci-dessus décrivent une estimation d'un signal numérique synthétique. Elles ne mesurent ni l'horloge d'un convertisseur réel, ni la distorsion d'un casque ou d'une enceinte, ni des ultrasons, ni un effet biologique.** Les essais d'interruption utilisent l'horloge audio effectivement atteinte, pas la fiction d'une coupure physique instantanée exactement à la demi-seconde.

## Audit de sécurité : défaut trouvé puis corrigé

Le premier contrôle global du commit 573e9ab (run `41222079361`) réussissait l'installation, les tests, le typage, le lint et la compilation, mais échouait à l'audit strict : **quatre entrées modérées** étaient signalées autour de `glob`, `minimatch`, `rimraf` et `@capacitor/cli`. Un contrôle au seul seuil élevé pouvait passer malgré ces alertes ; il n'a pas été utilisé pour annoncer zéro signalement.

Deux avis amont examinés :

- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 — correction de `glob` à 14.0.2.
- https://github.com/advisories/GHSA-g3hv-75wg-m249 — correction de `minimatch` à 11.0.1.

La rétrogradation forcée de Capacitor proposée par npm n'a pas été appliquée. Un remplacement limité à la chaîne de dépendances de `rimraf` a été évalué, avec les **mêmes spécifications et versions verrouillées de toutes les dépendances directes**, y compris SMARANA et la bibliothèque d'horodatage.

Seules cinq entrées transitives du verrou ont changé : `glob` 13.0.6 vers 14.0.2, son `minimatch` 10.2.6 vers 11.0.1, `path-scurry` 2.0.2 vers 3.0.0, son `lru-cache` 11.5.2 vers 11.5.3, et l'ajout du moteur de correspondance non récursif associé.

Candidat évalué dans le run **41222933858** : installation, invariance des versions directes, contrôle réel Capacitor/rimraf/glob sur fichiers temporaires, types, lint, compilation, tests et audit strict zéro — PASS.

Archive d'évaluation téléchargée et contrôlée : SHA-256 `d3121995f71f7a77610472788950bae1902667e4b41856a2d764791163fc1e39`.

Blobs adoptés exactement :

- `package.json` : `665db58d24dc652f8f8cc3bc206437067ca722ee`.
- `package-lock.json` : `093fc7feb990b9dca46556d5243ec75db368be77`.

Le workflow d'évaluation temporaire et son étape séparée de conservation de blobs immuables ont été retirés. Les contrôles permanents restent en lecture seule. L'installation désactive les scripts de cycle de vie ; l'accès existant à la dépendance privée n'est fourni qu'à l'étape d'installation. Aucun jeton n'est inclus dans l'archive de preuves.

## Coût, compatibilité et validation restante

| Domaine | État et preuve encore nécessaire |
|---|---|
| Tonalités audibles et partage par lien | PASS dans les scénarios logiciels décrits ; non déployé. |
| Application complète | Installation, typage, lint, compilation et suites décrites PASS ; parcours de tous les services réels non testés de bout en bout. |
| Coût | Pas de nouveau service payant ni de nouvelle dépendance directe pour la fonction. Hébergement, capacité et coût réel par audience non mesurés. |
| Capacité mondiale | NON TESTÉ : pas de charge réelle à mille ou dix mille utilisateurs, pas de CDN configuré ici. |
| Stations physiques | NON INTÉGRÉ : pas d'annuaire d'antennes, de publication du firmware ou de synchronisation d'une séance physique en direct. |
| Téléphones et accessoires réels | NON TESTÉ : Safari/iPhone, Android, interruptions d'appels, pilotes et sorties physiques à éprouver. |
| Portable et Salon | PARTIEL : nomenclature définitive, schémas, montage, stockage, alimentation, firmware et transfert filaire autonome non qualifiés. |
| Matériaux et restitution | NON TESTÉ : cuivre, grilles, haut-parleurs, limites acoustiques, températures, vibrations et endurance de l'assemblage complet. |
| Ultrasons et autres modalités corporelles | NON VALIDÉS, non activés dans ce lecteur ; aucune puissance ni commande d'appareil augmentée. |
| Biorésonance, effets à distance, eau/aliments | Aucune efficacité physique, clinique ou sanitaire démontrée par ces essais logiciels. |
| Vente | BLOQUÉ pour une présentation comme appareil final qualifié : validation des prototypes et exigences de conformité applicables à traiter. Aucun devis matériel définitif obtenu. |

**Décision : conserver la version corrigée sur la branche d'audit et les résultats reproductibles. Ne pas considérer cette page sonore comme la livraison d'un kit matériel complet, ni commander les anciennes listes de composants comme un ensemble déjà qualifié.**

## Commandes reproductibles principales

À la racine du dépôt avec ses prérequis autorisés : `npm ci --ignore-scripts --no-audit --no-fund`, `tsc --noEmit`, `npm run lint -- --max-warnings=0`, `npm run build`, puis l'audit strict ci-dessus et les deux fichiers de `tests/security-regression`.

Dans `tests/aurora-regression` : installation avec le verrou dédié, `npm test`, les suites Node existantes et `node --test pure-tone-regression.mjs tone-route-regression.mjs`, puis `npm run typecheck`.

Les deux scripts de rendu local et leurs résultats sont joints à l'archive de preuves remise avec le compte rendu. Elle contient une sélection de sources et de tests, pas l'application entière ni un dossier de fabrication certifié.
