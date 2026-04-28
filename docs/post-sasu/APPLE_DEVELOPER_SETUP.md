# MUKTI — Apple Developer + App Store Connect (post-SASU)

> Pas-à-pas pour activer le compte Apple Developer SASU PURAMA et préparer la première soumission MUKTI sur l'App Store.

## ① D-U-N-S Number (5-15 jours)

> Pré-requis Apple : toute entité légale doit avoir un D-U-N-S Number délivré par Dun & Bradstreet. **Gratuit** pour SASU France.

URL : https://developer.apple.com/enrollment/duns-lookup/

1. Lookup : entrer "PURAMA" + adresse `8 Rue de la Chapelle, 25560 Frasne`.
2. Si pas trouvé → "Request a D-U-N-S Number" → form D&B France.
3. D&B vérifie KBIS (joindre le PDF KBIS officiel).
4. **Délai** : 5-9 jours ouvrés (pic 15j en haute saison).
5. Reçoit D-U-N-S à 9 chiffres par email → noter dans `.env.secrets`.

```env
APPLE_DUNS=999999999  # remplacer après réception
```

## ② Apple Developer Program enrollment (24-48h)

URL : https://developer.apple.com/programs/enroll/

1. **Sign in** avec Apple ID Tissma (`matiss.frasne@gmail.com`).
2. **Entity Type** : **Organization** (pas Individual).
3. **Legal Entity Name** : `PURAMA` (exact match KBIS).
4. **D-U-N-S** : la valeur reçue à l'étape ①.
5. **Address** : `8 Rue de la Chapelle, 25560 Frasne, France`.
6. **Phone** : ligne pro SASU.
7. **Website** : `https://purama.dev`.
8. **Role** : Tissma = "Senior Manager / Principal" (signataire).
9. **Payment** : 99 € / an, carte SASU.
10. Apple appelle le numéro fourni pour vérifier (1-3j ouvrés).
11. Approbation → email "Welcome to the Apple Developer Program".

**Output attendu** :
- Apple Team ID (10 chars) → noter dans `.env.secrets`.

```env
APPLE_TEAM_ID=ABC123XYZ4
APPLE_ID=matiss.frasne@gmail.com
```

## ③ App Store Connect API Key

URL : https://appstoreconnect.apple.com/access/api

1. **Users and Access** → onglet **Keys**.
2. **Generate API Key** → role **App Manager**.
3. Télécharger `AuthKey_XXXXXX.p8` (UNE SEULE fois — Apple ne le re-télécharge plus).
4. Noter Key ID + Issuer ID.

```env
APPLE_KEY_ID=XXXXXXXXXX
APPLE_ISSUER_ID=69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx
APPLE_PRIVATE_KEY_BASE64=$(base64 < AuthKey_XXXXXX.p8)
```

## ④ App-Specific Password (pour fastlane upload)

URL : https://account.apple.com/account/manage → **Security** → **App-Specific Passwords**.

1. **Generate** → label "fastlane MUKTI".
2. Format : `xxxx-xxxx-xxxx-xxxx`.
3. Stocker en GitHub secret + .env.secrets.

```env
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

## ⑤ Création de l'app dans App Store Connect

URL : https://appstoreconnect.apple.com/apps → **+** → **New App**

| Champ | Valeur |
|---|---|
| Platforms | iOS |
| Name | `Mukti — Libération` (≤ 30 chars) |
| Primary Language | French |
| Bundle ID | `dev.purama.mukti` (créer si absent dans Identifiers) |
| SKU | `mukti-ios-2026` |
| User Access | Full Access |

## ⑥ Bundle ID + Capabilities

Apple Developer → **Certificates, IDs & Profiles** → **Identifiers** → **+** → App IDs → App.

| Champ | Valeur |
|---|---|
| Description | `MUKTI iOS` |
| Bundle ID | Explicit `dev.purama.mukti` |
| Capabilities | ☑ Push Notifications, ☑ Associated Domains, ☑ Sign in with Apple |

> **Sign in with Apple** : ajouter même si pas implémenté en 1.0 (Apple peut le demander en review si Google OAuth présent — Guideline 4.8).

## ⑦ App Information

URL : App Store Connect → MUKTI → **App Information**

| Champ | Valeur |
|---|---|
| Subtitle (FR) | `Libération · cercles · soin` (≤ 30 chars) |
| Privacy Policy URL | `https://mukti.purama.dev/politique-confidentialite` |
| Category Primary | **Health & Fitness** |
| Category Secondary | **Lifestyle** |
| Content Rights | ☑ Yes — original content |

## ⑧ Pricing & Availability

| Champ | Valeur |
|---|---|
| Price | **Free** |
| Availability | All countries (sauf restrictions Apple : Russie, Bélarus optionnels) |
| App Distribution Methods | App Store + TestFlight |

> **Pas d'IAP**. Stripe externe via Safari deep link (cf `STRIPE_LIVE_CHECKLIST.md`). Wording bouton iOS = neutre uniquement ("Continuer", "Activer mes avantages").

## ⑨ App Review Information — bloc Notes critique MUKTI

> **À copier-coller dans App Store Connect → App Review Information → Notes** :

```
DEMO ACCOUNT
Email: demo@purama.dev
Password: MUKTI-demo-{YYYYMMDD}-{4lettres}
Note: regenerated 24h before submission. Has full access to all
20 anti-addiction modes, intention circles, AURORA OMEGA breath,
AR Energy Mirror, and C.O.R.E. global events.

WHAT IS MUKTI
MUKTI ("liberation" in Sanskrit) is a SPIRITUAL EXPERIENCE platform
designed to support people seeking liberation from addictive patterns
through:
1. 20 anti-addiction modes (meditation, hypnosis, breath, somatic,
   visualization — non-clinical)
2. Intentional circles (live group meditation, audio-first, rotating
   focus on each member)
3. AR Energy Mirror (camera-based visualization of personal energy
   field — visual support, not measurement)
4. AURORA OMEGA breath protocols (cardiac coherence, focus, sleep)
5. C.O.R.E. global presence events (synchronized worldwide intentions)

CRITICAL POSITIONING — IMPORTANT FOR REVIEW
MUKTI is NOT a medical device. NOT a therapeutic tool. NOT a
scientific intervention. NOT clinical advice. It is explicitly
positioned as a SPIRITUAL EXPERIENCE — voluntary, intentional,
horizontal (no hierarchy, no guru, no expert).

The app NEVER claims to "cure", "treat", "heal" any addiction or
disease. It uses only language of "support", "accompaniment",
"companionship", "liberation in the spiritual sense".

In case of medical emergency, the app immediately surfaces:
- 112 (European Union emergency)
- 3114 (French national suicide prevention)
- 15 (French SAMU)
- App displays a permanent disclaimer banner above all sessions.

ARCHITECTURE
- App is built with [Capacitor 8 / Expo — see MOBILE_FRAMEWORK_DECISION].
- All data hosted in EU (OVH, Vercel Frankfurt, Supabase EU).
- GDPR-native: full data export (art. 20) and deletion (art. 17)
  available at /profile/privacy/{export,delete}.

CAMERA + MICROPHONE PERMISSIONS
- Camera: used ONLY for AR Energy Mirror (a visual meditation tool).
  No photo/video saved to disk. No biometric analysis. No facial
  recognition. Camera frames processed in-memory and discarded.
  Permission requested in-context with clear explanation.
- Microphone: used ONLY for live audio in intentional circles
  (group meditation, voice-on-voice). No recording stored. Not
  transmitted outside the live session. WebRTC peer-to-peer
  (LiveKit Cloud / SFU).

USER-GENERATED CONTENT MODERATION
- All circle sessions, forum posts, "gratitudes", "réalisations" are
  moderated in real-time by Claude Haiku 4.5 (AI moderation).
- Zero tolerance for: medical claims, harmful health advice,
  self-harm content, hate speech, harassment, product placement.
- A flag-and-block button is on every post and session.
- 24h block on accounts with 3+ flags. Human review (Tissma) within 24h.

MONETIZATION
- App is FREE on App Store.
- Optional subscriptions (9,99€ / 49,99€ / 99,99€ per month) are
  purchased OUTSIDE the app via Safari at https://mukti.purama.dev/subscribe.
- The "Continue" button opens an external Safari URL — never a
  StoreKit IAP modal. We follow Guideline 3.1.3(a) Reader app pattern.
- Buttons are neutral ("Continue", "Unlock my benefits", "Activate"),
  never "Subscribe" or with prices.

CONTACT
Matiss Dornier (Founder, Developer)
Email: dev@purama.dev
Phone: (SASU pro line, set after enrollment)
Available: 9-19 Paris time, M-F.
Response within 4h via email for any clarification request.

THANK YOU
We've designed MUKTI with deep respect for App Store guidelines and
user safety. The "spiritual experience, not medical" positioning is
central to our identity, not a workaround. Thank you for your time.
```

## ⑩ Age Rating

| Question | Réponse |
|---|---|
| Mature/Suggestive Themes | **Infrequent/Mild** (addictions referenced) |
| Medical/Treatment Information | **Infrequent/Mild** (general wellness, non-clinical) |
| Self-harm references | **Yes — clinical safety references only** (3114, 112 — protective, not depicting) |
| Drug Use References | **Infrequent/Mild** (addictions discussed conceptually, never glorified) |
| Unrestricted Web Access | **No** |
| User-generated content | **Yes — moderated** |

**Résultat attendu** : `12+` (à cause des références addictions). C'est OK et cohérent avec le positionnement.

## ⑪ App Privacy form (data collection)

Catégories à cocher :

| Catégorie | Collected | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Email Address | ✅ | App functionality, Account | ✅ | ❌ |
| Health & Fitness | ✅ | App functionality (addictions self-declared) | ✅ | ❌ |
| Sensitive Info | ✅ | App functionality (mental health, spirituality) | ✅ | ❌ |
| Photos and Videos | ❌ (pas de stockage caméra) | — | — | — |
| Audio | ❌ (live only, pas de recording) | — | — | — |
| User Content | ✅ | App functionality (circle posts, gratitudes) | ✅ | ❌ |
| User ID | ✅ | App functionality | ✅ | ❌ |
| Crash Data | ✅ | Diagnostics | ❌ | ❌ |
| Product Interaction | ✅ | Analytics (PostHog EU) | ✅ | ❌ |

> **Tracking : aucun** (pas d'IDFA, pas de cross-app tracking, pas d'ads SDK). Pas de dialogue ATT requis.

## ⑫ Tax + Banking

Cf. SHANTI's `apple-connect/07-tax-and-banking.md` — la procédure W-8BEN-E + Banking est **identique** pour MUKTI (même SASU).

> Comme SHANTI, MUKTI n'a PAS d'IAP, donc Banking est en pratique optionnel mais à remplir au cas où on ajoute des IAP futurs.

## ⑬ Submission flow

1. Build .ipa via fastlane (cf. `MOBILE_FRAMEWORK_DECISION.md` selon Capacitor/Expo choix).
2. Upload TestFlight → wait processing 5-10 min.
3. Test interne (Tissma + 1-3 amis).
4. Submit Build → Version 1.0 → cocher build → **Submit for Review**.
5. Status : **Waiting for Review** (24-72h) → **In Review** (4-24h) → **Approved** ou **Rejected**.

## ⑭ Rejets fréquents anticipés MUKTI

### Guideline 1.4.1 (Safety / Physical harm)
**Risque haut MUKTI** car app addictions.
**Anticipation** : disclaimer permanent + AI safety net 3114 + bouton call rapide accessible partout.

### Guideline 5.1.1 (Health-related claims)
**Risque haut MUKTI** car features comme "hypnose" et "soins énergétiques".
**Anticipation** : wording strict "expérience spirituelle" + "pas de claim médical" répété + disclaimers sur chaque feature sensible.

### Guideline 4.0 (Minimum functionality)
**Risque** si l'app paraît être juste un site web emballé.
**Anticipation** : démontrer plugins natifs (push, haptics, partage iOS, AR via caméra native).

### Guideline 5.6 (Code of Conduct / Spiritual practices)
**Risque modéré** : Apple peut être méfiant des apps "spirituelles" associées à addictions.
**Anticipation** : insister sur consentement explicite + sortie libre + zéro hiérarchie + zéro gourou.

## ⑮ Universal Links

Déployer sur Vercel `public/.well-known/apple-app-site-association` :

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABC123XYZ4.dev.purama.mukti",
        "paths": ["/app/*", "/auth/callback", "/subscribe/return", "/cercle/*"]
      }
    ]
  }
}
```

> Remplacer `ABC123XYZ4` par le vrai Apple Team ID après ②.

## Checklist finale avant Submit

- [ ] Demo account testé `curl POST /api/auth/signin` → 200, plan `legende`.
- [ ] Disclaimer 112/3114 visible sur écran de chaque module sensible.
- [ ] Aucun mot "Subscribe", "Abonner", "9,99", "49,99", "99,99", "€/mois" dans l'app iOS bundlée.
- [ ] Push Notifications fonctionnelles (test sur TestFlight).
- [ ] Haptic feedback sur AURORA OMEGA respiration.
- [ ] Caméra AR Energy Mirror demande permission en contexte avec explication FR + EN.
- [ ] Microphone Cercles demande permission en contexte.
- [ ] Build TestFlight stable 30 min sans crash.
- [ ] App Privacy form rempli intégralement.
- [ ] Privacy Policy URL retourne 200 + contenu lisible (FR + EN min).
- [ ] Universal Links validés (`curl -sI https://mukti.purama.dev/.well-known/apple-app-site-association`).
- [ ] Sign in with Apple capability activée (au cas où Apple le demande en review).

## Smoke post-approval

```bash
APPLE_ID="<numeric_id_from_app_store_connect>"
curl -sI "https://apps.apple.com/fr/app/mukti-liberation/id$APPLE_ID" | head -1
# Attendu : HTTP/2 200
```
