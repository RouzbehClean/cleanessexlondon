
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TYPE public.commission_status AS ENUM ('draft','submitted','approved','rejected','sent_to_accounts','paid','clawed_back');
CREATE TYPE public.commission_type AS ENUM ('recurring','bonus','profit');

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_tiers jsonb NOT NULL DEFAULT '[{"min":10,"max":30,"rate":0.50},{"min":31,"max":75,"rate":0.75},{"min":76,"max":null,"rate":1.00}]'::jsonb,
  bonus_tiers jsonb NOT NULL DEFAULT '[{"min":0,"max":10,"amount":25},{"min":10,"max":30,"amount":50},{"min":30,"max":50,"amount":100},{"min":50,"max":null,"amount":250}]'::jsonb,
  profit_rate_identified numeric NOT NULL DEFAULT 0.10,
  profit_rate_created numeric NOT NULL DEFAULT 0.15,
  profit_min_payout numeric NOT NULL DEFAULT 15,
  profit_max_payout numeric NOT NULL DEFAULT 150,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.commission_rules DEFAULT VALUES;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY rules_read ON public.commission_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY rules_write ON public.commission_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL,
  staff_name text,
  type public.commission_type NOT NULL,
  client_or_job text NOT NULL,
  period_month text NOT NULL,
  hours numeric,
  hours_paid_confirmed boolean DEFAULT false,
  contract_hours numeric,
  is_new_contract boolean DEFAULT true,
  profit_amount numeric,
  profit_tier text,
  calculated_amount numeric NOT NULL DEFAULT 0,
  override_amount numeric,
  override_reason text,
  status public.commission_status NOT NULL DEFAULT 'draft',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  rejected_reason text,
  sent_to_accounts_at timestamptz,
  paid_at timestamptz,
  clawback_reason text,
  clawed_back_at timestamptz,
  clawed_back_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comm_entries_staff ON public.commission_entries(staff_user_id);
CREATE INDEX idx_comm_entries_status ON public.commission_entries(status);
CREATE INDEX idx_comm_entries_period ON public.commission_entries(period_month);

ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY entries_select ON public.commission_entries FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid() OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY entries_insert_self ON public.commission_entries FOR INSERT TO authenticated
  WITH CHECK (staff_user_id = auth.uid());
CREATE POLICY entries_update_self ON public.commission_entries FOR UPDATE TO authenticated
  USING (staff_user_id = auth.uid() AND status IN ('draft','rejected'))
  WITH CHECK (staff_user_id = auth.uid());
CREATE POLICY entries_delete_self ON public.commission_entries FOR DELETE TO authenticated
  USING (staff_user_id = auth.uid() AND status IN ('draft','rejected'));
CREATE POLICY entries_owner_admin_all ON public.commission_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_comm_entries_updated BEFORE UPDATE ON public.commission_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comm_rules_updated BEFORE UPDATE ON public.commission_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
