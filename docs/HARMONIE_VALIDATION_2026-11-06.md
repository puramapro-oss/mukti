# MUKTI / Harmonie — résultats et portée de livraison

Date : 6 novembre 2026 (Europe/Paris). État global : **PARTIEL**.

Le cœur numérique et le convertisseur local disposent de preuves d'exécution.
L'intégration au produit déployé, les pilotes de sortie système et le matériel
ne sont pas validés par cette livraison.

## Résultats vérifiés

| Élément | État | Preuve et périmètre |
|---|---|---|
| Conversion locale audio/vidéo | PASS | 11 tests E2E, aucun échec ou cas ignoré, Linux et FFmpeg 6.1.1 |
| Moteur WASM de transposition du lecteur | PASS dans le banc numérique | 8 scénarios, véritable WASM, hôte AudioWorklet minimal sous Node |
| Interface et moteur dans Chrome/Safari réels | NON TESTÉ | Aucun navigateur exécutable disponible dans cet environnement |
| Fichiers d'écoute son pur et mélodie + tonalité | PASS numérique | Inspection indépendante des fichiers PCM générés |
| Sorties réelles téléphone/tablette/PC, Bluetooth ou câble | NON TESTÉ | Aucun matériel de sortie mesuré |
| Routage système macOS/Windows/Android/iOS | NON IMPLÉMENTÉ dans cette livraison | Architecture et limites documentées |
| Spotify intégré / autres plateformes protégées | NON IMPLÉMENTÉ | Aucun SDK de streaming ni accès aux contenus protégés ajouté |
| Accessoire USB Audio / Bluetooth MUKTI | NON FABRIQUÉ, NON TESTÉ | Proposition d'architecture uniquement |
| Application PURAMA ONE déployée | NON DÉPLOYÉ par cette intervention | Code isolé et plan d'intégration ; aucun état de production inféré |

## Conversion locale : précision et conservation

Mesures obtenues avec entrées synthétiques indépendantes :

| Contrôle | Mesure |
|---|---|
| 440 Hz → cible 432, stéréo 48 kHz | 432,0000 Hz |
| 880 Hz → cible 864, autre canal | 863,9966 Hz |
| 440 Hz mono à 44,1 kHz | 432,0000 Hz |
| Durée WAV/FLAC de 5 secondes à 48 kHz | 240 000 échantillons conservés |
| Source/cible identiques à 432, signal de faible niveau | Écart maximal entre échantillons : 0 |
| Vidéo MKV et MP4 synthétique | 150 images décodées identiques, hachages de paquets identiques |
| Horodatages et durée conteneur vidéo | Écart mesuré : 0 |
| Pics d'énergie de trois impulsions, WAV | Écart de 2,10 à 2,21 ms |
| Pics d'énergie de trois impulsions, MP4 | Écart de 0,35 à 1,54 ms |
| Variation temporelle première → dernière impulsion | 0,104 ms |

Ces résultats ne constituent pas une preuve de transparence perceptive sur toutes
les musiques. Le profil initial Rubber Band avec `transients=crisp` échouait sur
le test 440 Hz (environ 432,90 Hz). Le profil final `smooth`/fenêtre longue corrige
ce cas ; son effet sur les attaques devra être évalué par écoute.

Le fichier MP4 encode l'audio en AAC : préremplissage et complément d'encodeur
peuvent modifier durée brute décodée et métadonnées de début de piste. Dans la
fixture, la piste brute décodée mesure 5,0347 s contre 5 s en FLAC, les métadonnées
de début diffèrent de −22 ms et le conteneur vidéo reste à 6 s. Le moment du
contenu est contrôlé séparément avec les impulsions. Ne pas promettre un nombre
d'échantillons identique après AAC.

Le détail reproductible se trouve dans
[`tools/harmonie/tests/retune-report.json`](../tools/harmonie/tests/retune-report.json)
et les commandes dans [`tools/harmonie/README.md`](../tools/harmonie/README.md).

## Lecteur expérimental : précision et délai

Le lecteur utilise l'entrée continue du véritable moteur Signalsmith Stretch
1.3.2 embarqué. La mesure est effectuée sur les sorties de ce WASM, pas sur une
simulation mathématique qui se contenterait d'afficher la cible.

| Entrée et cible | Fréquence mesurée |
|---|---|
| 440 → 432 Hz | 432,044929 Hz |
| 880 → 864 Hz | 864,455262 Hz |
| 12 000 → 11 781,818182 Hz | 11 782,224617 Hz |
| Stéréo 440/660 → 432/648 Hz | 432,045400 / 648,210857 Hz |
| 432 → 432 Hz, rapport 1 | 432,000001 Hz |

Les critères retenus pour cette transposition musicale sont une erreur inférieure
à 1 cent et à 0,1 Hz autour de la cible 432. Le traitement musical n'est pas un
générateur de son étalon. Le générateur de tonalité passe directement par un
oscillateur ; les deux fonctions restent distinguées.

Le réglage retenu annonce 320 ms de latence propre au processeur. Il est adapté
à ce banc d'écoute de fichiers audio, pas à une promesse de synchronisation vidéo
universelle. S'y ajoutent les retards du système et des périphériques. L'erreur
maximale d'intervalle entre impulsions synthétiques est de 0,604 ms après prise
en compte du délai fixe.

Le mode par buffers testé initialement donnait 432,507868 Hz et a été rejeté.
Cet échec reste dans le rapport ; il n'est pas compté parmi les réussites.

Le détail est disponible dans
[`prototypes/harmonie/tests/verification.json`](../prototypes/harmonie/tests/verification.json).
Un hôte de test Node ne valide ni le geste utilisateur Safari, ni les interruptions
réelles de navigateur, ni la sortie matérielle. Les contrôles de logique avec
API simulées ne changent pas ce statut.

## Exemples d'écoute

Les deux WAV sont des créations originales, sans enregistrement tiers :

- `MUKTI_432Hz_son_pur.wav` : 12 s, sinusoïde de consigne 432 Hz, estimation
  numérique 431,999997 Hz dans la portion stable.
- `MUKTI_432Hz_melodie_et_tonalite.wav` : 24 s, mélodie au la 432 et tonalité
  continue à 432. Le son continu est vérifié dans les intervalles entre notes.

Format : PCM 16 bits, mono, 48 kHz. Les débuts/fins sont progressifs ; les niveaux
numériques restent inférieurs à 0,11 de pleine échelle. Cela ne prédit pas le
niveau acoustique d'un casque ou d'une enceinte. La mesure d'une note distincte
dans la mélodie confirme qu'elle n'est pas remplacée par le son continu.

Preuves :
[`tools/harmonie/tests/generation-report.json`](../tools/harmonie/tests/generation-report.json).

## Suite d'intégration

Les limites, API de plateformes, architecture de boîtier et décisions de produit
sont regroupées dans
[`MUKTI_HARMONIE_432_ARCHITECTURE_2026-11-06.md`](MUKTI_HARMONIE_432_ARCHITECTURE_2026-11-06.md).
Les essais matériels restent dans
[`HARMONIE_DEVICE_QUALIFICATION.md`](HARMONIE_DEVICE_QUALIFICATION.md).

Cette livraison n'active pas un filtre universel sur les appareils de Matiss.
Elle fournit des composants exécutés, les mesures correspondantes et un périmètre
précis pour poursuivre l'intégration dans MUKTI/PURAMA ONE.
