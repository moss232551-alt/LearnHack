CREATE POLICY "room files read for members" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'room-files' AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY "room files upload for members" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'room-files' AND owner = auth.uid() AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY "room files delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'room-files' AND owner = auth.uid());