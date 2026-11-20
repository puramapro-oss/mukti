# Android · widget d’affirmations MUKTI

Implémentation locale Java pour le projet Capacitor 7 `dev.purama.mukti`. Elle complète le catalogue existant. Elle n’ajoute ni moteur IA, ni compte, ni base d’affirmations, ni notifications.

## Intégration dans le projet généré

Après `cap add android` et `cap sync android`, depuis la racine du dépôt :

```sh
python3 scripts/widgets/apply-android.py
python3 scripts/widgets/apply-android.py --check
```

`--project /chemin/android` permet de préciser le projet généré. Le script vérifie Capacitor 7, l’identifiant de l’application, son serveur HTTPS, la classe d’entrée et les collisions avant d’écrire. Il ajoute les sources et ressources, les deux receivers privés et la permission de redémarrage. Il remplace uniquement le `MainActivity` vide généré par Capacitor, ou sa propre version non modifiée depuis l’exécution précédente. Une empreinte garde cette propriété ; un changement externe provoque un arrêt explicite.

Le plugin est enregistré avant `super.onCreate`. Le toucher du widget ouvre uniquement `https://mukti.purama.dev/dashboard/subconscient/ecran-verrouille`. Le marqueur d’intent ne contient aucune URL, identité ou session. Une activité restaurée ne consomme pas deux fois ce marqueur.

## Contrat et stockage

Nom JavaScript : `AffirmationWidget`.

- `getState()` : `{ supported, configured, installed, payload? }`. `installed` signifie qu’au moins un ID de widget de ce provider existe ; cela ne certifie ni une surface donnée ni la visibilité de son texte.
- `configure({ payload })` : `{ saved: true }` uniquement après succès de l’écriture persistante. La demande de rafraîchissement ne certifie pas l’instant d’affichage par l’hôte.
- `clear()` : `{ cleared: true }` après effacement persistant et demande de rafraîchissement.
- `requestPin()` : `{ requested }`. API 26+, selon le lanceur et avec l’application au premier plan. L’accord et l’ajout effectif par la personne ne sont pas inférés du retour.

Le snapshot v1 contient exactement `schemaVersion: 1`, `cadence: "daily" | "moments"`, `items: [{id,text}]`, `configuredAt`. La date est ISO UTC avec suffixe `Z`, compatible avec `Date.toISOString()`. Limites : 20 KiB UTF-8, 1–30 éléments, UUID uniques, texte distinct non vide de 100 points de code au plus, sans contrôle C0/C1, séparateur de ligne ou directive bidi. La déduplication compare les textes après normalisation NFKC et conversion en minuscules indépendante de la langue ; le texte affiché reste intact. Les emojis composés avec ZWJ sont acceptés, mais une chaîne faite uniquement d’espaces et de caractères de format est refusée. Les clés inconnues, clés dupliquées et chaînes Unicode mal formées sont refusées.

La provenance publique des textes est établie par l’API applicative qui filtre `source === "purama"`. Le natif valide le contrat et la forme des UUID ; un UUID seul ne prouve pas une provenance éditoriale. Seul le snapshot sélectionné est enregistré dans les préférences privées `purama_affirmations_widget`, clé `affirmationWidget.v1`. Aucun token, cookie, profil, texte personnel, journal ou identifiant utilisateur n’est requis. Les méthodes bridge contrôlent l’origine de la page principale : HTTPS, hôte exact `mukti.purama.dev`, aucun userinfo et port standard.

## Calendrier et rendu

La cadence quotidienne change de sélection à minuit local. La cadence par moments utilise 7 h, 13 h et 20 h ; avant 7 h, elle conserve le moment de 20 h de la veille. La sélection suit `ordinal = epochDayLocal * slots + slot`, avec modulo positif sur la longueur de la liste. Le calcul du jour utilise le calendrier grégorien local, sans supposer qu’une journée dure toujours 24 heures. La même liste et le même fuseau produisent donc la même sélection.

Le provider utilise `RemoteViews`, des textes accessibles et un fond uni. Le texte complet reste dans la description d’accessibilité lorsque l’hôte impose une surface réduite. La taille du texte est adaptative à partir d’Android 8 ; Android 6/7 conserve la taille explicite. Aucun bitmap, audio, vidéo, service de premier plan, alarme exacte ou accès réseau n’est utilisé.

`updatePeriodMillis` vaut 30 minutes. Le calcul est aussi repris après changement d’heure/fuseau, redémarrage déverrouillé, retour à l’application et modification de configuration. Android et le lanceur décident du moment effectif de mise à jour ; les passages à 7/13/20 h ne sont pas garantis à la minute exacte. `home_screen|keyguard` déclare les surfaces prises en charge, sans garantir que le téléphone propose un hôte d’écran verrouillé.

## Vérifications à exécuter

```sh
sh native/affirmations/android/tests/run-model-tests.sh
python3 native/affirmations/android/tests/test_apply_android.py
```

Les tests Java compilent le vrai parser et le vrai modèle sans classes Android. Ils couvrent le contrat, les bornes UTF-8/Unicode, les doublons, les dates invalides, les changements de jour et des vecteurs indépendants `java.time` incluant changements d’heure, fuseaux et dates antérieures à 1970. Les tests Python appliquent l’installateur à des projets jetables et vérifient idempotence, conservation des éléments existants, refus des collisions et absence d’écriture après rejet.

Ces contrôles ne remplacent pas un build Gradle, les tests du bridge Capacitor, l’ajout/refus/suppression par le lanceur, le redimensionnement, le texte agrandi, TalkBack, le redémarrage, le mode économie d’énergie et l’essai sur appareil réel. Aucun résultat de compilation ou test physique n’est revendiqué par ce fichier.

## Références officielles consultées

- [Capacitor 7 · code Android natif et enregistrement du plugin](https://capacitorjs.com/docs/v7/android/custom-code).
- [Capacitor 7.6.2 · Bridge](https://github.com/ionic-team/capacitor/blob/7.6.2/android/capacitor/src/main/java/com/getcapacitor/Bridge.java) et [BridgeActivity](https://github.com/ionic-team/capacitor/blob/7.6.2/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java).
- [Android · création d’un widget](https://developer.android.com/develop/ui/views/appwidgets).
- [Android · fréquence et modes de mise à jour](https://developer.android.com/develop/ui/views/appwidgets/advanced).
- [Android · AppWidgetManager, requestPinAppWidget](https://developer.android.com/reference/android/appwidget/AppWidgetManager).
- [Android · AppWidgetProviderInfo et catégories d’hôte](https://developer.android.com/reference/android/appwidget/AppWidgetProviderInfo).
