
CREATE TYPE public.request_status AS ENUM ('open', 'fulfilled', 'closed');

CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  subject text,
  region text,
  board text,
  status public.request_status NOT NULL DEFAULT 'open',
  fulfilled_material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  fulfilled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX material_requests_status_idx ON public.material_requests(status, created_at DESC);
CREATE INDEX material_requests_requester_idx ON public.material_requests(requester_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requests TO authenticated;
GRANT ALL ON public.material_requests TO service_role;

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view requests"
  ON public.material_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own requests"
  ON public.material_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requester or admin can update"
  ON public.material_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = requester_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Contributors can mark fulfilled"
  ON public.material_requests FOR UPDATE
  TO authenticated
  USING (status = 'open')
  WITH CHECK (
    status = 'fulfilled'
    AND fulfilled_by = auth.uid()
    AND fulfilled_material_id IS NOT NULL
  );

CREATE POLICY "Requester or admin can delete"
  ON public.material_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER material_requests_set_updated_at
  BEFORE UPDATE ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.material_request_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

CREATE INDEX material_request_votes_request_idx ON public.material_request_votes(request_id);

GRANT SELECT, INSERT, DELETE ON public.material_request_votes TO authenticated;
GRANT ALL ON public.material_request_votes TO service_role;

ALTER TABLE public.material_request_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view votes"
  ON public.material_request_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users manage their own votes"
  ON public.material_request_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own votes"
  ON public.material_request_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
