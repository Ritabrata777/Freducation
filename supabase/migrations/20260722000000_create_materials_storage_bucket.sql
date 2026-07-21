-- Create the private "materials" storage bucket used for uploads.
-- RLS policies for this bucket are defined in 20260721081542_55b86111-1b22-4593-af47-fb4f412a90f1.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;
