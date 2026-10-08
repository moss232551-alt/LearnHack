import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, FileText, Loader2, Send, Sparkles, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HelpChat } from "@/components/HelpChat";
import { Pomodoro } from "@/components/Pomodoro";
import { supabase } from "@/integrations/supabase/client";
import { classifyFocus, generateQuiz, reviewQuiz, summarizeLesson, type GeneratedQuestion } from "@/lib/ai.functions";
import { useLang } from "@/lib/i18n";
import { extractPdfText } from "@/lib/pdf";
import { awardPoints, useProfile, useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/rooms/$id")({
  head: () => ({
    meta: [
      { title: "Study room — FocusLab" },
      { name: "description", content: "Live study room with chat, shared PDFs, quiz games and focus tracking." },
      { property: "og:title", content: "Study room — FocusLab" },
      { property: "og:description", content: "Chat, share materials and race through AI quizzes with your study group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

type Question = GeneratedQuestion;

function RoomPage() {
  const { id } = Route.useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const { data: profile } = useProfile();
  const { data: subjects } = useSubjects();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ id: string; user_id: string; body: string; created_at: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [monitored, setMonitored] = useState(false);
  const [distractions, setDistractions] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [game, setGame] = useState<{ id: string; current_index: number; status: string; host_id: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [starting, setStarting] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  const room = useQuery({
    queryKey: ["room", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("study_rooms").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const files = useQuery({
    queryKey: ["room-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_files")
        .select("*")
        .eq("room_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isHost = !!user && room.data?.owner_id === user.id;
  const subject = subjects?.find((s) => s.id === room.data?.subject_id);
  const agentPrompt = subject?.agent_prompt ?? "You are a helpful STEM tutor.";

  // Start a study session on entry.
  useEffect(() => {
    if (!user || !room.data || sessionId) return;
    const canMonitor = room.data.monitored && !profile?.is_minor && !profile?.monitoring_opt_out;
    void (async () => {
      const { data } = await supabase
        .from("study_sessions")
        .insert({ user_id: user.id, room_id: id, monitored: canMonitor })
        .select("id")
        .single();
      if (data) {
        setSessionId(data.id);
        setMonitored(canMonitor);
      }
    })();
  }, [user, room.data, profile, id, sessionId]);

  const endSession = useCallback(
    async (auto = false) => {
      if (sessionId) {
        await supabase
          .from("study_sessions")
          .update({ ended_at: new Date().toISOString(), distraction_count: distractions })
          .eq("id", sessionId);
      }
      setSessionId(null);
      if (auto) toast.warning(t("autoClosed"));
    },
    [sessionId, distractions, t],
  );

  // Consent-based focus detection: only a tab-visibility signal is classified.
  useEffect(() => {
    if (!monitored || !sessionId || !user) return;
    const onHidden = async () => {
      if (!document.hidden) return;
      const { classification } = await classifyFocus({
        data: { windowText: "User switched away from the study tab", subject: room.data?.name ?? "" },
      });
      if (classification !== "off_task") return;
      await supabase.from("focus_events").insert({
        user_id: user.id,
        session_id: sessionId,
        classification,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      setDistractions((d) => {
        const next = d + 1;
        if (next >= 5) void endSession(true);
        else toast.warning(t("distractionWarn"));
        return next;
      });
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [monitored, sessionId, user, room.data, endSession, t]);

  // Chat: initial load + realtime.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", id)
        .order("created_at")
        .limit(200);
      if (!cancelled) setMessages(data ?? []);
    })();
    const channel = supabase
      .channel(`room-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` },
        (payload) => setMessages((m) => [...m, payload.new as (typeof m)[number]]),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [id]);

  // Resolve display names for chat authors.
  useEffect(() => {
    const missing = [...new Set(messages.map((m) => m.user_id))].filter((uid) => !names[uid]);
    if (missing.length === 0) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").in("id", missing);
      if (data?.length) setNames((n) => ({ ...n, ...Object.fromEntries(data.map((p) => [p.id, p.display_name])) }));
    })();
  }, [messages, names]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const body = message.trim();
    if (!body || !user) return;
    setMessage("");
    const { error } = await supabase.from("room_messages").insert({ room_id: id, user_id: user.id, body });
    if (error) toast.error(error.message);
  }

  async function onUpload(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const text = await extractPdfText(file);
      const path = `${id}/${crypto.randomUUID()}-${file.name}`;
      await supabase.storage.from("room-files").upload(path, file, { contentType: file.type });
      let summary: string | null = null;
      if (text.length > 200) {
        const res = await summarizeLesson({
          data: { sourceText: text, agentPrompt, detailLevel: "medium", lang },
        });
        summary = res.summary;
      }
      const { error } = await supabase
        .from("room_files")
        .insert({ room_id: id, uploader_id: user.id, file_name: file.name, storage_path: path, summary });
      if (error) throw error;
      void files.refetch();
      toast.success(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Game state: load active game + realtime updates.
  const loadQuestions = useCallback(async (quizId: string) => {
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position");
    setQuestions(
      (data ?? []).map((q) => ({
        qtype: q.qtype as Question["qtype"],
        prompt: q.prompt,
        options: (q.options as string[]) ?? [],
        answer: q.answer,
        explanation: q.explanation ?? "",
      })),
    );
  }, []);

  const syncGame = useCallback(async () => {
    const { data } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("room_id", id)
      .in("status", ["active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      setGame(null);
      return;
    }
    setGame({ id: data.id, current_index: data.current_index, status: data.status, host_id: data.host_id });
    if (questions.length === 0) await loadQuestions(data.quiz_id);
  }, [id, loadQuestions, questions.length]);

  useEffect(() => {
    void syncGame();
    const channel = supabase
      .channel(`game-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `room_id=eq.${id}` }, () =>
        void syncGame(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_answers" }, () => void loadScores())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadScores = useCallback(async () => {
    if (!game) return;
    const { data } = await supabase.from("game_answers").select("user_id, points").eq("game_id", game.id);
    const agg: Record<string, number> = {};
    for (const a of data ?? []) agg[a.user_id] = (agg[a.user_id] ?? 0) + a.points;
    setScores(agg);
    const missing = Object.keys(agg).filter((uid) => !names[uid]);
    if (missing.length) {
      const { data: p } = await supabase.from("profiles").select("id, display_name").in("id", missing);
      if (p?.length) setNames((n) => ({ ...n, ...Object.fromEntries(p.map((x) => [x.id, x.display_name])) }));
    }
  }, [game, names]);

  useEffect(() => {
    setPicked(null);
    void loadScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, game?.current_index]);

  const startGame = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const source = (files.data ?? []).map((f) => f.summary).filter(Boolean).join("\n\n").slice(0, 20000);
      if (!source) throw new Error(lang === "th" ? "อัปโหลดเอกสารก่อนเริ่มเกม" : "Upload a PDF first");
      setStarting(true);
      const { questions: qs } = await generateQuiz({
        data: { summary: source, agentPrompt, difficulty: "medium", count: 6, lang },
      });
      if (!qs.length) throw new Error("Quiz generation failed");
      const review = (await reviewQuiz({ data: { questions: qs, sourceSummary: source, lang } })) as {
        verdict: string;
        confidence: number;
      };
      if (review.verdict === "block") throw new Error(lang === "th" ? "ควิซไม่ผ่านการตรวจสอบ" : "Quiz blocked by AI review");
      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          author_id: user.id,
          subject_id: room.data?.subject_id ?? null,
          title: `${room.data?.name ?? "Room"} — ${room.data?.topic || t("game")}`,
          difficulty: "medium",
          visibility: "public",
          status: review.verdict === "pass" ? "published" : "pending",
          ai_feedback: review as never,
          ai_confidence: review.confidence ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: qErr } = await supabase.from("quiz_questions").insert(
        qs.map((q, i) => ({
          quiz_id: quiz.id,
          position: i,
          qtype: q.qtype,
          prompt: q.prompt,
          options: q.options as never,
          answer: q.answer,
          explanation: q.explanation,
        })),
      );
      if (qErr) throw qErr;
      const { error: gErr } = await supabase
        .from("game_sessions")
        .insert({ room_id: id, quiz_id: quiz.id, host_id: user.id, status: "active" });
      if (gErr) throw gErr;
      await loadQuestions(quiz.id);
      await syncGame();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start game"),
    onSettled: () => setStarting(false),
  });

  async function answer(option: string) {
    if (!game || !user || picked) return;
    const q = questions[game.current_index];
    if (!q) return;
    const correct = option.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setPicked(option);
    await supabase.from("game_answers").insert({
      game_id: game.id,
      user_id: user.id,
      question_index: game.current_index,
      answer: option,
      correct,
      points: correct ? 10 : 0,
    });
    if (correct) await awardPoints(user.id, 10);
    void loadScores();
  }

  async function advance() {
    if (!game) return;
    const next = game.current_index + 1;
    if (next >= questions.length) {
      await supabase.from("game_sessions").update({ status: "ended" }).eq("id", game.id);
      setGame(null);
      toast.success(t("finishGame"));
      return;
    }
    await supabase
      .from("game_sessions")
      .update({ current_index: next, question_started_at: new Date().toISOString() })
      .eq("id", game.id);
    await syncGame();
  }

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user || !room.data) return;
      const { error } = await supabase.from("host_reviews").insert({
        room_id: id,
        host_id: room.data.owner_id,
        reviewer_id: user.id,
        rating,
        comment: reviewText.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("submitReview"));
      setRating(0);
      setReviewText("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit review"),
  });

  async function leave() {
    await endSession();
    navigate({ to: "/rooms" });
  }

  if (room.isLoading) return <Loader2 className="mx-auto mt-16 size-6 animate-spin text-muted-foreground" />;
  if (!room.data) return <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  const currentQ = game ? questions[game.current_index] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void leave()}>
          <ArrowLeft className="size-4" /> {t("backToRooms")}
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{room.data.name}</h1>
        {subject && <Badge variant="secondary">{lang === "th" ? subject.name_th : subject.name_en}</Badge>}
        {room.data.topic && <Badge variant="outline">{room.data.topic}</Badge>}
        <Badge variant={monitored ? "default" : "secondary"} className="gap-1.5">
          {monitored ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {monitored ? t("monitoringOn") : t("notMonitored")}
        </Badge>
        <Badge variant="outline" className="font-mono">
          {room.data.join_code}
        </Badge>
        <div className="ml-auto flex gap-2">
          {monitored && (
            <Button variant="ghost" size="sm" onClick={() => setMonitored(false)}>
              {t("turnOffDetection")}
            </Button>
          )}
          <HelpChat />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("chat")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-64 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {messages.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
              {messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-medium text-foreground">{names[m.user_id] ?? "…"}</span>{" "}
                  <span className="text-muted-foreground">{m.body}</span>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={message}
                maxLength={800}
                placeholder={t("sendMessage")}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button type="submit" size="icon">
                <Send className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Pomodoro
            onFocusMinute={() => {
              if (user) void awardPoints(user.id, 1, 1);
            }}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("hostReview")}</CardTitle>
              <CardDescription>{t("hostReviewHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star className={`size-5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewText}
                maxLength={500}
                rows={2}
                placeholder={t("yourReview")}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <Button
                size="sm"
                disabled={rating === 0 || isHost || submitReview.isPending}
                onClick={() => submitReview.mutate()}
              >
                {t("submitReview")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("materials")}</CardTitle>
          <CardDescription>{t("pdfHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files?.[0])}
            />
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? t("extracting") : t("uploadPdf")}
            </span>
          </label>
          {(files.data ?? []).map((f) => (
            <details key={f.id} className="rounded-md border border-border p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <FileText className="size-4 text-muted-foreground" /> {f.file_name}
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {f.summary ?? "—"}
              </p>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("game")}</CardTitle>
          <CardDescription>{t("createQuizHere")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!game && isHost && (
            <Button className="gap-1.5" disabled={starting} onClick={() => startGame.mutate()}>
              {starting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {t("startGame")}
            </Button>
          )}
          {!game && !isHost && <p className="text-sm text-muted-foreground">{t("waitingHost")}</p>}

          {game && currentQ && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {game.current_index + 1}/{questions.length} · {currentQ.prompt}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(currentQ.options.length ? currentQ.options : [currentQ.answer]).map((o) => (
                  <Button
                    key={o}
                    variant={picked === o ? "default" : "outline"}
                    disabled={!!picked}
                    className="justify-start"
                    onClick={() => void answer(o)}
                  >
                    {o}
                  </Button>
                ))}
              </div>
              {picked && (
                <p className="text-sm text-muted-foreground">
                  {picked.trim().toLowerCase() === currentQ.answer.trim().toLowerCase() ? t("correct") : t("incorrect")}{" "}
                  — {currentQ.explanation}
                </p>
              )}
              {isHost && (
                <Button size="sm" variant="secondary" onClick={() => void advance()}>
                  {game.current_index + 1 >= questions.length ? t("finishGame") : t("nextQuestion")}
                </Button>
              )}
              <div className="space-y-1 pt-2">
                <p className="text-sm font-semibold">{t("liveScores")}</p>
                {Object.entries(scores)
                  .sort((a, b) => b[1] - a[1])
                  .map(([uid, pts]) => (
                    <p key={uid} className="text-sm text-muted-foreground">
                      {names[uid] ?? "…"} — {pts}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
