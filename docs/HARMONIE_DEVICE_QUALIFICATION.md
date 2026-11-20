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

## Complément du 12 novembre 2026 — extensions Spooky, Dream Machine et Kasina

Le document utilisateur « PURAMA_Coque_Extension_Spooky_Dream.md » du 13 septembre décrit une conception d'extensions et de coordination. Son existence ne prouve ni pilote, ni appareil raccordé, ni compatibilité universelle. L'examen du code accessible a retrouvé les lecteurs MUKTI/AURORA/Harmonie et une ancienne branche de compatibilité ; aucun résultat de qualification Spooky/Dream/Kasina n'en découle.

| Élément | Identification restant nécessaire | Fonction vérifiée dans ce lot | Étape de qualification suivante | État |
| --- | --- | --- | --- | --- |
| Spooky2 / référence historique GeneratorX Pro | Modèle exact, firmware, version logiciel, manuel et interface officiellement disponible | Aucun contrôle ni mesure de l'appareil | Vérifier le contrat d'interface et un éventuel import en lecture seule de journaux avant toute commande | NON TESTÉ |
| Dream Machine Technology | Modèle et version exacts ; programme officiel, notice et conditions d'utilisation | Aucun pilote lumineux ni stroboscope téléphonique | Évaluation propre au dispositif et à son contenu ; solution texte/audio sans lumière pulsée utilisable séparément | NON TESTÉ |
| Dreamachine britannique | Installation artistique distincte de Dream Machine Technology | Aucun raccordement | Ne pas transférer résultats, exclusions ou compatibilité d'un dispositif à l'autre ; examiner séparément la variante Deep Listening | NON TESTÉ |
| MindPlace Kasina | Modèle/firmware, lunettes/accessoires, schéma de connexion et manuel correspondant | Aucun pilote ni programme lumineux validé | Vérifier l'interface et les capacités avant d'annoncer une intégration | NON TESTÉ |
| MUKTI sur téléphone / ordinateur / salon | Modèle, système, navigateur, sortie audio, version réellement installée | Contrôles logiciels ciblés ; qualification navigateur liée au rapport CI | Tests physiques de volume, arrêt, interruption, débranchement et reprise sur chaque route retenue | PARTIEL |

### Informations à conserver séparément

Pour chaque liaison future, distinguer la consigne demandée, l'accusé de réception de l'appareil, l'exécution rapportée par celui-ci, une mesure indépendante, la sauvegarde du journal et le ressenti déclaré. Une commande envoyée n'est pas une émission mesurée ; une séance terminée n'est pas une amélioration clinique.

Une fréquence acoustique, un accordage musical, une différence binaurale, une cadence lumineuse et une stimulation électrique ou électromagnétique sont des grandeurs de modalités différentes. Une valeur identique en hertz ne permet pas de transférer un résultat ou une tolérance d'un dispositif à un autre.

Le gain numérique du moteur ne fixe pas le niveau acoustique en décibels au tympan : appareil, casque, volume système et route changent le résultat. Aucune commande « puissance maximale » intermodale n'est définie. Le fabricant, les limites de l'interface et les qualifications propres à l'usage précèdent une éventuelle commande.

### Lumière pulsée et décision de produit

Ce lot n'ajoute aucune émission stroboscopique à l'écran, à la torche ou à un appareil externe. L'arrêt visible et les préférences de mouvement réduit restent nécessaires pour les séances ordinaires ; ils ne suffisent pas à qualifier une stimulation lumineuse.

Les [précautions du fabricant Dream Machine Technology](https://dream-machine.tech/pages/risques-medicaux) identifient des situations où son dispositif ne doit pas être utilisé. Les [critères WCAG sur les flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) concernent l'accessibilité d'un contenu web ; ils ne constituent pas une certification médicale d'un dispositif lumineux. Le [travail PLOS de 2026](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0359958) doit être lu avec ses limites de sélection, de déclaration et de validation du dépistage. Aucun questionnaire interne n'est présenté comme une garantie de sécurité ni comme un outil diagnostique.

La [FAQ Dreamachine](https://dreamachine.world/faqs/) concerne une expérience britannique distincte. Le qualificatif « Dream » ne permet pas de fusionner ces matériels dans un seul profil de compatibilité.

### Allégations et preuve matérielle

L'[avis légal de Spooky2](https://www.spooky2.com/legal/) décrit un dispositif expérimental et ne fournit pas une preuve de traitement des maladies. Une intégration de journaux pourrait documenter l'activité ; elle ne justifierait pas une recommandation thérapeutique.

Toute future déclaration de compatibilité doit joindre modèle, firmware, version du pilote, source de documentation, configuration de test, observations d'arrêt, erreurs et mesures. Les éléments absents restent inconnus ; ils ne sont pas remplis par une simulation ou un résultat numérique du navigateur.


