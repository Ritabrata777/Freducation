CREATE OR REPLACE FUNCTION public.anonymous_page_views()
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT count(*) INTO v_count FROM public.page_views WHERE user_id IS NULL;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonymous_page_views() TO authenticated;