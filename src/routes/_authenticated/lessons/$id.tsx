import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { generateQuiz, reviewQuiz, type GeneratedQuestion } from "@/lib/ai.functions";
import { useLang } from "@/lib/i18n";
import { awardPoints, useInvalidate, useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/lessons/$id")({
  head: () => ({
    meta: [
      { title: "Lesson — FocusLab" },
      { name: "description", content: "Read your AI lesson summary and practise with a generated quiz." },
      { property: "og:title", content: "Lesson — FocusLab" },
      { property: "og:description", content: "AI lesson summary and retrieval-practice quiz." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LessonDetail,
});

type Question = GeneratedQuestion & { id: string };

function LessonDetail() {
  const { id } = useParams({ from: "/_authenticated/lessons/$id" });
  const { t, lang } = useLang();
  const { data: user } = useSession();
  const { data: subjects } = useSubjects();
  const invalidate = useInvalidate();

  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState("5");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const lesson = useQuery({
    queryKey: ["lesson", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const quiz = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const { data: q } = await supabase
        .from("quizzes")
        .select("*")
        .eq("lesson_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!q) return null;
      const { data: questions } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", q.id)
        .order("position");
      return {
        quiz: q,
        questions: (questions ?? []).map((x) => ({
          id: x.id,
          qtype: x.qtype as Question["qtype"],
          prompt: x.prompt,
          options: (x.options as string[]) ?? [],
          answer: x.answer,
          explanation: x.explanation ?? "",
        })),
      };
    },
  });

  const subject = subjects?.find((s) => s.id === lesson.data?.subject_id);

  const makeQuiz = useMutation({
    mutationFn: async () => {
      const summary = lesson.data?.summary ?? "";
      if (summary.length < 40) throw new Error("Summarise the lesson first.");
      const { questions } = await generateQuiz({
        data: {
          summary,
          agentPrompt: subject?.agent_prompt ?? "You are a STEM tutor.",
          difficulty,
          count: Number(count),
          lang,
        },
      });
      if (questions.length === 0) throw new Error("AI returned no questions. Try again.");
      const review = (await reviewQuiz({ data: { questions, sourceSummary: summary, lang } })) as {
        verdict: string;
        confidence: number;
        summary: string;
      };
      const { data: created, error } = await supabase
        .from("quizzes")
        .insert({
          author_id: user!.id,
          lesson_id: id,
          subject_id: lesson.data?.subject_id ?? null,
          title: `${lesson.data?.title ?? "Quiz"}`,
          difficulty,
          ai_feedback: review,
          ai_confidence: review.confidence ?? null,
          status: review.verdict === "block" ? "rejected" : "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = questions.map((q, i) => ({
        quiz_id: created.id,
        position: i,
        qtype: q.qtype,
        prompt: q.prompt,
        options: q.options ?? [],
        answer: q.answer,
        explanation: q.explanation ?? null,
      }));
      const { error: qErr } = await supabase.from("quiz_questions").insert(rows);
      if (qErr) throw qErr;
      return review;
    },
    onSuccess: (review) => {
      setAnswers({});
      setResult(null);
      invalidate(["quiz"]);
      toast.success(review.summary?.slice(0, 160) ?? "Quiz ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Quiz generation failed"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const qs = quiz.data?.questions ?? [];
      const score = qs.filter(
        (q) => (answers[q.id] ?? "").trim().toLowerCase() === q.answer.trim().toLowerCase(),
      ).length;
      await supabase
        .from("quiz_attempts")
        .insert({ user_id: user!.id, quiz_id: quiz.data!.quiz.id, score, total: qs.length });
      await awardPoints(user!.id, score * 5);
      return { score, total: qs.length };
    },
    onSuccess: (r) => {
      setResult(r);
      invalidate(["profile"]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("lessons")
        .update({ status: "pending", visibility: "public" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(["lesson", "lessons"]);
      toast.success(t("pending"));
    },
  });

  if (lesson.isLoading) return <Loader2 className="mx-auto mt-16 size-6 animate-spin text-muted-foreground" />;
  if (!lesson.data) return <p className="py-16 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  const isOwner = lesson.data.author_id === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{lesson.data.title}</h1>
        <Badge variant="secondary">{subject ? (lang === "th" ? subject.name_th : subject.name_en) : "—"}</Badge>
        <Badge>{t(lesson.data.status as "draft")}</Badge>
        {isOwner && lesson.data.status === "draft" && (
          <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => publish.mutate()}>
            <ShieldCheck className="size-4" /> {t("publish")}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{lesson.data.summary}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("takeQuiz")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-36 space-y-1.5">
              <Label>{t("difficulty")}</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t("easy")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="hard">{t("hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1.5">
              <Label>{t("questionCount")}</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3", "5", "10", "15"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-1.5" disabled={makeQuiz.isPending} onClick={() => makeQuiz.mutate()}>
              {makeQuiz.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {quiz.data ? t("regenerate") : t("generateQuiz")}
            </Button>
          </div>

          {quiz.data && (
            <>
              <Separator />
              {quiz.data.quiz.ai_feedback ? (
                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">{t("aiReview")}:</strong>{" "}
                  {(quiz.data.quiz.ai_feedback as { summary?: string }).summary}
                </p>
              ) : null}

              <ol className="space-y-5">
                {quiz.data.questions.map((q, i) => (
                  <li key={q.id} className="space-y-2">
                    <p className="text-sm font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    {q.options.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              answers[q.id] === o
                                ? "border-primary bg-accent text-accent-foreground"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={answers[q.id] ?? ""}
                        maxLength={200}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      />
                    )}
                    {result && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{q.answer}</strong> — {q.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ol>

              <div className="flex items-center gap-3">
                <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
                  {t("submit")}
                </Button>
                {result && (
                  <span className="text-sm font-medium">
                    {t("yourScore")}: {result.score}/{result.total}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
