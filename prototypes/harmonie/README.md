# MUKTI · Harmonie — prototype audio local

État du 6 novembre 2026 : **PARTIEL**. Le code du lecteur est écrit ; le moteur de traitement numérique a été exécuté et mesuré. **L’intégration dans un navigateur réel et les appareils physiques restent NON TESTÉS.** Le prototype ne doit pas être présenté comme un filtre universel déjà disponible.

Il complète les fonctions audio existantes de MUKTI (`useSound432`, modes sonores, mesure) et reste isolé dans `prototypes/harmonie`. Il ne remplace aucun générateur de production, ne modifie aucune route MUKTI et ne déploie rien.

## Fonctions écrites

- **Ma musique** : import d’un fichier audio local mono/stéréo, maximum 25 Mo et 5 minutes ; accordage déclaré 440 Hz → 432 Hz par défaut ; tempo × 1 ; lecture/pause/reprise/arrêt ; volume progressif. La référence de départ est saisie par l’utilisateur, pas détectée.
- **Fréquence seule** : sinusoïde via `OscillatorNode`, 432 Hz par défaut, réglable de 100 à 2 000 Hz ; arrêt après 1, 3, 5 ou 10 minutes.
- **Mélodie** : composition de démonstration originale de huit notes, synthétisée au la 432 Hz, 72 battements/minute, avec minuterie.
- **Tonalité continue en plus** : option distincte, désactivée par défaut, ajoutant une sinusoïde de 432 Hz à la mélodie ou au fichier local. Niveau relatif indépendant. Une mélodie accordée au la 432 Hz ne contient pas nécessairement une composante continue de 432 Hz.
- **Comparaison à la hauteur d’origine** et **source déjà à 432 Hz** : dérivation directe du traitement de hauteur, sans double conversion.
- **Arrêt explicite** à la fermeture ou au passage en arrière-plan ; arrêt lors d’une interruption audio externe ; écoute de `devicechange` lorsqu’il est fourni par le navigateur. Ce dernier événement ne garantit pas la détection de toutes les déconnexions Bluetooth ou filaires.

Les paramètres des oscillateurs décrivent le signal numérique demandé. Ils ne constituent pas une mesure de la fréquence acoustique réelle ni du niveau en dB SPL. Aucun microphone n’est activé. Aucune revendication médicale ou énergétique n’est attachée à ces réglages.

## Démarrer localement sur ordinateur

Depuis la racine du dépôt :

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory prototypes/harmonie
```

Ouvrir `http://localhost:8765`, puis toucher **Écouter**. AudioWorklet exige un contexte sécurisé : HTTPS ou localhost. L’ouverture directe du fichier HTML n’est pas une méthode de lancement prise en charge pour le réaccordage.

Sur téléphone ou tablette, le site doit être servi sur une origine HTTPS accessible à l’appareil. Le `localhost` de l’ordinateur n’est pas celui du téléphone. Cette étape et les essais iOS/Android restent à réaliser. Aucun hébergement ni service payant n’est nécessaire pour les tests locaux sur ordinateur.

Choisir le casque ou l’enceinte dans les réglages de l’appareil. Le navigateur utilise la route audio système ; il ne pilote ni l’appairage Bluetooth ni le micrologiciel des accessoires. Les codecs de fichiers acceptés dépendent du navigateur.

## Architecture et précision

Le facteur nominal vaut `432 / 440 = 0,9818181818181818`, soit `−31,7666536334 cents`.

La chaîne musicale actuelle est :

`AudioBufferSourceNode (rate = 1) → Signalsmith Stretch (entrée continue) → GainNode → sortie système`.

Le moteur Signalsmith Stretch Web 1.3.2 est embarqué localement avec son WASM et sa licence MIT ; aucun CDN, appel API ou téléversement audio n’est utilisé à l’exécution. Le code conserve les octets exacts de la version amont, vérifiés par empreinte Git et SHA-256 dans `vendor/provenance.json`.

Réglages : bloc de 320 ms, intervalle de 80 ms, transposition `12 * log2(cible/source)`, `tonalityHz: 0`, compensation des formants désactivée. Le choix de `tonalityHz: 0` garde le rapport de transposition nominal sur tout le spectre. Préserver séparément les formants serait un autre traitement, à évaluer avant intégration.

**Retard numérique du traitement : 320 ms dans les essais à 48 kHz**, auquel s’ajoute la latence du système et du casque/enceinte. La position affichée et la fin de lecture prennent ce retard en compte. Une source constante de valeur zéro maintient l’entrée du worklet active pendant la fin du signal, afin que le moteur ne change pas de mode et ne coupe pas les dernières centaines de millisecondes.

Ce lecteur traite seulement l’audio ; il ne fournit aucune synchronisation vidéo. Pour les vidéos locales, utiliser le convertisseur hors ligne séparé et ses contrôles de durée. Le réaccordage d’un mixage peut modifier légèrement les transitoires et le timbre ; il ne permet pas de promettre des échantillons identiques à l’original.

### Défaut trouvé et corrigé dans le choix d’intégration

Le premier essai utilisait les buffers internes de Signalsmith avec le réglage 120 ms. La mesure indépendante donnait **432,507868 Hz** pour un sinus de 440 Hz ; le mode était donc rejeté. Le test est conservé dans le rapport comme **FAIL**, distinct des validations de la version retenue.

L’entrée continue et le réglage 320 ms donnent **432,044929 Hz** sur ce même signal. Aucune correction empirique du rapport 432/440 n’est appliquée. Le traitement musical demeure approximatif ; une tonalité pure à 432 Hz utilise directement un oscillateur et ne passe pas par ce moteur.

## Vérifications effectuées

### PASS — moteur numérique réel, huit scénarios

Le fichier WASM réellement embarqué a été exécuté sous Node dans un hôte AudioWorklet minimal. Le résultat PCM a été analysé séparément avec NumPy/SciPy. Cette méthode valide les calculs du moteur ; elle ne valide pas Safari, Chromium, l’ordonnancement réel d’un navigateur ou la sortie physique.

Critères retenus pour le traitement **musical** : erreur inférieure à un cent sur les sinusoïdes testées et inférieure à 0,1 Hz autour de 432 Hz. Les chiffres ne signifient pas une garantie sur toute musique ou tout appareil.

| Scénario | Mesure numérique |
|---|---:|
| 440 → 432 | 432,044929 Hz |
| 880 → 864 | 864,455262 Hz |
| 12 000 → 11 781,818182 | 11 782,224617 Hz |
| Stéréo gauche 440 / droite 660 | 432,045400 / 648,210857 Hz |
| Rapport 1, source 432 | 432,000001 Hz |
| Silence | Tous les échantillons à zéro |
| Impulsions espacées de 0,5 s | Erreur d’intervalle maximale 0,604 ms |
| Arrêt du moteur, vidage de sa queue | Silence après la fenêtre de vidage testée de 0,74 s |

La dernière ligne concerne la queue brute du moteur numérique. L’application réduit séparément le gain puis ferme son contexte à l’arrêt ; ce comportement reste à vérifier dans un navigateur réel.

Pour reproduire :

```bash
node prototypes/harmonie/tests/render-dsp-cases.cjs /tmp/mukti-harmonie-dsp
python3 prototypes/harmonie/tests/verify-dsp.py /tmp/mukti-harmonie-dsp
```

Le second script demande NumPy et SciPy. Le rapport enregistré est `tests/verification.json`. Les grands fichiers PCM sont temporaires et ne sont pas livrés dans le dépôt.

### PASS — six scénarios de cycle de vie simulés

```bash
node --test prototypes/harmonie/tests/lifecycle.test.mjs
```

Les tests couvrent les entrées invalides, pause/volume/reprise, arrêt lors d’une interruption système, annulation d’un démarrage en cours, retard du planificateur de mélodie sans empilement des notes et programmation séparée de la tonalité continue. Ils emploient des doubles explicites de Web Audio et **ne sont pas des essais d’écoute dans un navigateur**.

### NON TESTÉ — navigateur, écoute et matériel

Le paquet Playwright était disponible, mais aucun binaire de navigateur ne l’était. **Aucun résultat de test dans un navigateur n’est revendiqué.** La recette à exécuter dans un environnement équipé est : démarrer une tonalité, mettre en pause et reprendre, arrêter, charger le signal stéréo 440/660, vérifier le son et la dernière demi-seconde, contrôler la fréquence dans une capture numérique, répéter la lecture puis fermer/changer la page. Vérifier aussi une largeur d’écran de 390 px, les erreurs affichées, l’import d’un fichier invalide et les clics rapides pendant le chargement.

Restent également à vérifier : écoute comparative avec musique réelle, Safari/iPhone/iPad, Android, navigateurs de bureau, passage entre routes de sortie, Bluetooth/filaire, interruptions/appels, précision acoustique avec instrument externe et consommation électrique. Aucun de ces résultats n’est revendiqué.

## Exclusions de cette version

Le prototype n’intercepte pas Spotify, Apple Music, YouTube, Netflix, les appels ni les autres applications. Il ne traite pas les flux protégés et n’implémente aucune capture du son système. Il ne fournit ni détection automatique fiable de l’accordage source, ni son spatial, ni mode arrière-plan, ni contrôle universel des appareils.

L’intégration à PURAMA ONE/MUKTI doit réutiliser les modules audio et de mesure déjà présents et passer par une revue de la branche active. Cette livraison est une base expérimentale inspectable ; elle n’est ni un déploiement ni une certification de compatibilité universelle.
