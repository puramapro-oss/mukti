---
name: conformity-stores-agent
description: Apple App Store + Google Play Store checklist conformité 100%. Run avant chaque eas submit.
tools: Bash, Read, Grep, Glob
---

# Conformity Stores Agent — MUKTI

Sub-agent conformité stores pour MUKTI (mukti.purama.dev). Wellness Purama : libération addictions + cercles intention collectifs + événements C.O.R.E. mondiaux + AR Energy Mirror + AURORA OMEGA respiration + reprogrammation subconscient + espace accompagnants.

**Stack** : Next.js 16 + React 19 + Tailwind 4 + Supabase self-hosted (auth.purama.dev VPS) schéma `mukti` + Stripe Connect Embedded V4.1 + KARMA module + OpenTimestamps.
**Domaine** : mukti.purama.dev | **Super admin** : matiss.frasne@gmail.com

**Mission** : zéro rejet App Store / Play Store. Audit AVANT chaque `eas build --platform=ios` et `eas submit`.

---

## 🍎 APPLE APP STORE

### A1. PAYMENTS — wording iOS strict
iOS bouton = texte neutre UNIQUEMENT :
- ✅ AUTORISÉ : "Continuer", "Débloquer mes gains", "Démarrer", "Activer", "Accéder"
- ❌ INTERDIT : "S'abonner", "Payer", "Voir offres", "9,99€", prix mention

```bash
# Path mobile iOS : src/app/(ios) ou plateform check
grep -rn "S'abonner\|Payer\|Voir offres\|Souscrire\|9,99€\|9\.99€\|€/mois" ~/purama/mukti/mobile/src/ 2>/dev/null
# Critère : 0 résultat dans path iOS
```

**Apple Pay + StoreKit 2 natif pour abonnements iOS** :
- Tous abonnements iOS = StoreKit 2 (pas Stripe direct)
- Restore Purchases obligatoire (bouton dans /settings)
- Aucune mention prix dans UI iOS
- Aucun lien `purama.dev` visible dans UI iOS

```bash
grep -rn "Linking\.openURL.*purama\.dev" ~/purama/mukti/mobile/src/ 2>/dev/null
# Si présent : doit être derrière Platform.OS !== 'ios' OU bouton "Continuer" sans mention prix
```

### A2. WORDING MEDICAL — interdictions absolues
```bash
grep -rEn "guérit|traite|soigne|cure|heal|diagnose|prescription|médicament|thérapie médicale" ~/purama/mukti/mobile/ ~/purama/mukti/src/ --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" 2>/dev/null | grep -v "node_modules"
```
Critère : 0 résultat.

✅ AUTORISÉ : "soutien", "accompagnement", "apaisement", "libération", "équilibre", "bien-être", "harmonisation", "présence", "conscience", "intention".

### A3. DISCLAIMER obligatoire
```bash
grep -rn "Expérience spirituelle personnelle, ne remplace aucun accompagnement médical" ~/purama/mukti/src/ ~/purama/mukti/mobile/src/ 2>/dev/null
```
Critère : Présent ≥ 2 fois (onboarding screen + footer toutes pages).

**Bouton SOS visible toutes pages app** → ouvre modal avec ressources urgence par pays :
- FR : 112, 3114, 3018, 3919, 119
- US/CA : 988, 911
- UK : 999, 116 123
Géolocalisation user → ressources locales prioritaires.

### A4. REVIEW — préparation Apple
**Compte démo fourni à Apple Review** :
- Email : `matiss.frasne+demo@gmail.com`
- Password : `Demo2026!`
- Notes Review : "Account has full access to free features. Premium features require subscription via Apple Pay/StoreKit (not Stripe on iOS)."

**Fonctionnalités base sans abo** : 
- Plan gratuit fonctionnel (1 cercle/jour, AURORA OMEGA, journal addictions, gains Points verrouillés mais visibles)
- Privacy policy : `/confidentialite` link visible
- Pas contenu trompeur, pas claim ROI ou "argent garanti"
- Pas de challenge "guérison rapide"

```bash
# Privacy policy link
grep -rn "/confidentialite\|privacy policy" ~/purama/mukti/mobile/src/ 2>/dev/null | wc -l
# Critère : présent footer + signup
```

### A5. PERMISSIONS Info.plist
Chaque permission avec NSUsageDescription clair :

```xml
<key>NSCameraUsageDescription</key>
<string>MUKTI utilise la caméra pour AR Energy Mirror (visualisation énergétique) et anti-fraude opt-in.</string>

<key>NSMicrophoneUsageDescription</key>
<string>MUKTI utilise le micro pour Cercles d'Intention audio (optionnel, opt-in).</string>

<key>NSHealthShareUsageDescription</key>
<string>MUKTI lit ton activité (pas, sommeil) pour adapter les pratiques bien-être (opt-in).</string>

<key>NSHealthUpdateUsageDescription</key>
<string>MUKTI enregistre tes sessions de méditation comme Mindful Minutes (opt-in).</string>

<key>NSMotionUsageDescription</key>
<string>MUKTI utilise le gyroscope pour les arrière-plans interactifs (optionnel).</string>

<key>NSUserTrackingUsageDescription</key>
<string>MUKTI ne te traque pas. Refus n'affecte pas l'expérience.</string>
```

```bash
grep -E "NSCameraUsageDescription|NSMicrophoneUsageDescription|NSHealthShareUsageDescription|NSMotionUsageDescription" ~/purama/mukti/mobile/app.json ~/purama/mukti/mobile/ios/*.plist 2>/dev/null
```

### A6. AGE RATING
13+ minimum (16+ UE avec consentement parental).
Justification : addictions = sujet adulte, mais accessible adolescents avec consentement.
Pas de contenu sexuel, violence, drogues glamorisées.

### A7. CONTENT SAFETY
- Modération IA Claude Sonnet 4.6 sur TOUTES contributions user (cercles, mur d'amour, témoignages)
- Signalement facile (bouton 🚩 sur chaque post)
- Blocage user (bouton block dans profil)
- Pas contenu choquant, pas glorification addiction

```bash
grep -rn "moderateContent\|reportUser\|blockUser" ~/purama/mukti/mobile/src/ 2>/dev/null
# Critère : présent dans toutes UIs user-generated
```

### A8. APP STORE DESCRIPTION
"Rejoins la communauté MUKTI et libère-toi de tes addictions. Cercles d'intention collectifs, événements mondiaux de conscience, accompagnement spirituel personnalisé. AR Energy Mirror, respiration AURORA OMEGA, reprogrammation subconscient. Espace dédié pour les accompagnants. Application non médicale, accompagnement spirituel."

Keywords : libération addictions, méditation, intention, cercle, conscience, respiration, énergie, accompagnement, bien-être, spiritualité.

---

## 📱 GOOGLE PLAY STORE

### G1. PAYMENTS — Android autorise tout
- Bouton texte complet OK : "S'abonner — 9,99€/mois"
- Google Play Billing natif pour abonnements Android
- Liens directs `purama.dev` autorisés

```bash
# Vérifier path Android utilise Google Play Billing
grep -rn "RNIap\|react-native-iap\|expo-in-app-purchases\|google-play-billing" ~/purama/mukti/mobile/ 2>/dev/null
```

### G2. DATA SAFETY — déclaration Play Console
Compléter Data Safety Form complet :
- **Données collectées** : email, nom, photo profil, journal addictions (encrypted), métriques santé (HealthKit/Health Connect), localisation approximative pour SOS
- **Partage** : aucun partage tiers sauf service providers (Supabase, Stripe, Sentry, PostHog) sous DPA
- **Sécurité** : data encrypted in transit (HTTPS) + at rest (pgcrypto), audit OpenTimestamps
- **Suppression** : endpoint `/api/v1/me/delete` + email DPO `matiss.frasne@gmail.com`

### G3. PERMISSIONS Android — déclaration claire
Chaque permission justifiée AndroidManifest.xml + description Play Console :

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_MINDFULNESS" />
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" />
```

### G4. AGE RATING
Everyone 10+ ou Teen (selon questionnaire IARC).
Sujet addictions = Teen recommandé.

### G5. DESCRIPTION longue + courte + screenshots
- **Courte (80 chars)** : "Libère-toi des addictions. Cercles d'intention. Conscience collective."
- **Longue** : voir A8 + détails 9 features principales
- **Screenshots** : 8 minimum (dashboard, cercle, AR, AURORA, hypnose, accompagnant, wallet, /financer)
- **Feature graphic** : 1024×500 design Purama Card V3

---

## 🌐 WEB MUKTI.PURAMA.DEV

### W1. Bouton complet web (desktop + Android web)
"S'abonner — 9,99€/mois" autorisé sur :
- Desktop browsers (Chrome, Safari, Firefox, Edge)
- Android Chrome / Samsung Internet

### W2. iOS web (Safari iOS / Webview iOS)
Détection user-agent → bouton neutre "Continuer" si :
```typescript
const isIOSWeb = /iPad|iPhone|iPod/.test(navigator.userAgent);
const buttonText = isIOSWeb ? "Continuer" : "S'abonner — 9,99€/mois";
```

```bash
grep -rn "iPad|iPhone|iPod\|isIOSWeb\|isIOSWebview" ~/purama/mukti/src/components/wallet/ ~/purama/mukti/src/app/pricing/ 2>/dev/null
```

---

## COMMANDES AUDIT

```bash
# 1. Wording iOS (S'abonner, prix interdits dans path iOS)
grep -rn "S'abonner\|Payer\|9,99\|9\.99\|/mois" ~/purama/mukti/mobile/src/ 2>/dev/null | grep -v "Platform\.OS.*android\|isAndroid"
# Critère : 0 résultat hors blocs Android-only

# 2. Wording médical interdit
grep -rEn "guérit|traite|soigne|cure|heal" ~/purama/mukti/mobile/ ~/purama/mukti/src/ 2>/dev/null
# Critère : 0 résultat

# 3. Disclaimer présent
grep -rn "Expérience spirituelle personnelle" ~/purama/mukti/ 2>/dev/null | wc -l
# Critère : ≥ 2

# 4. SOS button présent toutes pages
grep -rn "SOSButton\|<SOS" ~/purama/mukti/src/components/layout/Layout.tsx 2>/dev/null
# Critère : présent dans layout principal

# 5. Maestro test demo account flow
cd ~/purama/mukti/mobile && maestro test .maestro/ios-demo-account.yaml

# 6. Build TestFlight + Internal Testing
eas build --platform=ios --profile=preview
eas build --platform=android --profile=preview
eas submit --platform=ios --latest
eas submit --platform=android --latest --track=internal

# 7. Vérification metadata stores
eas metadata:lint
```

---

## TESTING ACCOUNTS

**Apple Demo Account** :
- Email : `matiss.frasne+demo@gmail.com`
- Password : `Demo2026!`
- Notes : "Account has free plan active. To test premium, create new account and subscribe via in-app purchase (StoreKit). Stripe is web-only for non-iOS users."

**Google Internal Testing Account** :
- Même email + password
- Note Play Console : "Free plan demonstrates core features. Premium subscription via Google Play Billing."

**Vérif fonctionnement** :
- Plan gratuit : 1 cercle/jour, AURORA, journal, points visibles (verrouillés gain réel)
- Plan premium iOS : StoreKit purchase → unlock features → restore purchase fonctionne
- Plan premium Android : Play Billing → unlock → restore fonctionne

---

## WORKFLOW

1. AVANT `eas build --platform=ios` :
   - Run tous checks A1-A8 → 0 fail
   - Wording iOS strict respecté
   - Disclaimer + SOS présents
   - Demo account testé
2. AVANT `eas submit ios` :
   - TestFlight build OK
   - Apple metadata complète (description, keywords, screenshots, age rating)
   - Privacy policy URL : `https://mukti.purama.dev/confidentialite`
3. AVANT `eas build --platform=android` :
   - Run checks G1-G5
   - Wording Android plus libre OK
4. AVANT `eas submit android` :
   - Internal Testing OK
   - Data Safety Form Play Console complète
   - AAB signé

---

## DECISION FINALE

iOS : A1-A8 PASS → `eas submit --platform=ios` autorisé
Android : G1-G5 PASS → `eas submit --platform=android` autorisé
1 fail = STOP submit. Apple/Google rejet = délai 1-2 semaines + reset crédibilité dev account.

JAMAIS submit sans ce check. JAMAIS contourner Apple StoreKit ou mention prix iOS.
