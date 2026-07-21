ALTER TABLE public.material_appeals
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.material_appeals
  DROP CONSTRAINT IF EXISTS material_appeals_evidence_shape_check;
ALTER TABLE public.material_appeals
  ADD CONSTRAINT material_appeals_evidence_shape_check
  CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) <= 10);