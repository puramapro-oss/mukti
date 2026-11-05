# Harmonie — qualification sur appareils

Ce document décrit les essais restants. Aucun résultat matériel n'est acquis par sa présence.

## Préconditions communes

Identifier modèle, version du système, version du navigateur ou de l'application, périphérique audio, firmware, câble/adaptateur et route effective. Utiliser des contenus de test locaux dont les fréquences et les événements temporels sont connus. Conserver le réglage de volume lors des comparaisons. Relever la fréquence d'échantillonnage réellement obtenue.

Le contrôle numérique en sortie du DSP et une mesure physique indépendante répondent à deux questions différentes. Pour l'émission acoustique, noter le matériel de mesure, l'horloge de référence, l'incertitude et les traitements de microphone encore actifs. Ne pas remplacer une mesure absente par la consigne.

## Matrice initiale

| Appareil / route | Tonalité | Musique locale | Arrêt / reprise | Vidéo / retard | État actuel |
|---|---|---|---|---|---|
| MacBook Pro M4 Max / haut-parleurs | À exécuter | À exécuter | À exécuter | À exécuter | NON TESTÉ |
| MacBook Pro M4 Max / USB ou jack | À exécuter | À exécuter | À exécuter | À exécuter | NON TESTÉ |
| MacBook Pro M4 Max / Bluetooth | À exécuter | À exécuter | À exécuter | À exécuter | NON TESTÉ |
| iPhone / Safari / haut-parleur | À exécuter | À exécuter | À exécuter | Lecteur web vidéo absent | NON TESTÉ |
| iPhone / Safari / casque Bluetooth | À exécuter | À exécuter | À exécuter | Lecteur web vidéo absent | NON TESTÉ |
| iPad / Safari / USB audio | À exécuter | À exécuter | À exécuter | Lecteur web vidéo absent | NON TESTÉ |
| Android / navigateur / haut-parleur | À exécuter | À exécuter | À exécuter | Lecteur web vidéo absent | NON TESTÉ |
| Android / Bluetooth | À exécuter | À exécuter | À exécuter | Lecteur web vidéo absent | NON TESTÉ |
| Windows / sortie filaire puis Bluetooth | À exécuter | À exécuter | À exécuter | À exécuter | NON TESTÉ |
| Accessoire USB Audio MUKTI | Matériel absent | Matériel absent | Matériel absent | Matériel absent | NON TESTÉ |

Remplacer « iPhone », « Android » et les périphériques par les modèles effectivement présents lors de chaque essai. Aucun résultat n'est extrapolé à toutes les marques.

## Critères fonctionnels

1. Aucun son avant une action volontaire ; démarrage effectif après un clic sur mobile, sans double clic obligatoire.
2. Tonalité seule : fréquence observée cohérente avec la consigne et l'incertitude de mesure, niveau stable et absence de saturation.
3. Musique : conservation de la durée et du rythme, source explicitement supposée ou renseignée, pas de seconde transposition d'une source déjà à 432.
4. Mélodie : notes audibles et accordage cohérent ; le son continu n'est présent que si son option a été activée.
5. Pause/reprise et arrêt : état de l'interface conforme au son réel. Arrêt pendant chargement ne doit pas être annulé par une réponse tardive.
6. Sortie de page, écran verrouillé, interruption téléphonique, sortie débranchée, Bluetooth perdu : état documenté, absence de reprise surprise sur les haut-parleurs.
7. Fichier invalide, format non décodable, limite de durée, processeur indisponible : erreur intelligible et aucun faux statut actif.
8. Écoute comparative à volume comparable : noter voix métalliques, attaques adoucies, basses instables, image stéréo altérée ou clics.

## Vidéo

La conversion locale est testée séparément du lecteur web audio. Utiliser une vidéo dont des flashes et clics synchronisés sont connus. Vérifier la différence audio/image au début, au milieu et à la fin. Mesurer une éventuelle dérive et distinguer retard fixe du moteur, tampon du périphérique et délai Bluetooth.

Un lecteur externe affichant une image hors de notre contrôle peut empêcher la compensation. Ne jamais déduire « synchronisation parfaite » du seul maintien du tempo ou de la copie des paquets vidéo.

## Son des autres applications

Le test doit prouver que le flux traverse réellement le moteur et que l'original n'est plus entendu en parallèle. Exclure la sortie du processeur de sa propre capture. Tester une déconnexion du moteur et documenter si le système se tait ou revient explicitement à l'original.

Android : vérifier consentement, politique de capture et comportement si elle est refusée. iOS : ne pas afficher une option de traitement système universel sur la base de la seule coexistence de deux sessions audio.

Spotify Connect / Cast / transfert AirPlay : identifier le lecteur effectif. Une commande depuis le téléphone ne prouve pas que l'audio passe par ce téléphone. Aucune capture ni altération d'une plateforme protégée ne doit être ajoutée pour simuler une compatibilité.

## Fiche de résultat minimale

```json
{
  "device": "modèle réellement testé",
  "osVersion": "version observée",
  "audioRoute": "périphérique et connexion",
  "softwareCommit": "commit installé",
  "inputFixture": "fichier et empreinte",
  "requestedReferenceHz": 432,
  "observedFrequencyHz": null,
  "measurementUncertaintyHz": null,
  "latencyMilliseconds": null,
  "durationDifferenceMilliseconds": null,
  "status": "NON TESTÉ",
  "notes": "Aucun résultat n'est inféré automatiquement."
}
```
