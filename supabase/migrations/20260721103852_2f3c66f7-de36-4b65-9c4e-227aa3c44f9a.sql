
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS flag_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS materials_content_hash_idx
  ON public.materials(content_hash)
  WHERE content_hash IS NOT NULL;
