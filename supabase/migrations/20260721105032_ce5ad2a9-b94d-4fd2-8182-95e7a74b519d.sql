
CREATE TYPE public.appeal_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.material_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  status public.appeal_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX material_appeals_material_id_idx ON public.material_appeals(material_id);
CREATE INDEX material_appeals_user_id_idx ON public.material_appeals(user_id);
CREATE INDEX material_appeals_status_idx ON public.material_appeals(status);
-- Only one pending appeal per material at a time
CREATE UNIQUE INDEX material_appeals_one_pending_per_material
  ON public.material_appeals(material_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.material_appeals TO authenticated;
GRANT ALL ON public.material_appeals TO service_role;

ALTER TABLE public.material_appeals ENABLE ROW LEVEL SECURITY;

-- Contributors can see their own appeals; admins can see all
CREATE POLICY "Users read own appeals, admins read all"
  ON public.material_appeals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Contributors may open an appeal only for materials they uploaded
CREATE POLICY "Contributors create appeals for own materials"
  ON public.material_appeals FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = material_id AND m.created_by = auth.uid()
    )
  );

-- Contributor may edit their own appeal while still pending; admins can update any
CREATE POLICY "Contributors edit own pending; admins update any"
  ON public.material_appeals FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER set_material_appeals_updated_at
  BEFORE UPDATE ON public.material_appeals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
