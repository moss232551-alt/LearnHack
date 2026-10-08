ALTER TABLE public.study_rooms ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id);
ALTER TABLE public.study_rooms ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT '';

CREATE TABLE public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.room_messages TO authenticated;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room messages member read" ON public.room_messages FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room messages member insert" ON public.room_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room messages self delete" ON public.room_messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX room_messages_room_idx ON public.room_messages (room_id, created_at);

CREATE TABLE public.room_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_files TO authenticated;
GRANT ALL ON public.room_files TO service_role;
ALTER TABLE public.room_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room files member read" ON public.room_files FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room files uploader write" ON public.room_files FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "room files uploader update" ON public.room_files FOR UPDATE TO authenticated USING (uploader_id = auth.uid()) WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "room files uploader delete" ON public.room_files FOR DELETE TO authenticated USING (uploader_id = auth.uid());

CREATE TABLE public.host_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, reviewer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.host_reviews TO authenticated;
GRANT SELECT ON public.host_reviews TO anon;
GRANT ALL ON public.host_reviews TO service_role;
ALTER TABLE public.host_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host reviews public read" ON public.host_reviews FOR SELECT USING (true);
CREATE POLICY "host reviews reviewer insert" ON public.host_reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid() AND reviewer_id <> host_id AND rating BETWEEN 1 AND 5 AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "host reviews reviewer update" ON public.host_reviews FOR UPDATE TO authenticated USING (reviewer_id = auth.uid()) WITH CHECK (reviewer_id = auth.uid() AND rating BETWEEN 1 AND 5);

CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  current_index integer NOT NULL DEFAULT 0,
  question_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_sessions TO service_role;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games member read" ON public.game_sessions FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
CREATE POLICY "games host insert" ON public.game_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid() AND public.is_room_member(room_id, auth.uid()));
CREATE POLICY "games host update" ON public.game_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

CREATE TABLE public.game_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_index integer NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id, question_index)
);
GRANT SELECT, INSERT ON public.game_answers TO authenticated;
GRANT ALL ON public.game_answers TO service_role;
ALTER TABLE public.game_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game answers room read" ON public.game_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.game_sessions g WHERE g.id = game_answers.game_id AND public.is_room_member(g.room_id, auth.uid())));
CREATE POLICY "game answers self insert" ON public.game_answers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.game_sessions g WHERE g.id = game_answers.game_id AND public.is_room_member(g.room_id, auth.uid())));

ALTER TABLE public.room_messages REPLICA IDENTITY FULL;
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_answers REPLICA IDENTITY FULL;
ALTER TABLE public.room_files REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_files;