-- P4 admin /dashboard/admin/financement — pools reward (users) + asso (Solenne) + partner
-- Tables: funding_sources | pool_balances | pool_transactions

SET search_path TO vida_aide;

-- =============================================================================
-- funding_sources — toute entrée d'argent dans l'écosystème
-- =============================================================================
CREATE TABLE IF NOT EXISTS vida_aide.funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'stripe_ca',       -- 10% CA abonnements (auto via webhook)
    'aide_sasu',       -- subvention/aide reçue par SASU → alimente reward_pool
    'aide_asso',       -- subvention reçue par Asso PURAMA → alimente asso_pool
    'partner_deposit', -- entreprise/particulier Stripe → 85% wallet + 15% partner_pool
    'adjustment'       -- ajustement manuel super_admin (correction)
  )),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  source_name TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES vida_aide.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funding_sources_created_at_idx ON vida_aide.funding_sources (created_at DESC);
CREATE INDEX IF NOT EXISTS funding_sources_type_idx ON vida_aide.funding_sources (type);

-- =============================================================================
-- pool_balances — solde live de chaque pool (reward | asso | partner)
-- =============================================================================
CREATE TABLE IF NOT EXISTS vida_aide.pool_balances (
  pool_type TEXT PRIMARY KEY CHECK (pool_type IN ('reward', 'asso', 'partner')),
  balance_cents BIGINT NOT NULL DEFAULT 0,
  total_in_cents BIGINT NOT NULL DEFAULT 0,
  total_out_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 3 pools
INSERT INTO vida_aide.pool_balances (pool_type, balance_cents, total_in_cents, total_out_cents)
VALUES
  ('reward',  0, 0, 0),
  ('asso',    0, 0, 0),
  ('partner', 0, 0, 0)
ON CONFLICT (pool_type) DO NOTHING;

-- =============================================================================
-- pool_transactions — mouvement individuel (in/out) sur un pool
-- =============================================================================
CREATE TABLE IF NOT EXISTS vida_aide.pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_type TEXT NOT NULL REFERENCES vida_aide.pool_balances(pool_type),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  reason TEXT NOT NULL CHECK (reason IN (
    'ca_10pct',          -- webhook Stripe invoice.payment_succeeded (in → reward/asso)
    'aide_deposit',      -- aide SASU ou Asso reçue (in)
    'partner_deposit',   -- dépôt partenaire (in)
    'contest_payout',    -- classement hebdo (out → wallet user)
    'tirage_payout',     -- tirage mensuel (out → wallet user)
    'mission_payout',    -- mission payée (out → wallet user)
    'asso_transfer',     -- transfert asso → Asso PURAMA IBAN (out)
    'adjustment'         -- correction manuelle super_admin
  )),
  source_id UUID,        -- funding_sources.id OU wallet_transactions.id selon contexte
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES vida_aide.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pool_transactions_pool_created_idx ON vida_aide.pool_transactions (pool_type, created_at DESC);
CREATE INDEX IF NOT EXISTS pool_transactions_reason_idx ON vida_aide.pool_transactions (reason);

-- =============================================================================
-- Trigger: mettre à jour pool_balances quand une pool_transaction est insérée
-- =============================================================================
CREATE OR REPLACE FUNCTION vida_aide.apply_pool_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    UPDATE vida_aide.pool_balances
    SET balance_cents = balance_cents + NEW.amount_cents,
        total_in_cents = total_in_cents + NEW.amount_cents,
        updated_at = now()
    WHERE pool_type = NEW.pool_type;
  ELSE
    UPDATE vida_aide.pool_balances
    SET balance_cents = balance_cents - NEW.amount_cents,
        total_out_cents = total_out_cents + NEW.amount_cents,
        updated_at = now()
    WHERE pool_type = NEW.pool_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pool_transactions_apply ON vida_aide.pool_transactions;
CREATE TRIGGER pool_transactions_apply
  AFTER INSERT ON vida_aide.pool_transactions
  FOR EACH ROW
  EXECUTE FUNCTION vida_aide.apply_pool_transaction();

-- =============================================================================
-- RLS : super_admin only (toutes tables)
-- =============================================================================
ALTER TABLE vida_aide.funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE vida_aide.pool_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE vida_aide.pool_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='vida_aide' AND tablename='funding_sources' AND policyname='funding_sources_super_admin') THEN
    CREATE POLICY funding_sources_super_admin ON vida_aide.funding_sources FOR ALL
      USING (EXISTS (SELECT 1 FROM vida_aide.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM vida_aide.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='vida_aide' AND tablename='pool_balances' AND policyname='pool_balances_super_admin_read') THEN
    CREATE POLICY pool_balances_super_admin_read ON vida_aide.pool_balances FOR SELECT
      USING (EXISTS (SELECT 1 FROM vida_aide.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='vida_aide' AND tablename='pool_transactions' AND policyname='pool_transactions_super_admin') THEN
    CREATE POLICY pool_transactions_super_admin ON vida_aide.pool_transactions FOR ALL
      USING (EXISTS (SELECT 1 FROM vida_aide.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM vida_aide.profiles p WHERE p.auth_user_id = auth.uid() AND p.role = 'super_admin'));
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT ON vida_aide.funding_sources TO authenticated;
GRANT SELECT ON vida_aide.pool_balances TO authenticated;
GRANT SELECT, INSERT ON vida_aide.pool_transactions TO authenticated;
GRANT ALL ON vida_aide.funding_sources TO service_role;
GRANT ALL ON vida_aide.pool_balances TO service_role;
GRANT ALL ON vida_aide.pool_transactions TO service_role;
