-- ============================================================
-- OVERRIDES LAYER
-- One overrides table per editable entity. Each row represents
-- a staff/admin edit (insert/update or soft-delete) on top of
-- the active uploaded data version.
-- ============================================================

-- Helper enum for override operation
DO $$ BEGIN
  CREATE TYPE public.override_op AS ENUM ('upsert', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SITES OVERRIDES ----------
CREATE TABLE public.sites_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  op public.override_op NOT NULL,
  site_id text NOT NULL,
  payload jsonb,                      -- full intended row for 'upsert', null for 'delete'
  note text,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,   -- admins can revert by setting false
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz
);
CREATE INDEX sites_overrides_lookup_idx ON public.sites_overrides (version_id, site_id, is_active, edited_at DESC);

-- ---------- CLEANERS OVERRIDES ----------
CREATE TABLE public.cleaners_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  op public.override_op NOT NULL,
  cleaner_id text NOT NULL,
  payload jsonb,
  note text,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz
);
CREATE INDEX cleaners_overrides_lookup_idx ON public.cleaners_overrides (version_id, cleaner_id, is_active, edited_at DESC);

-- ---------- SCHEDULE OVERRIDES ----------
CREATE TABLE public.schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  op public.override_op NOT NULL,
  schedule_id text NOT NULL,
  payload jsonb,
  note text,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz
);
CREATE INDEX schedule_overrides_lookup_idx ON public.schedule_overrides (version_id, schedule_id, is_active, edited_at DESC);

-- ---------- DELIVERY OVERRIDES ----------
CREATE TABLE public.delivery_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  op public.override_op NOT NULL,
  delivery_id text NOT NULL,
  payload jsonb,
  note text,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz
);
CREATE INDEX delivery_overrides_lookup_idx ON public.delivery_overrides (version_id, delivery_id, is_active, edited_at DESC);

-- ---------- CLOSURES OVERRIDES ----------
CREATE TABLE public.closures_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL,
  op public.override_op NOT NULL,
  closure_id text NOT NULL,
  payload jsonb,
  note text,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  reverted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reverted_at timestamptz
);
CREATE INDEX closures_overrides_lookup_idx ON public.closures_overrides (version_id, closure_id, is_active, edited_at DESC);

-- ============================================================
-- RLS — staff can read & write overrides; admins can do anything
-- ============================================================
ALTER TABLE public.sites_overrides     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaners_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closures_overrides  ENABLE ROW LEVEL SECURITY;

-- Generic policies via dynamic SQL
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites_overrides','cleaners_overrides','schedule_overrides','delivery_overrides','closures_overrides']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR SELECT TO authenticated
        USING (true);
    $f$, t || '_authed_read', t);

    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR INSERT TO authenticated
        WITH CHECK (edited_by = auth.uid());
    $f$, t || '_authed_insert', t);

    -- Authors can update their own (e.g. fix a typo) while not yet reverted
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR UPDATE TO authenticated
        USING (edited_by = auth.uid() AND is_active = true)
        WITH CHECK (edited_by = auth.uid());
    $f$, t || '_authed_self_update', t);

    -- Admin full access
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I
        FOR ALL
        USING (public.has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
    $f$, t || '_admin_all', t);
  END LOOP;
END $$;

-- ============================================================
-- LIVE VIEWS — merge active version rows with overrides.
-- Logic per entity:
--   1. Find latest active override per (version_id, target_id)
--   2. If latest is 'delete' → row is hidden
--   3. If latest is 'upsert' → return payload (so adds work too)
--   4. Else → return base row from active version
-- security_invoker so the underlying RLS policies are respected.
-- ============================================================

-- ---------- SITES LIVE ----------
CREATE OR REPLACE VIEW public.sites_live
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT DISTINCT ON (version_id, site_id)
    version_id, site_id, op, payload, edited_by, edited_at, id AS override_id
  FROM public.sites_overrides
  WHERE is_active = true
  ORDER BY version_id, site_id, edited_at DESC
)
-- base rows that have no delete/upsert override
SELECT
  s.pk, s.version_id, s.site_id, s.client_name, s.region, s.postcode, s.address,
  s.site_contact_name, s.site_contact_phone, s.site_contact_email,
  s.access_method, s.access_instructions, s.alarm_info, s.cupboard_codes,
  s.products_supplied_by, s.products_notes, s.billing_rate_default,
  s.contract_type, s.term_time_only, s.contract_start, s.contract_end,
  s.team_grouping, s.active, s.pat_test_due, s.hs_folder_last_updated, s.general_notes,
  NULL::uuid AS override_id, NULL::uuid AS edited_by, NULL::timestamptz AS edited_at,
  false AS is_overridden
FROM public.sites s
LEFT JOIN latest l ON l.version_id = s.version_id AND l.site_id = s.site_id
WHERE l.site_id IS NULL
UNION ALL
-- upsert overrides (overlays existing rows OR adds new ones)
SELECT
  COALESCE((l.payload->>'pk')::uuid, l.override_id) AS pk,
  l.version_id,
  l.site_id,
  l.payload->>'client_name', l.payload->>'region', l.payload->>'postcode', l.payload->>'address',
  l.payload->>'site_contact_name', l.payload->>'site_contact_phone', l.payload->>'site_contact_email',
  l.payload->>'access_method', l.payload->>'access_instructions',
  l.payload->>'alarm_info', l.payload->>'cupboard_codes',
  l.payload->>'products_supplied_by', l.payload->>'products_notes',
  NULLIF(l.payload->>'billing_rate_default','')::numeric,
  l.payload->>'contract_type', l.payload->>'term_time_only',
  NULLIF(l.payload->>'contract_start','')::date, NULLIF(l.payload->>'contract_end','')::date,
  l.payload->>'team_grouping', l.payload->>'active',
  NULLIF(l.payload->>'pat_test_due','')::date, NULLIF(l.payload->>'hs_folder_last_updated','')::date,
  l.payload->>'general_notes',
  l.override_id, l.edited_by, l.edited_at, true AS is_overridden
FROM latest l
WHERE l.op = 'upsert';

-- ---------- CLEANERS LIVE ----------
CREATE OR REPLACE VIEW public.cleaners_live
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT DISTINCT ON (version_id, cleaner_id)
    version_id, cleaner_id, op, payload, edited_by, edited_at, id AS override_id
  FROM public.cleaners_overrides
  WHERE is_active = true
  ORDER BY version_id, cleaner_id, edited_at DESC
)
SELECT
  c.pk, c.version_id, c.cleaner_id, c.name, c.phone, c.email, c.region_primary,
  c.employment_type, c.right_to_work_on_file, c.dbs_done, c.dbs_date,
  c.safeguarding_done, c.pat_test_personal_kit, c.team_id, c.active,
  c.sub_nlw_flag, c.notes,
  NULL::uuid AS override_id, NULL::uuid AS edited_by, NULL::timestamptz AS edited_at,
  false AS is_overridden
FROM public.cleaners c
LEFT JOIN latest l ON l.version_id = c.version_id AND l.cleaner_id = c.cleaner_id
WHERE l.cleaner_id IS NULL
UNION ALL
SELECT
  COALESCE((l.payload->>'pk')::uuid, l.override_id) AS pk,
  l.version_id, l.cleaner_id,
  l.payload->>'name', l.payload->>'phone', l.payload->>'email', l.payload->>'region_primary',
  l.payload->>'employment_type', l.payload->>'right_to_work_on_file',
  l.payload->>'dbs_done', NULLIF(l.payload->>'dbs_date','')::date,
  l.payload->>'safeguarding_done', l.payload->>'pat_test_personal_kit',
  l.payload->>'team_id', l.payload->>'active', l.payload->>'sub_nlw_flag', l.payload->>'notes',
  l.override_id, l.edited_by, l.edited_at, true
FROM latest l WHERE l.op = 'upsert';

-- ---------- SCHEDULE LIVE ----------
CREATE OR REPLACE VIEW public.schedule_live
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT DISTINCT ON (version_id, schedule_id)
    version_id, schedule_id, op, payload, edited_by, edited_at, id AS override_id
  FROM public.schedule_overrides
  WHERE is_active = true
  ORDER BY version_id, schedule_id, edited_at DESC
)
SELECT
  s.pk, s.version_id, s.schedule_id, s.site_id, s.cleaner_id,
  s.day_of_week, s.start_time, s.duration_hours, s.shift_group_id,
  s.shift_role, s.pay_rate, s.billing_rate_override,
  s.effective_from, s.effective_to, s.visits_in_apr_2026, s.confidence, s.notes,
  NULL::uuid AS override_id, NULL::uuid AS edited_by, NULL::timestamptz AS edited_at,
  false AS is_overridden
FROM public.schedule s
LEFT JOIN latest l ON l.version_id = s.version_id AND l.schedule_id = s.schedule_id
WHERE l.schedule_id IS NULL
UNION ALL
SELECT
  COALESCE((l.payload->>'pk')::uuid, l.override_id),
  l.version_id, l.schedule_id,
  l.payload->>'site_id', l.payload->>'cleaner_id',
  l.payload->>'day_of_week', l.payload->>'start_time',
  NULLIF(l.payload->>'duration_hours','')::numeric,
  l.payload->>'shift_group_id', l.payload->>'shift_role',
  NULLIF(l.payload->>'pay_rate','')::numeric,
  NULLIF(l.payload->>'billing_rate_override','')::numeric,
  NULLIF(l.payload->>'effective_from','')::date,
  NULLIF(l.payload->>'effective_to','')::date,
  NULLIF(l.payload->>'visits_in_apr_2026','')::int,
  l.payload->>'confidence', l.payload->>'notes',
  l.override_id, l.edited_by, l.edited_at, true
FROM latest l WHERE l.op = 'upsert';

-- ---------- DELIVERY LIVE ----------
CREATE OR REPLACE VIEW public.delivery_live
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT DISTINCT ON (version_id, delivery_id)
    version_id, delivery_id, op, payload, edited_by, edited_at, id AS override_id
  FROM public.delivery_overrides
  WHERE is_active = true
  ORDER BY version_id, delivery_id, edited_at DESC
)
SELECT
  d.pk, d.version_id, d.delivery_id, d.date, d.site_id, d.cleaner_id,
  d.hours_clocked, d.pay_rate_at_time, d.source, d.notes,
  NULL::uuid AS override_id, NULL::uuid AS edited_by, NULL::timestamptz AS edited_at,
  false AS is_overridden
FROM public.delivery_log d
LEFT JOIN latest l ON l.version_id = d.version_id AND l.delivery_id = d.delivery_id
WHERE l.delivery_id IS NULL
UNION ALL
SELECT
  COALESCE((l.payload->>'pk')::uuid, l.override_id),
  l.version_id, l.delivery_id,
  NULLIF(l.payload->>'date','')::date,
  l.payload->>'site_id', l.payload->>'cleaner_id',
  NULLIF(l.payload->>'hours_clocked','')::numeric,
  NULLIF(l.payload->>'pay_rate_at_time','')::numeric,
  l.payload->>'source', l.payload->>'notes',
  l.override_id, l.edited_by, l.edited_at, true
FROM latest l WHERE l.op = 'upsert';

-- ---------- CLOSURES LIVE ----------
CREATE OR REPLACE VIEW public.closures_live
WITH (security_invoker = on) AS
WITH latest AS (
  SELECT DISTINCT ON (version_id, closure_id)
    version_id, closure_id, op, payload, edited_by, edited_at, id AS override_id
  FROM public.closures_overrides
  WHERE is_active = true
  ORDER BY version_id, closure_id, edited_at DESC
)
SELECT
  c.pk, c.version_id, c.closure_id, c.date, c.type, c.affects, c.description,
  NULL::uuid AS override_id, NULL::uuid AS edited_by, NULL::timestamptz AS edited_at,
  false AS is_overridden
FROM public.closures c
LEFT JOIN latest l ON l.version_id = c.version_id AND l.closure_id = c.closure_id
WHERE l.closure_id IS NULL
UNION ALL
SELECT
  COALESCE((l.payload->>'pk')::uuid, l.override_id),
  l.version_id, l.closure_id,
  NULLIF(l.payload->>'date','')::date,
  l.payload->>'type', l.payload->>'affects', l.payload->>'description',
  l.override_id, l.edited_by, l.edited_at, true
FROM latest l WHERE l.op = 'upsert';
