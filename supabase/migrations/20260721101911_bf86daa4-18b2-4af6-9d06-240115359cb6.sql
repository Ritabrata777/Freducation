
CREATE TYPE public.moderation_action AS ENUM (
  'material_status_change',
  'material_delete',
  'user_delete',
  'report_dismiss'
);

CREATE TYPE public.moderation_target AS ENUM ('material', 'user', 'report');

CREATE TABLE public.moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action public.moderation_action NOT NULL,
  target_type public.moderation_target NOT NULL,
  target_id UUID,
  target_label TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX moderation_log_created_idx ON public.moderation_log (created_at DESC);
CREATE INDEX moderation_log_actor_idx ON public.moderation_log (actor_id);
CREATE INDEX moderation_log_target_idx ON public.moderation_log (target_type, target_id);

GRANT SELECT ON public.moderation_log TO authenticated;
GRANT ALL ON public.moderation_log TO service_role;

ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read moderation log"
  ON public.moderation_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
