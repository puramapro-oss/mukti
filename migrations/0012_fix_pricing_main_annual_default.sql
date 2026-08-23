-- MUKTI — Correctif CONFORMITE.md 2026-08-23 (écart #8, "Page admin Pricing qui n'édite
-- pas la vraie constante utilisée par /pricing et Stripe").
--
-- Le seed de 0011_g86_admin_missions.sql a inscrit 79,90€ ('7990' centimes) comme valeur
-- de `admin_settings.pricing_main_annual_cents`, alors que le prix RÉELLEMENT facturé par
-- Stripe checkout est 83,90€ ('8390', `PLANS_STRIPE.main_annual.price_cents` dans
-- src/lib/constants.ts). Avant ce correctif applicatif, ces deux valeurs vivaient
-- séparément (le checkout ignorait `admin_settings`) donc l'écart était invisible.
--
-- Maintenant que `src/lib/stripe.ts` (checkout + anti-churn) et `GET /api/pricing`
-- (page publique /pricing) lisent réellement `admin_settings.pricing_*` en priorité
-- (cf `src/lib/admin-settings.ts` → `getEffectivePriceCents`/`getEffectivePricing`),
-- laisser ce seed stale à 7990 aurait fait BAISSER silencieusement le prix facturé de
-- 83,90€ à 79,90€ au prochain déploiement, sans qu'aucun admin ne l'ait décidé.
--
-- Cette migration aligne la valeur en base sur le prix réellement facturé aujourd'hui
-- (8390) — un admin reste libre de la changer ensuite via /dashboard/admin/pricing,
-- en toute connaissance de cause cette fois (l'UI édite désormais la vraie source).
UPDATE mukti.admin_settings
SET value = '8390'::jsonb
WHERE key = 'pricing_main_annual_cents'
  AND value = '7990'::jsonb;
