
CREATE TYPE public.progress_status AS ENUM ('reading', 'completed', 'saved');

CREATE TABLE public.material_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  status public.progress_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE INDEX material_progress_user_status_idx ON public.material_progress(user_id, status);
CREATE INDEX material_progress_material_idx ON public.material_progress(material_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_progress TO authenticated;
GRANT ALL ON public.material_progress TO service_role;

ALTER TABLE public.material_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own progress"
  ON public.material_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress"
  ON public.material_progress FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER material_progress_set_updated_at
  BEFORE UPDATE ON public.material_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
