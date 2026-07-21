
CREATE POLICY "Users upload own material files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own material files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own material files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own material files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);
