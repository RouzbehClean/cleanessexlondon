
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_cleaner_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_client_site_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.active_version_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
