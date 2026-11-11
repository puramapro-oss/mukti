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
