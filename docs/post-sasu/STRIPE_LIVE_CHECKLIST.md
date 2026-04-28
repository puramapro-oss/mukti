# MUKTI — Stripe Live Mode Activation (post-SASU)

> Pas-à-pas pour passer Stripe MUKTI de **test mode** à **live mode** avec activation Connect Embedded V4 + KARMA 50/10/40 + webhook prod.

## État actuel (test mode)

- ✅ Stripe Connect Embedded V4 codé (`src/components/stripe/`).
- ✅ KARMA split 50/10/40 codé (`src/lib/wealth-engine/`).
- ✅ Webhook handler codé (`src/app/api/stripe/webhook/route.ts`).
- ✅ Cancel flow 3 étapes codé.
- ✅ Plans Essentiel / Infini / Légende définis (cf BRIEF VITAE §20.1).
- ⏳ Tout en mode `sk_test_...` — passage live demande KYC SASU + KBIS.

## ① Compte Stripe — KYC business

URL : https://dashboard.stripe.com/account/onboarding

1. **Toggle live mode** (en haut à droite du dashboard).
2. **Activate account** : Stripe demande la KYC business.

Documents à fournir :

| Document | Source |
|---|---|
| KBIS officiel | INPI / Greffe |
| RIB SASU PURAMA | Banque pro (Qonto/Shine/etc.) |
| Carte d'identité Tissma (président) | CNI valide |
| SIREN | KBIS |
| Statut TVA | Régime franchise art. 293B (ou réel si dépassé seuils) |
| Industry | "Wellness / Spiritual services" (closest match) |
| Website | `https://mukti.purama.dev` |
| Description business | "Spiritual wellness platform — non-medical experience supporting addiction recovery through meditation, intentional circles, and conscious practices." |

3. **Address** : `8 Rue de la Chapelle, 25560 Frasne, France`.
4. **Phone** : ligne pro SASU.
5. **Validation** : 2-7 jours ouvrés (variable selon Stripe).

> Si Stripe pose des questions sur "Health claims" → répondre clairement "spiritual, non-clinical, non-therapeutic. We never claim to cure or treat any condition." (même posture qu'Apple/Google review).

## ② Connect Platform activation

URL : https://dashboard.stripe.com/connect/overview

> SHANTI utilise Connect Embedded Components (Account Sessions). MUKTI = même stratégie.

1. **Enable Connect** → choisir **Express** ou **Custom** accounts.
2. **Embedded Components** → Activate.
3. **Branding** : logo MUKTI + couleurs (cohérent design system).
4. **Required information**: France, EU, KYC custom.

> ⚠️ Pas besoin de `STRIPE_CONNECT_CLIENT_ID` (`ca_...`) — c'est UNIQUEMENT pour OAuth/Standard accounts. Embedded Components créent les AccountSessions côté serveur avec `STRIPE_SECRET_KEY` direct (cf §35.12 CLAUDE.md).

## ③ Génération des clés live

URL : https://dashboard.stripe.com/apikeys

| Clé | Format | Usage |
|---|---|---|
| Publishable | `pk_live_...` | Côté client (NEXT_PUBLIC_...) |
| Secret | `sk_live_...` | Côté serveur uniquement |
| Restricted (optional) | `rk_live_...` | Pour CRONs spécifiques |

Stocker dans GitHub secrets + .env.secrets :

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

⚠️ **JAMAIS** committer ces clés. Vérifier `.gitignore` exclut `.env.secrets`.

## ④ Création des Products + Prices

URL : https://dashboard.stripe.com/products

> 3 plans + 1 carte (cf BRIEF VITAE §20.1) :

### Plan Essentiel
- Product : `MUKTI — Plan Essentiel`
- Price : `9,99 €` recurring monthly
- Lookup key : `mukti_essentiel_monthly`
- Description : "Plan Essentiel — multiplicateur gains ×1"

### Plan Infini
- Product : `MUKTI — Plan Infini`
- Price : `49,99 €` recurring monthly
- Lookup key : `mukti_infini_monthly`
- Description : "Plan Infini — multiplicateur gains ×5"

### Plan Légende
- Product : `MUKTI — Plan Légende`
- Price : `99,99 €` recurring monthly
- Lookup key : `mukti_legende_monthly`
- Description : "Plan Légende — multiplicateur gains ×10"

### Carte PURAMA (optionnelle, séparée)
- Product : `Carte PURAMA`
- Price : `0,99 €` recurring monthly
- Lookup key : `purama_card_monthly`
- Description : "Accès Wallet Treezor + retraits IBAN (Phase 2)"

> ⚠️ Carte JAMAIS incluse gratuitement dans un plan (BRIEF VITAE §20.1 — "Gratuite inclusion interdite").

Récupérer les `price_...` IDs et les stocker via Vercel CLI :

```bash
VERCEL_TOKEN=$(grep VERCEL_TOKEN .env.secrets | cut -d= -f2)

printf "price_xxxx\n" | vercel env add STRIPE_PRICE_ESSENTIEL_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_INFINI_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_LEGENDE_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_PURAMA_CARD_MONTHLY production --token $VERCEL_TOKEN
```

> Rappel CLAUDE.md §37 : **JAMAIS** ajouter via dashboard Vercel, **TOUJOURS** via CLI.

## ⑤ Webhook prod

URL : https://dashboard.stripe.com/webhooks → **Add endpoint**

| Champ | Valeur |
|---|---|
| Endpoint URL | `https://mukti.purama.dev/api/stripe/webhook` |
| Description | "MUKTI prod webhook (Stripe → Supabase + KARMA pool)" |
| Events to send | (cf liste ci-dessous) |
| API version | latest (2026-XX-XX) |

Events à activer :

```
checkout.session.completed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end
customer.updated
invoice.payment_succeeded
invoice.payment_failed
charge.refunded
account.updated   # Connect Embedded
account.application.deauthorized
```

→ Récupérer le `whsec_...` :

```bash
printf "whsec_xxxx\n" | vercel env add STRIPE_WEBHOOK_SECRET production --token $VERCEL_TOKEN
```

## ⑥ Vercel env vars finales (live mode)

À ajouter en CLI uniquement (cf §37 CLAUDE.md) :

```bash
VERCEL_TOKEN=$(grep VERCEL_TOKEN .env.secrets | cut -d= -f2)

# Live keys
printf "sk_live_xxxxxx\n" | vercel env add STRIPE_SECRET_KEY production --token $VERCEL_TOKEN
printf "pk_live_xxxxxx\n" | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production --token $VERCEL_TOKEN

# Webhook
printf "whsec_xxxxxx\n" | vercel env add STRIPE_WEBHOOK_SECRET production --token $VERCEL_TOKEN

# Prices
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_ESSENTIEL_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_INFINI_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_LEGENDE_MONTHLY production --token $VERCEL_TOKEN
printf "price_xxxx\n" | vercel env add STRIPE_PRICE_PURAMA_CARD_MONTHLY production --token $VERCEL_TOKEN

# Phase Treezor (Phase 1 par défaut, Phase 2 quand Treezor signé)
printf "1\n" | vercel env add PURAMA_PHASE production --token $VERCEL_TOKEN

# Redeploy obligatoire
vercel --prod --token $VERCEL_TOKEN --yes
```

## ⑦ Test webhook end-to-end

1. **Créer un user test** sur prod : `dev+stripetest@purama.dev`.
2. **Subscribe Plan Essentiel** via Checkout live.
3. **Carte test ***unique pour live*** : `4242 4242 4242 4242` ne marche PAS en live. Utiliser une vraie carte (sera capturée 9,99 €).
4. **Vérifier webhook reçu** : Stripe Dashboard → Webhooks → endpoint → Events delivered.
5. **Vérifier Supabase** : `subscriptions` row insérée + `profiles.plan='essentiel'` + `pool_balances` mis à jour avec 50/10/40 split.
6. **Refund** la subscription (Dashboard Stripe → Subscription → Cancel + Refund) pour pas être facturé.

## ⑧ Pricing live cohérence

Vérifier que les prix Stripe matchent ceux du BRIEF VITAE §20.1 :

```bash
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/prices?limit=10 \
  | jq '.data[] | {id, unit_amount, currency, lookup_key, recurring: .recurring.interval}'
```

Attendu :
```
9,99 €/month  | mukti_essentiel_monthly
49,99 €/month | mukti_infini_monthly
99,99 €/month | mukti_legende_monthly
0,99 €/month  | purama_card_monthly
```

## ⑨ Connect platform — onboarding ambassadeurs

Côté code, l'onboarding ambassadeur Stripe Connect est implémenté avec Embedded Components. Pour activer en live :

1. Dashboard Stripe → Connect → Settings → ☑ "Allow new connected accounts in live mode".
2. **Branding** Connect : logo + couleurs MUKTI (cohérent avec le design system).
3. **Required information** : France, EU. KYC level basique (Express) puis full (Custom) au-delà d'un seuil de revenus annuel par ambassadeur.
4. Tester un ambassadeur test : `/ambassadeur/onboarding` → AccountSession créée → user complete identity → status `active`.

## ⑩ Cancel flow + retention

URL : Dashboard Stripe → Settings → Subscriptions and emails

- ☑ Auto-trigger Stripe customer portal pour cancel (built-in MUKTI).
- ☐ Smart retries (auto-disabled, on gère via cancel flow 3 étapes UX).
- ☑ Customer emails (invoice receipts, dunning, refunds) : laisser ON pour transactionnel basique. Customisation poussée via Resend.

## ⑪ Tax — TVA

| Aspect | Configuration |
|---|---|
| Tax mode | **Inclusive** (prix affichés TTC pour user EU) ou **Exclusive** (HT + TVA séparée) |
| TVA SASU PURAMA | Franchise art. 293B → **TVA non applicable** sur factures |
| Stripe Tax | Désactiver pour 1.0 (franchise = pas de TVA collectée) |
| Si dépassement seuil 91 900 € HT/an | Activer Stripe Tax + ajouter VAT number SASU dans Settings |

> Stripe affiche un message d'erreur si tu actives Tax sans VAT number — ce qui est normal en franchise. Désactiver simplement.

## ⑫ Sécurité Stripe live

Checklist avant go-live :

- [ ] **2FA** activé sur compte Stripe Tissma (sms + authenticator app).
- [ ] **API key restrictions** : si possible utiliser une `rk_live_...` (Restricted Key) pour les CRONs read-only au lieu de `sk_live_...`.
- [ ] **IP allowlist** webhook (optionnel) : `dashboard.stripe.com → Webhooks → endpoint → Restrict to specific IPs`.
- [ ] **Logs Stripe** consultés régulièrement (Dashboard → Developers → Logs).
- [ ] **Notification email** sur événements critiques (refund, dispute, fraud detection).
- [ ] **Radar** (anti-fraud) configuré en mode "Recommended" ou plus strict.

## ⑬ Switch test → live coordination

> Plan d'exécution recommandé pour minimiser downtime :

1. **T0** : KYC SASU validé Stripe.
2. **T+1h** : Products + Prices créés en live.
3. **T+2h** : Vercel env vars CLI updated avec live keys + price IDs + webhook secret.
4. **T+2h30** : `vercel --prod --token $VERCEL_TOKEN --yes` (redeploy avec env live).
5. **T+3h** : Test webhook end-to-end avec vraie carte (cf ⑦).
6. **T+3h30** : Refund le test, vérifier reverse webhook + DB cohérence.
7. **T+4h** : Annonce live (page d'accueil, email beta-testers).

## ⑭ Smoke checks après go-live

```bash
# 1. Compte Stripe en live mode
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/account \
  | jq '{ livemode, country, business_type, charges_enabled, payouts_enabled, requirements_currently_due }'

# 2. Webhook endpoint
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/webhook_endpoints \
  | jq '.data[] | {id, url, status, livemode}'

# 3. Products visibles
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/products?active=true \
  | jq '.data[] | {id, name, livemode}'

# 4. App pricing page
curl -s "https://mukti.purama.dev/pricing" | grep -E "(9,99|49,99|99,99)"
```

## ⑮ Cas où KYC est rejeté

Si Stripe rejette la KYC pour "industry policy violation" (peut arriver avec wording addictions) :

1. **Re-soumettre** avec wording amélioré : "Spiritual wellness experience" au lieu de "addiction support".
2. **Fournir** preuve de positionnement non-clinique (lien vers `mukti.purama.dev/spiritual-positioning` à créer si besoin).
3. **Si rejet répété** → escalade Stripe Support EMEA via dashboard chat. Mention : `France SASU, GDPR-native, EU-only hosting, no medical claims, voluntary spiritual practice`.
4. **Backup** : ouvrir compte Adyen ou Mollie en parallèle (concurrents Stripe en EU). Adyen accepte généralement les apps wellness/spiritual sans friction.

## ⑯ Si tout réussi

Mettre à jour `progress.md` MUKTI section "État définitif" :

```diff
- **Stripe Connect Embedded V4** : abonnements + cancel-flow 3 étapes + ...
+ **Stripe Connect Embedded V4 — LIVE MODE** : abonnements + cancel-flow ...
+   · Plans Essentiel/Infini/Légende activés en live (price_xxxx)
+   · Webhook prod actif `https://mukti.purama.dev/api/stripe/webhook`
+   · KARMA split 50/10/40 actif sur tous paiements
+   · Première activation : ${DATE}
```
