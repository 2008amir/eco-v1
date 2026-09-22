
CREATE POLICY "Community images read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'community-images');
CREATE POLICY "Community images upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Community images update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Community images delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Community files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'community-files');
CREATE POLICY "Community files upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Community files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-files' AND auth.uid()::text = (storage.foldername(name))[1]);
