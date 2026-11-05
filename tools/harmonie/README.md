# Harmonie — conversion audio locale

Ce composant prépare le réaccordage de fichiers locaux pour MUKTI. Il ne capture
aucune application et ne se connecte à aucune plateforme de streaming.

## Utiliser

Prérequis : Python 3.10+, `ffmpeg` compilé avec `librubberband`, et `ffprobe`
accessibles dans `PATH`. Aucun paquet Python n'est nécessaire à la conversion.
Les exécutables FFmpeg/Rubber Band ne sont pas livrés avec ce code ; leurs
conditions de distribution doivent être traitées avant de les embarquer.

```sh
python tools/harmonie/retune.py morceau.wav morceau_432.flac
python tools/harmonie/retune.py video.mp4 video_432.mkv
python tools/harmonie/retune.py video.mp4 video_432.mp4
python tools/harmonie/retune.py deja_432.wav sortie.wav --source-hz 432
```

Le programme écrit un rapport JSON sur la sortie standard. Une erreur produit
un message `BLOQUÉ` sur stderr et un code de retour 2. La source reste inchangée.
La destination doit être un nouveau fichier dans un dossier existant. Aucun
écrasement n'est proposé. La publication atomique utilise un lien physique
depuis un fichier temporaire du même dossier ; un système de fichiers qui ne
le permet pas provoque un échec explicite, sans remplacer de fichier existant.

## Transformation

- Références source/cible : 440 et 432 Hz par défaut, réglables avec
  `--source-hz` et `--target-hz`. Valeurs finies positives ; rapport admis 0,5–2.
- Le rapport appliqué est `cible/source`, soit `432/440` par défaut ; tempo = 1.
- La référence d'origine est **supposée** : le programme ne l'infère pas.
  Un morceau déjà accordé à 432 doit être déclaré avec `--source-hz 432` ; le
  moteur de transposition est alors évité.
- Profil Rubber Band : `pitchq=quality`, `channels=together`,
  `transients=smooth`, `window=long`, `phase=laminar`, `formant=shifted`.
  `--formants preserved` est disponible mais n'a pas de validation perceptive.
- Limiteur de crêtes numériques à −1 dBFS avant encodage, sans gain automatique,
  avec compensation du délai du limiteur. Ce n'est ni un limiteur de niveau
  acoustique ni une garantie de crête vraie après encodage AAC.

Le profil initial `transients=crisp` a échoué au contrôle des sinus sur la
version FFmpeg testée (environ 432,90 Hz au lieu de 432 à 48 kHz). Le profil
`smooth` a corrigé cette mesure. Son éventuel effet sur les attaques et les
percussions reste à évaluer par écoute sur des musiques réelles.

## Pistes et formats

| Sortie | Audio | Vidéo |
| --- | --- | --- |
| WAV | PCM 24 bits | Omise |
| FLAC | FLAC 24 bits | Omise |
| MKV | FLAC 24 bits | Première vraie piste vidéo copiée sans réencodage |
| MP4 | AAC (compression avec pertes) | Première vraie piste vidéo copiée sans réencodage |

Cette version prend la **première piste audio mono/stéréo** et conserve son
échantillonnage et son nombre de canaux. Les autres pistes, sous-titres,
pièces jointes, métadonnées et chapitres sont omis. Le codec vidéo doit être
accepté par le conteneur choisi ; sinon FFmpeg échoue explicitement. MKV évite
une nouvelle compression AAC de la piste traitée.

`copyts` et `start_at_zero` conservent une origine temporelle commune aux pistes
sélectionnées. AAC peut ajouter des échantillons de préremplissage et de fin :
leur durée brute ne doit pas être confondue avec un changement de tempo ou un
décalage du contenu audible. L'alignement du contenu est vérifié séparément dans
les tests. Aucune promesse de synchronisation pour tous les fichiers n'est faite.

## Vérification reproductible

Les tests nécessitent NumPy et une version FFmpeg avec l'encodeur `libx264`
pour créer les images synthétiques. Lancer depuis la racine du dépôt :

```sh
python tools/harmonie/tests/test_retune.py --report tools/harmonie/tests/retune-report.json
```

Le rapport enregistré décrit **11 tests E2E réussis**, sans scénario ignoré,
sur Linux / Python 3.12 / FFmpeg 6.1.1. Ce sont des entrées synthétiques :

- Sinus stéréo 440/880 → environ 432,0000/863,9966 Hz à 48 kHz, en WAV et FLAC.
- Sinus mono 440 → environ 432,0000 Hz à 44,1 kHz.
- 240 000 échantillons conservés pour 5 s à 48 kHz ; rapport 1 sans différence
  d'échantillons pour la fixture de faible niveau déjà à 432 Hz.
- Vidéo : 150 images décodées identiques, paquets vidéo identiques, horodatages
  vidéo identiques, durée du conteneur identique en MKV et MP4 ; une seule piste
  audio retenue parmi les deux pistes sources.
- Sur trois impulsions enveloppées, écart des pics d'énergie inférieur à 3 ms
  et variation de cet écart inférieure à 0,2 ms entre la première et la dernière.
- Refus des URL, d'une playlist tentant un accès réseau, des références
  invalides et de l'écrasement ; noms contenant des caractères de shell traités
  littéralement ; absence de sortie publiée après un échec.

La fixture vidéo à audio décalé produit 5,0347 s d'audio brut décodé en AAC
contre 5 s en FLAC ; le conteneur vidéo reste à **6 s**. Le début de piste
rapporté dans les métadonnées MP4 passe de 0,250 à 0,228 s, soit **−22 ms**.
Cela inclut le préremplissage de l'encodeur : ce nombre ne décrit pas à lui seul
le début du contenu audible. Le test tient compte des deux blocs AAC de
préremplissage/complément possibles et contrôle séparément le moment des pics
d'énergie. Sur la fixture à impulsions, les écarts effectifs MP4 mesurés sont
0,35–1,54 ms, avec 0,104 ms de variation entre la première et la dernière.
Ces mesures portent seulement sur ces fixtures ; le nombre d'échantillons MP4
n'est pas garanti identique. Les résultats et l'environnement figurent dans
`tests/retune-report.json`.

**NON TESTÉ :** microphone ou sortie acoustique réels, iPhone, Android, macOS,
Windows, casques et Bluetooth, contenus protégés, streaming, multicanal,
transparence perceptive de toutes les musiques. Ce convertisseur n'est pas un
filtre audio système et ne prouve aucune intégration Spotify.

## Exemples d'écoute originaux

Deux exemples peuvent être générés sans contenu tiers, avec Python seul :

```sh
python tools/harmonie/generate_examples.py /chemin/vers/un/nouveau/dossier
python tools/harmonie/tests/test_examples.py /chemin/vers/un/nouveau/dossier
```

Le premier est une sinusoïde de 432 Hz pendant 12 secondes ; le second dure
24 secondes et ajoute une tonalité continue à une mélodie originale accordée
au la 432 Hz. Les niveaux numériques sont modérés et les débuts/fins sont
progressifs. Le rapport `tests/generation-report.json` vérifie les fichiers
PCM avec un estimateur indépendant ; il ne mesure aucun haut-parleur physique.
La vérification des exemples nécessite NumPy, leur génération n'en dépend pas.

## Documentation technique utilisée

- [FFmpeg — rubberband](https://ffmpeg.org/ffmpeg-filters.html#rubberband)
- [FFmpeg — alimiter](https://ffmpeg.org/ffmpeg-filters.html#alimiter)
- Les options ont aussi été contrôlées sur l'exécutable avec
  `ffmpeg -hide_banner -h filter=rubberband` et `-h filter=alimiter`.
