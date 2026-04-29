-- Drop dependent views first
DROP VIEW IF EXISTS public.schedule_safe CASCADE;
DROP VIEW IF EXISTS public.cleaners_safe CASCADE;
DROP VIEW IF EXISTS public.sites_safe CASCADE;
DROP VIEW IF EXISTS public.delivery_log_safe CASCADE;

-- Drop policies depending on cleaner/client roles
DROP POLICY IF EXISTS cleaners_client_via_site ON public.cleaners;
DROP POLICY IF EXISTS cleaners_self ON public.cleaners;
DROP POLICY IF EXISTS sites_cleaner_assigned ON public.sites;
DROP POLICY IF EXISTS sites_client_own ON public.sites;
DROP POLICY IF EXISTS schedule_cleaner_own ON public.schedule;
DROP POLICY IF EXISTS schedule_client_site ON public.schedule;
DROP POLICY IF EXISTS delivery_cleaner_own ON public.delivery_log;
DROP POLICY IF EXISTS delivery_client_site ON public.delivery_log;

CREATE POLICY cleaners_authed_read ON public.cleaners
  FOR SELECT TO authenticated USING (version_id = active_version_id());
CREATE POLICY sites_authed_read ON public.sites
  FOR SELECT TO authenticated USING (version_id = active_version_id());
CREATE POLICY schedule_authed_read ON public.schedule
  FOR SELECT TO authenticated USING (version_id = active_version_id());
CREATE POLICY delivery_authed_read ON public.delivery_log
  FOR SELECT TO authenticated USING (version_id = active_version_id());

DROP FUNCTION IF EXISTS public.current_cleaner_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_client_site_id() CASCADE;

ALTER TABLE public.user_roles DROP COLUMN IF EXISTS cleaner_id;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS site_id;

ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
DELETE FROM public.user_roles WHERE role NOT IN ('admin','staff');
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin','staff');
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Recreate admin RLS policies that were dropped via CASCADE on the enum
CREATE POLICY cleaners_admin_all ON public.cleaners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sites_admin_all ON public.sites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY schedule_admin_all ON public.schedule FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY delivery_admin_all ON public.delivery_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY closures_admin_all ON public.closures FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY versions_admin_write ON public.data_versions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY roles_admin_all ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT
  WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY profiles_self_select ON public.profiles FOR SELECT
  USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE
  USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();