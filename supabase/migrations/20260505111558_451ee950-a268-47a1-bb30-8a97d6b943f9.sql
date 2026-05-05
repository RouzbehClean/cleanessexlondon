ALTER TABLE public.cleaners
  ADD COLUMN IF NOT EXISTS starter_checklist_completed text,
  ADD COLUMN IF NOT EXISTS id_document_type text,
  ADD COLUMN IF NOT EXISTS right_to_work_expiry date;