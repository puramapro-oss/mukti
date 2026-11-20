# Qualification native des affirmations MUKTI

Ce banc compile les sources natives du dépôt dans une application Capacitor
minimale, avec **Capacitor 7.6.2** et **Capacitor App 7.1.2** verrouillés. Il utilise
les mêmes installateurs que le pipeline mobile de livraison. Ses dépendances
publiques permettent de qualifier les widgets sans installer les dépendances web
privées de MUKTI.

Les dossiers générés `ios/`, `android/` et `node_modules/` restent locaux au banc
et sont ignorés par Git. Ils ne peuvent pas remplacer les sources natives voisines.
Le serveur configuré est l'origine autorisée `https://mukti.purama.dev` ; la page
locale sert uniquement de ressource minimale à la génération Capacitor.

## Exécution automatique

Le workflow `Affirmation widget native qualification` s'exécute sur les pull
requests qui modifient les sources natives, leurs installateurs ou les workflows
mobiles. Il peut aussi être déclenché manuellement.

| Job | Contrôles exécutés | Livrable de qualification |
| --- | --- | --- |
| Android, Ubuntu 24.04, JDK 21 | Tests du parser/modèle Java, tests Python de l'installateur, installation répétée, contrôle du projet, compilation Gradle de l'hôte et du widget | APK de debug et journal Gradle |
| iOS, macOS 15 | Tests Foundation du modèle/cache, tests Ruby de l'installateur, installation répétée sans changement de projet, compilation Xcode de l'hôte et de l'extension, présence de l'extension dans l'application | Application simulateur avec extension et journal Xcode |

Les artifacts sont conservés trois jours. Le job iOS utilise le schéma `App` du
projet Capacitor généré et `CODE_SIGNING_ALLOWED=NO`. L'APK utilise la configuration
de debug Gradle ; aucun certificat de livraison n'est nécessaire pour ce banc.

## Exécution locale

Depuis ce dossier :

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx --no-install cap add android
npx --no-install cap sync android
```

Puis, depuis la racine du dépôt :

```sh
python3 scripts/widgets/apply-android.py --project native/affirmations/harness/android
python3 scripts/widgets/apply-android.py --project native/affirmations/harness/android --check
```

Pour iOS, sur un Mac disposant de Xcode et CocoaPods, générer depuis ce dossier :

```sh
npx --no-install cap add ios --packagemanager CocoaPods
npx --no-install cap sync ios
```

Puis appliquer depuis la racine du dépôt :

```sh
ruby scripts/widgets/apply-ios.rb native/affirmations/harness/ios/App
```

Le workflow contient les commandes complètes des tests et des builds. La présence
d'un workflow ou d'un lockfile ne prouve pas sa réussite : conserver l'identifiant
du run, le commit testé et les résultats des deux jobs pour annoncer une compilation.

## Portée et livraison

Une compilation réussie qualifie la liaison aux SDK natifs et la mise en paquet
de l'extension. Les essais sur appareil couvrent ensuite l'ajout du widget, le
bridge en contexte authentifié, les liens froids/chauds, l'affichage hors ligne,
le texte agrandi et les changements de journée/fuseau.

Le pipeline mobile existant applique maintenant les installateurs après chaque
génération Capacitor. Pour une livraison iOS signée, les profils de l'application
`dev.purama.mukti` et de l'extension `dev.purama.mukti.affirmations` doivent tous deux
autoriser l'App Group `group.dev.purama.mukti.affirmations`. Ce contrôle de signature
et de provisioning demeure distinct du build simulateur sans signature.
