# MUKTI — mesure acoustique locale autour de 432 Hz

Date : 25 octobre 2026.

Base de travail : `puramapro-oss/mukti`, commit `b396c760597d86452560443eca0c25da502ac1fe`, issu de `audit/mukti-hardware-compat-20261023`. Le travail est isolé dans `codex/mukti-432hz-measurement-20261025` ; il ne fusionne ni ne déploie l’application.

## Problème traité

MUKTI possède déjà des générateurs audio à 432 Hz, notamment `useSound432` et `ContinuousSoundMode`. AURORA possède aussi des couches audio ; leur mélange n’est pas un étalon sinusoïdal. Un paramètre fixé à 432 ne prouve pas que le son physique capté vaut 432 Hz. Cette modification ajoute une mesure locale indépendante du paramètre demandé, sans créer de nouveau générateur concurrent.

Parcours : l’utilisateur ouvre les paramètres, confirme avoir arrêté les sons de l’appareil de mesure, démarre volontairement le microphone, observe une estimation issue des échantillons, puis arrête la capture. Le microphone n’est relié ni à la sortie audio ni au réseau de cercles.

## Fichiers et intégration

| Fichier | Responsabilité |
|---|---|
| `src/lib/audio/frequency-analysis.ts` | Analyse numérique sans dépendance externe ; classification d’un signal. |
| `src/lib/audio/local-frequency-meter.ts` | Autorisation, capture locale, interruptions et libération des ressources. |
| `src/components/audio/FrequencyMeter.tsx` | Carte accessible avec démarrage volontaire, état exact et arrêt. |
| `src/app/(dashboard)/dashboard/settings/page.tsx` | Ajout de la carte aux paramètres existants. |
| `tests/frequency-measurement/` | Banc ciblé autonome : signaux synthétiques, cycle de vie, compilation et parcours navigateur. |

Les générateurs, le transport WebRTC, les sauvegardes et les correctifs AURORA de la base restent inchangés. L’accès à la page conserve son contrôle existant par profil connecté.

## Ce que la mesure signifie

Une sinusoïde sonore à 432 Hz est un signal physique possible ; les API Web Audio permettent sa synthèse et l’analyse d’échantillons. La capture du microphone est une opération distincte, soumise aux permissions et aux capacités de l’entrée. [S1, S2]

L’écran affiche une **composante acoustique dominante estimée**. Il ne certifie ni une fréquence fondamentale dans un mélange musical, ni une pureté absolue, ni la provenance du son. Un morceau accordé avec un la à 432 Hz contient plusieurs fréquences et ne constitue pas une sinusoïde à 432 Hz.

La proximité de la cible est une règle logicielle de ±2 Hz. Ce n’est pas une précision métrologique garantie. L’affichage d’un dixième de hertz ne vaut pas étalonnage. « Stable » signifie trois estimations successives proches de la cible, variant entre elles d’au plus 1 Hz ; les fenêtres temporelles peuvent se recouvrir.

Le microphone ne mesure pas directement un champ radio, une sortie électrique de générateur, une purification, une « énergie positive » ou un effet de soin. Les essais exploratoires de musique accordée à 432 Hz ne valident pas ces extrapolations. [S3]

## Analyse numérique

- Fenêtre de Hann, FFT radix 2 et interpolation locale du pic spectral ; pas de valeur cible injectée dans les résultats.
- Recherche dominante entre 40 Hz et la plus petite valeur parmi 6 000 Hz et 47,5 % du taux d’échantillonnage. L’énergie du reste du spectre positif contribue au contrôle d’ambiguïté.
- Au moins 0,5 seconde d’observation et espacement de bins de 2 Hz au plus. Le lecteur utilise 32 768 échantillons et le taux **réel** de l’AudioContext ; il préfère 48 kHz mais contrôle le format effectivement obtenu.
- Refus d’une estimation affirmative pour silence numérique, valeurs invalides, résolution insuffisante, crêtes proches de la pleine échelle, composante continue excessive ou spectre trop ambigu.
- Les mélanges 432/440 Hz, les harmoniques testées et le bruit synthétique ne sont pas présentés comme un 432 Hz pur. Des composantes très faibles ou trop proches peuvent rester indiscernables : ce banc ne caractérise pas tous les signaux possibles.
- Les seuils en dBFS sont des seuils numériques, pas des niveaux sonores en dB SPL.

## Capture, interruptions et confidentialité

Le microphone reste éteint au montage de la carte. La case de préparation ne déclenche pas non plus la capture ; seul le bouton de démarrage le fait. La mesure requiert un contexte sécurisé et un navigateur exposant les API nécessaires.

Le contrôleur demande la désactivation de l’annulation d’écho, de la suppression de bruit et du gain automatique lorsqu’elles sont exposées. Il affiche ensuite les réglages déclarés par la piste : désactivés, au moins un actif, ou inconnus. Une préférence demandée ne vaut pas confirmation matérielle. [S2]

Ces déclarations sont relues à chaque échantillonnage. Si l’un des trois réglages change, la série servant à qualifier la stabilité recommence. Les modes d’annulation d’écho `all` et `remote-only` sont reconnus comme actifs ; leur changement réinitialise aussi la série. Une méthode `getSettings` absente, une lecture en échec ou des valeurs manquantes ne conservent jamais une ancienne déclaration « désactivé ». Cela détecte les changements rapportés aux instants de lecture, sans mesurer physiquement le traitement appliqué.

Le graphe est `microphone → analyseur`. Aucun nœud n’est connecté à `destination`. Ces nouveaux modules n’enregistrent pas le son, n’ouvrent pas de connexion réseau et ne l’envoient pas à AudioMesh/Supabase. Cela ne constitue pas un audit de toute l’application ou du navigateur.

Arrêt et effacement de l’estimation lors de l’action utilisateur, du démontage, d’une page masquée, de `pagehide`, d’une interruption de piste ou du contexte audio. Une session est limitée à 60 secondes. La demande d’autorisation expire côté lecteur au bout de 15 secondes ; si le navigateur fournit ensuite une piste tardive, elle est arrêtée. Il n’y a pas de reprise automatique.

Un numéro de génération empêche les réponses d’une ancienne demande d’agir sur la suivante. Les ressources et minuteurs sont libérés même après un échec intermédiaire.

## Vérifications exécutées

| Vérification | Résultat et portée |
|---|---|
| Analyse + cycle de vie | **41 tests Node réussis**, zéro échec, zéro test ignoré. Signaux indépendants produits par formule, taux 44,1/48 kHz, 432/440 Hz, mélanges, harmoniques, bruit, silence, saturation, données invalides et scénarios de permission/interruption/concurrence. Les cinq nouvelles régressions de réglages du microphone échouaient avant le correctif et réussissent après. |
| TypeScript | **Réussi** : contrôle strict ciblé des modules audio et du composant, puis contrôle de l’application entière, dont la passe TypeScript du build final. |
| Relecture indépendante | Revue initiale des trois modules, puis revue du correctif de lecture des réglages et des cinq nouveaux tests : aucune régression identifiée dans ce périmètre. |
| Parcours navigateur | **2 scénarios réussis**, Chromium `153.0.8010.0`, code de sortie 0 : entrée WAV 432 Hz → affichage `432.0 Hz` stable en 1280×900 ; entrée WAV 440 Hz → `440.0 Hz` hors cible en 390×844. Dans chaque cas : zéro capture au montage, case requise, un appel natif à `getUserMedia`, une piste libérée à l’arrêt, résultat effacé et zéro erreur console/page. |
| Téléphones et microphones physiques | **Non testés** dans cette intervention. |
| Synchronisation entre appareils et générateurs | **Non implémentée par ce changement** ; aucune compatibilité matérielle nouvelle revendiquée. |
| Régressions AURORA et lecteur de nuit | **103 tests Vitest réussis** dans 8 fichiers : 95 cas existants et 8 nouveaux cas de volume, rotation, arrêt, redémarrage et StrictMode. Les services et sorties audio sont remplacés dans ce banc. |
| Régressions Node AURORA | **73 tests réussis**, zéro échec et zéro cas ignoré, explicitement dénombrés dans les deux bancs CommonJS. |
| Lint global | **632 fichiers analysés, zéro erreur et zéro avertissement**, avec la configuration partagée authentique et `--max-warnings 0`. |
| Application complète | **Installation, types et build final réussis** dans l’environnement préparé décrit ci-dessous. Aucun parcours avec compte, base ou service de production n’est attesté par ces contrôles. |

Les trois suites comptent **217 tests automatisés réussis** (41 + 103 + 73), auxquels s’ajoutent les deux parcours Chromium. Les essais historiques de l’audit du 23 octobre ne sont pas comptés parmi les tests exécutés ici.

### Reproduire les contrôles ciblés

Depuis un clone contenant cette branche, avec Node 24 :

```sh
cd tests/frequency-measurement
npm ci --ignore-scripts
npm test
npm run typecheck
```

Le banc navigateur génère ses propres WAV dans un répertoire temporaire et utilise le périphérique audio simulé de Chromium, avec `getUserMedia`, Web Audio et le composant React réels. L’autorisation est simulée par Playwright et `--use-fake-ui-for-media-stream` ; la boîte de permission manuelle n’est pas testée. Le scénario mobile change le viewport et les paramètres de contexte Chromium, sans tester un téléphone ou un OS mobile réel. Les styles globaux et l’application Next complète ne sont pas exécutés.

Playwright est un prérequis séparé du banc navigateur : l’installer dans l’environnement de test, installer son Chromium puis exécuter `node browser-smoke.mjs`. Le script peut également employer un exécutable existant avec `CHROMIUM_EXECUTABLE_PATH` ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et résoudre Playwright via `NODE_PATH`. Son en-tête décrit ces options. Aucun composant de test n’est ajouté aux dépendances de production.

Le test sert l’interface par interception de requêtes sur une origine HTTPS de test ; les requêtes externes sont bloquées. Le rapporteur ne remplace pas les pistes, l’AudioContext ou les résultats de l’analyse. Ce banc ne dépend pas de la base de données ni de l’authentification MUKTI et n’atteste donc pas le parcours complet de connexion à Next.

L’environnement utilisé a exécuté Node `24.22.1`, Playwright `1.62.1` et un Chromium `153.0.8010.0` fourni séparément. Le téléchargement du navigateur associé au runtime était tronqué ; le navigateur de remplacement a ensuite permis les deux parcours. L’exécution a nécessité une autorisation automatique pour les communications internes du navigateur hors du bac à sable. Ces détails décrivent le banc, pas une exigence du produit.

### Isolation des dépendances du banc navigateur

La première relance après installation de l’application entière a révélé deux instances React dans le même bundle : l’une venait de l’application, l’autre du banc. Le composant plantait avant tout appel au microphone. Le banc résout désormais tous les imports de React et ReactDOM, y compris leurs sous-chemins JSX, depuis sa propre installation, puis vérifie le graphe esbuild : exactement une instance de chaque paquet.

Les deux parcours Chromium ont réussi après cette correction, avec les dépendances racine présentes. Le mode `node browser-smoke.mjs --bundle-only` a également réussi dans une fixture sans dépendances racine, en utilisant seulement celles du banc. Ce second contrôle vérifie la résolution et le bundle ; il ne lance pas de navigateur.

## Reprise des vérifications dans l’application entière

La reprise utilise un clone complet du commit `cf3d0518a729df5f8dd88e66a3bae1ae9d0e8828`, dans un espace isolé. Le checkout principal et les terminaux du Mac ne sont pas modifiés.

Les deux entrées qui bloquaient l’installation ont été retrouvées dans leurs sources autorisées :

- `@purama/smarana` : sources du commit **`6b97a377fd17022286e88ab8e09be1e9bceb4ada`**, exactement celui du lockfile. Les blobs récupérés ont été vérifiés, puis le paquet a été préparé localement sans script d’installation. Seul le transport de cette dépendance a été remplacé temporairement pour l’installation ; les deux manifests racine ont ensuite été restaurés exactement au HEAD initial.
- `@purama/eslint-config` : les deux fichiers authentiques du package partagé du workspace PURAMA ont été lus sur le Mac et recopiés à l’emplacement relatif attendu. Aucune configuration fictive n’a été substituée et les sources privées ne sont pas ajoutées à ce dépôt.

L’installation racine a réussi (`npm ci --ignore-scripts --no-audit --no-fund`, 848 paquets), ainsi que celle du banc AURORA verrouillé. Le premier typecheck complet avait révélé que les dépendances propres à ce banc n’étaient pas encore installées ; elles ont été ajoutées, puis le contrôle a été rejoué. Le premier build ne pouvait pas télécharger les polices Google dans l’environnement réseau restreint ; une exécution autorisée avec accès réseau a compilé l’application, vérifié les types et généré les routes, sans déploiement. L’environnement est Node `24.22.1` et Next.js `16.2.11`.

Le lint authentique a ensuite révélé des écarts préexistants. Les corrections déjà disponibles sur le Mac pour le lecteur de nuit, les références de phase de séance et les blocs de libération MediaPipe ont été reprises dans le clone isolé. Le lecteur de nuit garde son ordre de rotation, mais exécute la parole dans le minuteur et affiche un compteur d’état React ; sa boucle de volume appartient à l’effet qui l’annule. Les imports et types inutilisés ont été retirés en conservant les réexports publics.

Les deux bancs `.cjs` utilisent volontairement une VM CommonJS pour charger le code TypeScript. Le lint les reconnaît désormais sur leurs deux chemins exacts : la règle d’import reste au niveau `error`, avec une liste ancrée des seuls modules Node et du compilateur TypeScript nécessaires. Aucun fichier n’est ignoré. La fixture audio utilise un objet d’état plutôt qu’un alias de `this` ; les assertions restent identiques. Les 73 cas Node de ces deux bancs ont été explicitement dénombrés et réussissent avec `--test-isolation=none`.

Cette préparation locale ne publie pas les dépendances privées et ne résout pas leur authentification dans un runner distant. Le nouveau workflow `mukti-frequency-check.yml` vérifie indépendamment les tests Node et le typecheck strict de la mesure, sans installation racine ni secret. Il ne remplace pas la qualification complète de l’application.

### Commandes de la passe finale

Après préparation des dépendances, depuis la racine du dépôt :

```sh
npm run test:aurora
node --test --test-isolation=none --test-reporter=spec tests/aurora-regression/runtime-regression.cjs tests/aurora-regression/completion-wiring.cjs
./node_modules/.bin/eslint . --max-warnings 0
./node_modules/.bin/tsc --noEmit --pretty false
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Les tests et le typecheck de `tests/frequency-measurement` ont aussi été rejoués. Le build final a rencontré une erreur `ENOTEMPTY` lors du nettoyage d’une ancienne sortie ; ce dossier généré a été déplacé intact hors du dépôt, puis le build a réussi dans une sortie neuve. Aucun contrôle n’a été désactivé pour obtenir ce résultat. Le warning Next concernant la convention historique `middleware` reste un avertissement de migration, sans échec du build.

## Contrat pour les générateurs externes — spécifié, pas raccordé

Recevoir un son de 432 Hz ne crée pas un lien de commande avec sa source. Un pilote doit être construit à partir du **modèle exact, du firmware et de son protocole documenté**. Des fabricants documentent des commandes et interfaces propres à leurs appareils ; cela n’établit pas la compatibilité de tout générateur avec un téléphone. [S4]

Pour chaque modèle qualifié, conserver séparément :

| Valeur | Origine | Ce qu’elle permet d’affirmer |
|---|---|---|
| Consigne, par exemple 432 Hz | Demande utilisateur validée par le pilote | Fréquence demandée. |
| Retour du générateur | Lecture du paramètre via son protocole | Réglage déclaré par l’appareil identifié. |
| Mesure indépendante | Microphone pour le son ; instrument adapté pour une sortie électrique | Signal observé, dans les limites et l’incertitude du capteur. |

Séquence prévue : sélection et identification explicites, lecture des capacités, validation des unités et limites, préparation de la consigne, application autorisée, relecture, puis vérification indépendante lorsque requise. Les commandes comportent un identifiant et une échéance ; les réponses tardives et les doubles demandes ne doivent pas relancer une sortie. La perte de liaison conserve un état inconnu ou interrompu, jamais « réglage vérifié ».

Une fréquence, une amplitude, une puissance, un niveau acoustique et une charge électrique sont des paramètres distincts. « Maximum » ne peut pas remplacer leurs unités et limites. Aucune hausse automatique de volume ou de puissance ne fait partie de cette modification. L’exposition sonore dépend notamment du niveau et de la durée. [S5]

L’appareil de mesure doit rester silencieux pendant la vérification d’une source externe, faute de quoi il peut mesurer son propre haut-parleur. Même ainsi, un microphone seul ne prouve pas l’identité de la source. Une qualification doit utiliser une source connue et un montage de mesure décrit.

## Conditions avant une livraison complète

1. Conserver ces contrôles sur la version retenue pour livraison et qualifier les services, les comptes et la configuration de déploiement dans leur environnement autorisé. Les gates locales ci-dessus ne remplacent pas une recette de production.
2. Tester le parcours sur iPhone/Safari, Android/Chrome et ordinateur nommés, avec microphones physiques, sorties externes connues, interruptions et permissions réelles.
3. Mesurer l’erreur face à une référence instrumentée et documenter bruit, distorsion, traitement automatique, taux réel, charge CPU et comportement en arrière-plan.
4. Fournir le modèle et la documentation du premier générateur à raccorder ; qualifier son pilote séparément avant d’activer une commande de sortie.

## Sources primaires consultées

- **S1 — W3C, Web Audio API 1.1**, version de travail du 22 septembre 2026 : https://www.w3.org/TR/webaudio-1.1/ — synthèse, analyseur et domaine temporel.
- **S2 — W3C, Media Capture and Streams**, version candidate du 9 octobre 2025 : https://www.w3.org/TR/mediacapture-streams/ — permissions, contraintes et réglages effectivement rapportés.
- **S3 — Calamassi et Pomponi**, étude pilote de musique accordée à 432/440 Hz : https://pubmed.ncbi.nlm.nih.gov/31031095/ — un corrigendum est signalé ; aucune taille d’effet n’est utilisée dans ce document.
- **S4 — Keysight, documentation des commandes du système de génération** : https://helpfiles.keysight.com/csg/n7625b/Content/Main/ET_Control.htm — modèles, réglages et interfaces documentés ; pas un pilote universel ni un raccordement réalisé ici.
- **S5 — OMS, écoute sans risque** : https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening
