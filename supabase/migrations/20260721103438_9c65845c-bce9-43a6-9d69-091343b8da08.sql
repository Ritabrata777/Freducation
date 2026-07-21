
-- Public moderation transparency: allow authenticated users to read the moderation log
DROP POLICY IF EXISTS "Moderation log readable by authenticated" ON public.moderation_log;
CREATE POLICY "Moderation log readable by authenticated"
  ON public.moderation_log
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.moderation_log TO authenticated;

-- Trusted contributor: 5+ live materials AND zero reports against them (admins always trusted)
CREATE OR REPLACE FUNCTION public.is_trusted_contributor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR (
      (SELECT count(*) FROM public.materials WHERE created_by = _user_id AND status = 'live') >= 5
      AND NOT EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.materials m ON m.id = r.material_id
        WHERE m.created_by = _user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_trusted_contributor(uuid) TO authenticated;
