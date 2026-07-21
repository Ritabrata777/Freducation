
CREATE TABLE public.auto_flag_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  banned_keywords TEXT[] NOT NULL DEFAULT ARRAY['spam','scam','phishing','malware','porn','nsfw','hate','slur','kill yourself','terror','drug deal'],
  min_image_dim INT NOT NULL DEFAULT 400 CHECK (min_image_dim BETWEEN 0 AND 8000),
  link_timeout_ms INT NOT NULL DEFAULT 8000 CHECK (link_timeout_ms BETWEEN 500 AND 60000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.auto_flag_config TO authenticated;
GRANT UPDATE ON public.auto_flag_config TO authenticated;
GRANT ALL ON public.auto_flag_config TO service_role;

ALTER TABLE public.auto_flag_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read auto-flag config"
  ON public.auto_flag_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update auto-flag config"
  ON public.auto_flag_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.auto_flag_config (id) VALUES (true) ON CONFLICT DO NOTHING;
