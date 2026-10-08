REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;

DROP POLICY "subjects public read" ON public.subjects;
CREATE POLICY "subjects active read" ON public.subjects FOR SELECT USING (active);
CREATE POLICY "subjects admin read" ON public.subjects FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));