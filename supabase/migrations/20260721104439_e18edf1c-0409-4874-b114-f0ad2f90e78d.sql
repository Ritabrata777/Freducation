
CREATE TABLE public.page_views (
  id BIGSERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.page_views_id_seq TO anon, authenticated;
GRANT ALL ON public.page_views TO service_role;
GRANT ALL ON SEQUENCE public.page_views_id_seq TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a page view"
  ON public.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);

CREATE OR REPLACE FUNCTION public.total_page_views()
RETURNS BIGINT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO v_count FROM public.page_views;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.total_page_views() TO authenticated;
