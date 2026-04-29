
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'cleaner', 'client');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate table — prevents privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  cleaner_id TEXT,    -- when role='cleaner'
  site_id TEXT,       -- when role='client'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- has_role() — SECURITY DEFINER avoids RLS recursion
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_cleaner_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cleaner_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'cleaner'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_client_site_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT site_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'client'
  LIMIT 1
$$;

-- =========================================================
-- DATA VERSIONS
-- =========================================================
CREATE TABLE public.data_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  source_filename TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  row_counts JSONB
);
ALTER TABLE public.data_versions ENABLE ROW LEVEL SECURITY;

-- Only one active version at a time
CREATE UNIQUE INDEX one_active_version ON public.data_versions(is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.active_version_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.data_versions WHERE is_active = true LIMIT 1
$$;

-- =========================================================
-- DATA TABLES (mirror spreadsheet; each tagged with version_id)
-- =========================================================
CREATE TABLE public.sites (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.data_versions(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  client_name TEXT,
  region TEXT,
  postcode TEXT,
  address TEXT,
  site_contact_name TEXT,
  site_contact_phone TEXT,
  site_contact_email TEXT,
  access_method TEXT,
  access_instructions TEXT,
  alarm_info TEXT,
  cupboard_codes TEXT,
  products_supplied_by TEXT,
  products_notes TEXT,
  billing_rate_default NUMERIC,
  contract_type TEXT,
  term_time_only TEXT,
  contract_start DATE,
  contract_end DATE,
  active TEXT,
  pat_test_due DATE,
  hs_folder_last_updated DATE,
  general_notes TEXT,
  team_grouping TEXT,
  UNIQUE (version_id, site_id)
);
CREATE INDEX sites_version_idx ON public.sites(version_id);
CREATE INDEX sites_siteid_idx ON public.sites(site_id);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cleaners (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.data_versions(id) ON DELETE CASCADE,
  cleaner_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  region_primary TEXT,
  employment_type TEXT,
  right_to_work_on_file TEXT,
  dbs_done TEXT,
  dbs_date DATE,
  safeguarding_done TEXT,
  pat_test_personal_kit TEXT,
  team_id TEXT,
  active TEXT,
  sub_nlw_flag TEXT,
  notes TEXT,
  UNIQUE (version_id, cleaner_id)
);
CREATE INDEX cleaners_version_idx ON public.cleaners(version_id);
CREATE INDEX cleaners_cleanerid_idx ON public.cleaners(cleaner_id);
ALTER TABLE public.cleaners ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.schedule (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.data_versions(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  cleaner_id TEXT NOT NULL,
  day_of_week TEXT,
  start_time TEXT,
  duration_hours NUMERIC,
  shift_group_id TEXT,
  pay_rate NUMERIC,
  billing_rate_override NUMERIC,
  effective_from DATE,
  effective_to DATE,
  shift_role TEXT,
  visits_in_apr_2026 INTEGER,
  confidence TEXT,
  notes TEXT,
  UNIQUE (version_id, schedule_id)
);
CREATE INDEX schedule_version_idx ON public.schedule(version_id);
CREATE INDEX schedule_site_idx ON public.schedule(version_id, site_id);
CREATE INDEX schedule_cleaner_idx ON public.schedule(version_id, cleaner_id);
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.closures (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.data_versions(id) ON DELETE CASCADE,
  closure_id TEXT NOT NULL,
  date DATE,
  type TEXT,
  affects TEXT,
  description TEXT,
  UNIQUE (version_id, closure_id)
);
CREATE INDEX closures_version_idx ON public.closures(version_id);
ALTER TABLE public.closures ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.delivery_log (
  pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.data_versions(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL,
  date DATE,
  site_id TEXT NOT NULL,
  cleaner_id TEXT NOT NULL,
  hours_clocked NUMERIC,
  pay_rate_at_time NUMERIC,
  source TEXT,
  notes TEXT,
  UNIQUE (version_id, delivery_id)
);
CREATE INDEX delivery_version_idx ON public.delivery_log(version_id);
CREATE INDEX delivery_site_idx ON public.delivery_log(version_id, site_id);
CREATE INDEX delivery_cleaner_idx ON public.delivery_log(version_id, cleaner_id);
ALTER TABLE public.delivery_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles: own row + admin all
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- user_roles: self read, admin manage
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- data_versions: admin write, all authed read
CREATE POLICY "versions_authed_read" ON public.data_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "versions_admin_write" ON public.data_versions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sites
CREATE POLICY "sites_admin_all" ON public.sites FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sites_client_own" ON public.sites FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'client')
  AND site_id = public.current_client_site_id()
);
CREATE POLICY "sites_cleaner_assigned" ON public.sites FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'cleaner')
  AND site_id IN (
    SELECT site_id FROM public.schedule
    WHERE version_id = public.active_version_id()
      AND cleaner_id = public.current_cleaner_id()
  )
);

-- cleaners
CREATE POLICY "cleaners_admin_all" ON public.cleaners FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cleaners_self" ON public.cleaners FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'cleaner')
  AND cleaner_id = public.current_cleaner_id()
);
-- Clients can see cleaner names for their site only (via view, but base policy allows row read; column hiding done via view)
CREATE POLICY "cleaners_client_via_site" ON public.cleaners FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'client')
  AND cleaner_id IN (
    SELECT cleaner_id FROM public.schedule
    WHERE version_id = public.active_version_id()
      AND site_id = public.current_client_site_id()
  )
);

-- schedule
CREATE POLICY "schedule_admin_all" ON public.schedule FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "schedule_cleaner_own" ON public.schedule FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'cleaner')
  AND cleaner_id = public.current_cleaner_id()
);
CREATE POLICY "schedule_client_site" ON public.schedule FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'client')
  AND site_id = public.current_client_site_id()
);

-- closures: all authed read active version
CREATE POLICY "closures_admin_all" ON public.closures FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "closures_authed_read" ON public.closures FOR SELECT TO authenticated USING (version_id = public.active_version_id());

-- delivery_log
CREATE POLICY "delivery_admin_all" ON public.delivery_log FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delivery_cleaner_own" ON public.delivery_log FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'cleaner')
  AND cleaner_id = public.current_cleaner_id()
);
CREATE POLICY "delivery_client_site" ON public.delivery_log FOR SELECT USING (
  version_id = public.active_version_id()
  AND public.has_role(auth.uid(), 'client')
  AND site_id = public.current_client_site_id()
);

-- =========================================================
-- COLUMN-STRIPPED VIEWS (hide pay/billing rate from non-admins)
-- =========================================================
CREATE VIEW public.schedule_safe
WITH (security_invoker = true)
AS
SELECT
  pk, version_id, schedule_id, site_id, cleaner_id, day_of_week, start_time,
  duration_hours, shift_group_id,
  CASE WHEN public.has_role(auth.uid(), 'admin') OR (public.has_role(auth.uid(), 'cleaner') AND cleaner_id = public.current_cleaner_id())
       THEN pay_rate ELSE NULL END AS pay_rate,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN billing_rate_override ELSE NULL END AS billing_rate_override,
  effective_from, effective_to, shift_role, visits_in_apr_2026, confidence, notes
FROM public.schedule;

CREATE VIEW public.sites_safe
WITH (security_invoker = true)
AS
SELECT
  pk, version_id, site_id, client_name, region, postcode, address,
  site_contact_name, site_contact_phone, site_contact_email,
  access_method, access_instructions, alarm_info, cupboard_codes,
  products_supplied_by, products_notes,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN billing_rate_default ELSE NULL END AS billing_rate_default,
  contract_type, term_time_only, contract_start, contract_end, active,
  pat_test_due, hs_folder_last_updated, general_notes, team_grouping
FROM public.sites;

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- STORAGE BUCKET (private) for xlsx uploads
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('data-uploads', 'data-uploads', false);

CREATE POLICY "uploads_admin_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'data-uploads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "uploads_admin_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'data-uploads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "uploads_admin_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'data-uploads' AND public.has_role(auth.uid(), 'admin'));
