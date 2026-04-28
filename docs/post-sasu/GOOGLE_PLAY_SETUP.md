# MUKTI — Google Play Console (post-SASU)

> Pas-à-pas pour activer le Google Play Console SASU PURAMA et préparer la première soumission MUKTI.

## ① Google Play Console enrollment (< 24h)

URL : https://play.google.com/console/signup

1. **Account type** : **Organization** (pas Individual).
2. **Organization name** : `PURAMA` (exact match KBIS).
3. **Organization address** : `8 Rue de la Chapelle, 25560 Frasne, France`.
4. **D-U-N-S Number** : (le même que pour Apple, cf `APPLE_DEVELOPER_SETUP.md` ①).
5. **Phone** : ligne pro SASU.
6. **Website** : `https://purama.dev`.
7. **Email** : `dev@purama.dev`.
8. **Payment** : 25 $ une fois, carte SASU.
9. Vérification 24h en moyenne.

**Output** : compte `puramapro-oss-projects` (ou similaire) actif.

## ② Service Account (pour fastlane / API)

URL : https://console.cloud.google.com → **IAM & Admin** → **Service Accounts** → **Create**.

1. **Name** : `mukti-fastlane`.
2. **Description** : "Fastlane uploader for MUKTI app".
3. **Role** : `Service Account User`.
4. **Create key** → JSON → download `mukti-fastlane-key.json`.

URL : Google Play Console → **Setup** → **API access** → **Link** → choisir `mukti-fastlane`.

5. **Permissions** : `Release apps to testing tracks` + `Manage store presence`.
6. **Save**.

```bash
# Encoder en base64 pour CI
base64 -i mukti-fastlane-key.json | pbcopy
# → coller comme GitHub secret : GOOGLE_PLAY_JSON_KEY
```

## ③ Upload Keystore (Android signing)

```bash
keytool -genkey -v -keystore mukti-upload.keystore \
  -alias mukti-upload -keyalg RSA -keysize 2048 -validity 25000 \
  -dname "CN=PURAMA, O=PURAMA, L=Frasne, S=Doubs, C=FR"
```

Mot de passe : choisir un solide (32 chars+). Stocker dans `~/Documents/Purama-secrets/` + GitHub secrets.

```env
ANDROID_KEYSTORE_BASE64=$(base64 < mukti-upload.keystore)
ANDROID_KEYSTORE_PASSWORD=...
ANDROID_KEY_ALIAS=mukti-upload
ANDROID_KEY_PASSWORD=...
```

> **Google Play App Signing** est activé par défaut sur tout nouveau projet. Google génère la clé prod ; on signe localement avec une "upload key" différente (celle-ci).

## ④ Création de l'app

URL : Google Play Console → **Create app**.

| Champ | Valeur |
|---|---|
| App name | `Mukti — Libération` |
| Default language | French (France) |
| App or game | App |
| Free or paid | **Free** |

→ **Create**.

## ⑤ Set up your app — checklist dashboard

Une checklist apparaît automatiquement. Ordre :

1. **Privacy Policy URL** → `https://mukti.purama.dev/politique-confidentialite`
2. **App access** → "All functionality is available without restriction" + demo account fourni dans Comments.
3. **Ads** → **No, my app does not contain ads**.
4. **Content rating** → questionnaire IARC (cf §⑥ ci-dessous).
5. **Target audience and content** : Primary age **18+**, Children part of audience: **No**.
6. **News app** → No.
7. **COVID-19 contact tracing** → No.
8. **Data safety** → cf §⑦.
9. **Government apps** → No.
10. **Financial features** → No (Stripe externe ne compte pas).
11. **Health apps** → ⚠️ **Yes** → questions claims médicaux (cf §⑧).

## ⑥ IARC Content Rating

URL : Console → **App content** → **Content rating** → **Start questionnaire**.

| Question | Réponse MUKTI |
|---|---|
| Email IARC | `dev@purama.dev` |
| Category | **Reference, News, Educational** |
| Violence | None |
| Self-harm depicted | **Clinical references only** (3114/112 protective) |
| Sexual content | None |
| Profanity | None |
| Drugs/alcohol/tobacco references | **Yes — addiction support context** (références conceptuelles, jamais de glorification) |
| Gambling | None |
| User interaction | **Yes — moderated text + audio** (Cercles d'intention) |
| Voice/video chat | **Yes** (Cercles audio LiveKit, vidéo optionnelle) |
| Digital purchases | **Yes — outside the app** |
| Personal info | **Yes — collected, not shared** |

**Résultat attendu** : `Teen` ESRB / `PEGI 12` ou `PEGI 16` (à cause addictions + user-generated).

## ⑦ Data Safety form

> Section critique. Toute discordance Privacy Policy ↔ Data Safety = rejet automatique.

| Type données | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Email | ✅ | ❌ | Account, App functionality | Required |
| Name | ⚠️ Optional | ❌ | App functionality | Optional |
| User IDs (Supabase UUID) | ✅ | ❌ | App functionality | Required |
| Health info (addictions self-declared, mental state) | ✅ | ❌ | App functionality, Personalization | Required |
| Sensitive Info (mental health, spirituality) | ✅ | ❌ | App functionality | Required |
| Photos/Videos | ❌ (camera live only, no storage) | — | — | — |
| Voice recordings | ❌ (live audio only, not stored) | — | — | — |
| Other in-app messages | ✅ (cercles, forum) | ❌ | App functionality | Optional |
| Device IDs (FCM token push) | ✅ | ❌ | App functionality (push) | Optional |
| Crash logs | ✅ (Sentry) | ❌ | Diagnostics | Required |
| App interactions | ✅ (PostHog EU) | ❌ | Analytics | Optional (consent banner) |

**Sécurité** :
- ☑ Encrypted in transit (TLS 1.3 + HSTS)
- ☑ Data deletion (`/profile/privacy/delete` — RGPD art. 17)
- ☑ Data export (`/profile/privacy/export` — RGPD art. 20)
- ☐ Families Policy (audience 18+)
- ☑ Independently validated (RGPD-native, GDPR-aligned hosting EU)

## ⑧ Health apps declarations

URL : **App content** → **Health features**.

| Question | Réponse |
|---|---|
| Health Connect integration | **No** (pour 1.0) |
| Medical care or services | **No** |
| Medical claims | **No** — explicitly spiritual experience |
| Telehealth | **No** |
| Pharmaceutical recommendations | **No** |
| Designed for healthcare professionals | **No** |

## ⑨ Store listing

URL : Console → **Main store listing**.

| Champ | Source | Limite |
|---|---|---|
| App name | `Mukti — Libération` | 30 chars |
| Short description | (à reprendre des messages/fr.json) | 80 chars |
| Full description | (à rédiger 4000 chars max — emphase "expérience spirituelle, non médical") | 4 000 chars |
| App icon | `public/icon-512.png` | 512×512 PNG |
| Feature graphic | À générer (1024×500 PNG, gradient + symbole MUKTI) | 1024×500 PNG |
| Phone screenshots | 7-8 captures features clés | 1080×1920 PNG, min 2 max 8 |
| 7-inch tablet | min 1 | 1024×600 PNG min |
| 10-inch tablet | min 1 | 1920×1200 PNG |

**Translations** : pour les 31 autres locales (cf `messages/`), ajouter via Console → Translations → Add translation.

## ⑩ Comments (notes pour reviewers Google)

URL : **App content** → **App access** → **Comments**.

```
DEMO ACCOUNT
Email: demo@purama.dev
Password: MUKTI-demo-{YYYYMMDD}-{4lettres}
Login: open app → "Continuer avec un email" → enter credentials.
Demo has full access (Plan Légende ×10) for review purposes.

ABOUT MUKTI
MUKTI is a SPIRITUAL EXPERIENCE platform — NOT a medical device,
NOT therapeutic, NOT a scientific intervention. It supports addiction
recovery through:
- 20 anti-addiction modes (meditation, hypnosis, breath, somatic)
- Intentional circles (group meditation, audio-first, rotating focus)
- AR Energy Mirror (visual meditation tool, camera-based)
- AURORA OMEGA breath protocols
- C.O.R.E. global presence events

POSITIONING: explicitly spiritual, voluntary, horizontal. No guru,
no expert, no hierarchy. Never claims to "cure" or "treat".
In emergency: 112 (EU), 3114 (FR suicide prevention) immediately
surfaced + permanent disclaimer banner.

ARCHITECTURE
Capacitor / Expo wrapper around https://mukti.purama.dev (live
WebView with native plugins). Hosted on EU infrastructure (OVH
Roubaix, Vercel Frankfurt, Supabase EU). GDPR-native.

MONETIZATION
App is free. Optional subscriptions (9.99 / 49.99 / 99.99 €/mo)
are purchased OUTSIDE the app via Stripe. Compliant with Google
Play User Choice Billing (DMA EU + Korea/Japan alternative billing).
Android-specific: button text can be explicit ("S'abonner — 9,99 €/mois")
unlike iOS where neutral wording is mandatory.

PERMISSIONS RATIONALE
- Camera: AR Energy Mirror (visual meditation, no recording, no
  facial recognition, frames discarded after rendering).
- Microphone: live audio in intentional circles (LiveKit WebRTC,
  no recording, peer-to-peer or SFU).
- Push notifications: scheduled rituals, circle reminders.
- (No background location, no contacts, no SMS/calls access.)

USER-GENERATED CONTENT MODERATION
All circle sessions, posts, comments moderated in real-time by
Claude Haiku 4.5. Zero tolerance for medical claims, harmful advice,
self-harm, hate speech. Flag-and-block on every post. 24h auto-block
on accounts with 3+ flags. Human review by Tissma within 24h.

CONTACT
Matiss Dornier (Founder)
Email: dev@purama.dev
Phone: (set after SASU enrollment)
Available: 9-19 Paris time, M-F.
```

## ⑪ App Links (.well-known/assetlinks.json)

Déployer sur Vercel `public/.well-known/assetlinks.json` :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "dev.purama.mukti",
      "sha256_cert_fingerprints": [
        "<SHA-256 upload key fingerprint>",
        "<SHA-256 Google Play app signing key fingerprint>"
      ]
    }
  }
]
```

Récupérer les fingerprints :
- **Upload key** : `keytool -list -v -keystore mukti-upload.keystore -alias mukti-upload | grep SHA-256`
- **Google Play signing key** : Console → Setup → App signing → SHA-256 certificate fingerprint.

## ⑫ Distribution + Pricing

URL : **Pricing & distribution**.

| Champ | Valeur |
|---|---|
| Price | **Free** |
| Countries | All available (option : exclure Russia, Belarus si jugé approprié) |
| Contains ads | **No** |
| In-app purchases (digital goods) | **No** |
| US export laws compliance | ☑ Compliant |

## ⑬ Stratégie testing tracks

```
Internal testing (Tissma + 2-3 amis)         [Day 1]
    ↓
Closed testing (20-50 ambassadeurs)           [Day 7]
    ↓
SKIP Open testing
    ↓
Production (staged 20% → 50% → 100%)         [Day 21]
```

Tracks à créer :
- **Internal** : auto-créé.
- **Closed** : `closed-beta-mukti-v1` → liste blanche email ou Google Group `mukti-beta@purama.dev`.
- **Production** : staged rollout 20% pendant 24h, vérifier crash rate < 1%, puis 50% → 100%.

## ⑭ Build & upload (.aab)

> Détails framework-spécifiques dans `MOBILE_FRAMEWORK_DECISION.md`.

```bash
# Avec fastlane (preferred)
cd fastlane/android
fastlane build
fastlane upload_internal

# Ou Direct gradle + manual upload
cd android && ./gradlew bundleRelease
# .aab dans android/app/build/outputs/bundle/release/
```

## ⑮ Pre-launch report

Google scanne automatiquement chaque .aab :
- **Crashes** : Google teste sur 5+ devices virtuels.
- **Stability** : ANR detection.
- **Accessibility** : violations TalkBack basiques.
- **Security** : OWASP Mobile Top 10 detection.

URL : **Quality** → **Pre-launch report**. **À LIRE avant chaque promotion vers Production.**

## ⑯ Common rejections anticipated

### "Sensitive data without explicit consent"
**Risque MUKTI** : très élevé (addictions = sensitive).
**Anticipation** : popup de consentement explicite avant chaque session ("J'accepte que mes réponses soient stockées sur OVH HDS pour personnaliser mon parcours") + stocker `profiles.consent_health_data = true` + timestamp.

### "Health claims without disclaimer"
**Risque** : élevé (modes anti-addictions).
**Anticipation** : disclaimer permanent + wording strict "spiritual experience".

### "Data safety form mismatch"
**Anticipation** : aligner Privacy Policy ↔ Data Safety au mot près. Faire un diff avant submit.

### "User-generated content not moderated"
**Anticipation** : montrer dans les notes que la modération AI Haiku 4.5 est temps réel + human review 24h + flag/block buttons.

## Checklist finale avant Submit production

- [ ] Internal testing : 7+ jours sans crash > 1%.
- [ ] Closed testing : 20+ testeurs, feedback collecté.
- [ ] Pre-launch report : 0 critique, 0 high.
- [ ] Data Safety form rempli intégralement.
- [ ] IARC self-rated, certificate received.
- [ ] App content declarations toutes complétées.
- [ ] Demo account credentials à jour, plan `legende`.
- [ ] App Links validés (curl `.well-known/assetlinks.json`).
- [ ] Privacy Policy retourne 200 + RGPD-compliant.
- [ ] Stripe live mode actif (cf `STRIPE_LIVE_CHECKLIST.md`).

## Smoke post-publication

```bash
PACKAGE="dev.purama.mukti"
curl -sI "https://play.google.com/store/apps/details?id=$PACKAGE" | head -1
# Attendu : HTTP/2 200
```
