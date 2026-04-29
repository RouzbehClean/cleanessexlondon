
INSERT INTO storage.buckets (id, name, public) VALUES ('seed-files', 'seed-files', false);
CREATE POLICY "seed_admin_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'seed-files' AND public.has_role(auth.uid(), 'admin'));
