
CREATE TABLE public.material_comment_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.material_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.material_comment_votes TO authenticated;
GRANT ALL ON public.material_comment_votes TO service_role;
ALTER TABLE public.material_comment_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view helpful votes"
  ON public.material_comment_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add their own helpful vote"
  ON public.material_comment_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own helpful vote"
  ON public.material_comment_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX material_comment_votes_comment_idx ON public.material_comment_votes(comment_id);
