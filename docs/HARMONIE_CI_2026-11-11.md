# Harmonie — raccordement des vérifications logicielles à la CI

Date : 11 novembre 2026. Proposition préparée sur la tête de MUKTI #6
`ad3cde4ce17d0e7aabaad1fff80481c043f8cc92`, arbre
`d1110479115a5dd301cf09096fb185de41e4e197`.

## Défaut de couverture confirmé

La tête de #6 n'a aucun workflow-run ni check-run associé lors de la lecture GitHub
du 11 novembre à 16 h 26, heure de Paris. Les deux workflows de PR existants
filtrent les chemins, sans restriction de branche cible. Aucun des 24 chemins
de #6 ne correspond à ces filtres. Le workflow de livraison mobile s'applique
aux push de `main` ou à une invocation manuelle ; il ne qualifie pas cette PR.

Le nouveau workflow `Harmonie software verification` surveille les sources,
outils et tests Harmonie ainsi que son propre YAML et son exécuteur. Les PR
empilées sont couvertes sans modifier les workflows existants. Aucune commande
npm, référence à un secret, signature mobile ou étape de déploiement n'est ajoutée.

## Vérifications réutilisées

L'exécuteur appelle les scripts existants et exige des rapports neufs, sans
échec ni omission. Il contrôle les capacités FFmpeg/Rubber Band/libx264 et
les empreintes du fournisseur avant les tests ; les sources sont comparées
avant et après. Une erreur de commande, un dépassement de délai ou un rapport
incomplet fait échouer le contrôle.

| Groupe | Résultat local | Portée |
| --- | --- | --- |
| Cycle de vie | 6/6 PASS | Doubles explicites de Web Audio |
| DSP | 8/8 PASS | Véritable WASM embarqué ; analyse indépendante NumPy/SciPy |
| Conversion | 11/11 PASS | FFmpeg/Rubber Band ; médias synthétiques |
| Exemples | 2/2 PASS | Fichiers PCM générés et mesurés |

Exécution locale du 11 novembre **16:31:47 à 16:32:03, heure de Paris**, sortie 0.
Node **24.22.1**, Python **3.12.14**, NumPy **2.3.5**, SciPy **1.17.0**,
FFmpeg/ffprobe **7.1.5** sur Linux. Les onze commandes consignées ont une sortie 0.
Les 20 fichiers Harmonie extraits sont identiques aux blobs de #6 et restent
inchangés après l'exécution. Les rapports historiques du dépôt sont conservés.

Sept contre-épreuves de rapports incomplets ou trompeurs ont été rejetées :
cycle de vie vide, cas ignoré, DSP vide déclaré réussi, résultat DSP dupliqué,
conversion déclarée réussie avec skip, conversion vide, exemple manquant.
Le réemploi d'un dossier de preuve existant est également refusé, avec sortie 1.
Ces vérifications du banc ne sont pas ajoutées au nombre de tests produit.

Commande reproductible depuis la racine, avec un chemin extérieur qui n'existe
pas encore :

```sh
python scripts/ci/verify-harmonie.py --output /tmp/harmonie-software-nouvelle-preuve
```

Le dossier contient `summary.json`, les commandes, leurs sorties et durées,
les rapports détaillés et les empreintes avant/après. La CI conserve les rapports
et journaux en artefact pendant sept jours ; les grands fichiers PCM temporaires
ne sont pas inclus dans cet artefact.

## Portée et intégrité de la proposition

- **PASS local :** suites ci-dessus, vérification des rapports, YAML parsé et
  assertions structurelles sur les déclencheurs, permissions et actions épinglées.
- **NON TESTÉ à cette étape :** exécution GitHub de ce nouveau workflow et
  installation de ses dépendances sur Ubuntu 24.04. Le résultat local n'est
  pas attribué à une CI qui n'a pas encore tourné.
- **NON TESTÉ par ce workflow :** navigateur réel et ordonnancement AudioWorklet,
  sortie acoustique, appareils/Bluetooth, iOS/Android, application de production,
  fournisseurs, signature et livraison. La sonde Chrome décrite dans la PR #6
  est une preuve distincte ; son script ne figure pas parmi les sources Harmonie
  de ce commit et n'est pas remplacé par les doubles Web Audio.
- Aucun audit de vulnérabilités n'est exécuté ou supprimé. Les étapes npm
  existantes restent inchangées.
- Node 24.22.1 correspond à la version locale exécutée. Les bibliothèques
  scientifiques sont épinglées ; la CI consignera ses versions FFmpeg/Python
  effectives et les archives Python résolues.
- Le checkout ne conserve pas les credentials Git. Permissions du workflow :
  `contents: read`.

Empreintes SHA-256 du code vérifié :

- `scripts/ci/verify-harmonie.py` :
  `517bcb6937687bf4b97c367a370b56808bb0b7ac19cf20bae572dd44177ff612`.
- `.github/workflows/harmonie-verification.yml` :
  `a727caf5a84407c4491d72cb18a8b95a12767392172e192df65fd3de3712b621`.

Les changements proposés se limitent à ces deux nouveaux fichiers et à cette
note. Le produit, les dépendances produit, les trois workflows existants,
`vercel.json`, les licences et les preuves historiques ne sont pas modifiés.

## Ajout du 11 novembre — qualification d'un approvisionnement CI versionné

Les empreintes indiquées avant cet ajout désignent la proposition initiale ;
elles sont conservées comme preuve historique et ne désignent pas le workflow
corrigé décrit dans cette section.

Les trois premières exécutions GitHub du raccordement ont conservé leurs
résultats : [43050012078](https://github.com/puramapro-oss/mukti/actions/runs/43050012078)
annulée, puis [43052436115](https://github.com/puramapro-oss/mukti/actions/runs/43052436115)
et [43053126424](https://github.com/puramapro-oss/mukti/actions/runs/43053126424)
en échec APT. Le miroir Azure et les deux archives Ubuntu officielles échouent
en résolution DNS. Aucun des 27 contrôles logiciels n'a été exécuté dans ces
trois runs ; leurs étapes de tests sont ignorées. Le troisième run confirme
la disparition de l'avertissement d'accès de `_apt` après le déplacement du
répertoire temporaire sous `/tmp`.

La proposition suivante remplace uniquement l'approvisionnement FFmpeg du
nouveau workflow. Les tests, l'exécuteur et les versions NumPy/SciPy restent
identiques. Le distributeur [FFmpeg-Builds](https://github.com/FFmpeg-Builds/FFmpeg-Builds)
figure sur la [page de téléchargement FFmpeg](https://ffmpeg.org/download.html) ;
ce binaire est publié par ce distributeur, pas compilé ou publié par le projet
FFmpeg lui-même.

| Élément épinglé | Valeur |
| --- | --- |
| Tag | `autobuild-2026-10-31-12-59` |
| Asset GitHub | `695398022` |
| Archive | `ffmpeg-n8.1.3-27-g8dca1586f4-linux64-gpl-8.1.tar.xz` |
| Taille | `152246308` octets |
| SHA-256 | `41e9c565594c390622cf968d82fa4135d9e9a11d06c1515644288cbc844e3380` |
| Recette | `5031c6f1082414e53688d39e521849905071070d` |
| Source FFmpeg | `8dca1586f468bfcbb78ae3ed618af1361d9f140a` |
| Job producteur | `124536872170`, succès selon ses métadonnées |

Le SHA-256 est concordant entre les
[métadonnées de l'asset](https://api.github.com/repos/FFmpeg-Builds/FFmpeg-Builds/releases/assets/695398022)
et le [manifest du distributeur](https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-10-31-12-59/checksums.sha256).
La [recette GPL](https://github.com/FFmpeg-Builds/FFmpeg-Builds/blob/5031c6f1082414e53688d39e521849905071070d/variants/defaults-gpl.sh)
et ses dépendances activent ffprobe, Rubber Band et libx264. Cela établit les
capacités attendues ; leur présence réelle et leur comportement doivent être
qualifiés par le contrôle logiciel existant.

Le téléchargement utilise exclusivement HTTPS avec validation TLS normale,
une reprise au maximum et une borne globale de 240 secondes. La taille et le
SHA-256 sont vérifiés avant toute extraction ou exécution. Seuls trois fichiers
réguliers sont extraits depuis la racine exacte attendue : `bin/ffmpeg`,
`bin/ffprobe` et `LICENSE.txt`. Les liens, doublons, fichiers manquants et tailles
excessives pour ces entrées provoquent un échec. Les autres entrées ne sont
pas extraites. Le chemin du dossier temporaire est ajouté au PATH du job ;
aucun `sudo`, changement DNS ou installation système n'est effectué.

L'artefact CI conserve `harmonie-ffmpeg-provenance.json`, les empreintes des
fichiers extraits et la licence GPLv3 fournie. Les versions et capacités
effectives de ffmpeg/ffprobe sont consignées dans les journaux du contrôle
Harmonie. Les binaires et l'archive ne sont pas joints à l'artefact, ajoutés au
dépôt ou livrés dans le produit.

Aucune attestation cryptographique de build n'a été vérifiée, et aucune
recompilation reproductible n'est revendiquée. L'intégrité repose ici sur
l'archive exacte dont le digest est épinglé après revue des sources publiques.
La licence MIT du dépôt d'automatisation ne remplace pas la licence GPLv3
du binaire sélectionné.

**Maintenance : réexaminer et renouveler ce pin avant le 30 septembre 2028.**
La [politique du distributeur](https://github.com/FFmpeg-Builds/FFmpeg-Builds/blob/5031c6f1082414e53688d39e521849905071070d/util/prunetags.sh)
conserve 24 versions mensuelles ; le tag retenu n'est pas une garantie
d'archivage permanent. Toute disparition ou divergence doit faire échouer
la qualification. Aucun alias `latest`, remplacement automatique ou miroir
alternatif n'est prévu. Le renouvellement doit reprendre la revue de provenance,
licence, taille et digest, puis exécuter les quatre suites avant acceptation.

**NON TESTÉ au stade de cette proposition :** téléchargement de cette archive,
inspection de ses octets et exécution de ce binaire sur le runner. Les preuves
locales antérieures et les trois échecs hébergés restent distincts. Chrome,
appareils physiques, mobile et production restent hors de cette qualification.
