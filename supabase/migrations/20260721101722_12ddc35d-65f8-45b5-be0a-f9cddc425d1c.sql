
CREATE TYPE public.comment_kind AS ENUM ('comment', 'question', 'answer');

CREATE TABLE public.material_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.material_comments(id) ON DELETE CASCADE,
  kind public.comment_kind NOT NULL DEFAULT 'comment',
  body TEXT NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX material_comments_material_idx ON public.material_comments (material_id, created_at);
CREATE INDEX material_comments_parent_idx ON public.material_comments (parent_id);
CREATE INDEX material_comments_user_idx ON public.material_comments (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_comments TO authenticated;
GRANT ALL ON public.material_comments TO service_role;

ALTER TABLE public.material_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read comments"
  ON public.material_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can post their own comments"
  ON public.material_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit their own comments"
  ON public.material_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own or admins any"
  ON public.material_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER material_comments_set_updated_at
  BEFORE UPDATE ON public.material_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
