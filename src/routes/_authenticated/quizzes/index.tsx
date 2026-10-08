import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpChat } from "@/components/HelpChat";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { awardPoints, useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/quizzes/")({
  head: () => ({
    meta: [
      { title: "Quiz library — FocusLab" },
      { name: "description", content: "Attempt public, AI-reviewed STEM quizzes created by the FocusLab community." },
      { property: "og:title", content: "Quiz library — FocusLab" },
      { property: "og:description", content: "Public, AI-reviewed STEM quizzes from the FocusLab community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizLibrary,
});

type Q = { id: string; prompt: string; options: string[]; answer: string; explanation: string | null };

function QuizLibrary() {
  const { t, lang } = useLang();
  const { data: user } = useSession();
  const { data: subjects } = useSubjects();
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const quizzes = useQuery({
    queryKey: ["public-quizzes", filter],
    queryFn: async () => {
      let q = supabase
        .from("quizzes")
        .select("*")
        .eq("visibility", "public")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filter !== "all") q = q.eq("subject_id", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function open(quiz: { id: string; title: string }) {
    setLoading(true);
    const { data, error } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions(
      (data ?? []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: (q.options as string[]) ?? [],
        answer: q.answer,
        explanation: q.explanation,
      })),
    );
    setAnswers({});
    setSubmitted(false);
    setActive(quiz);
  }

  async function submit() {
    if (!active || !user) return;
    const score = questions.filter((q) => (answers[q.id] ?? "").trim().toLowerCase() === q.answer.trim().toLowerCase())
      .length;
    setSubmitted(true);
    await supabase
      .from("quiz_attempts")
      .insert({ user_id: user.id, quiz_id: active.id, score, total: questions.length });
    if (score > 0) await awardPoints(user.id, score * 5);
    toast.success(`${score}/${questions.length}`);
  }

  if (active) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{active.title}</h1>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setActive(null)}>
            {t("quizLibrary")}
          </Button>
        </div>
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="space-y-3 py-4">
              <p className="text-sm font-medium">
                {i + 1}. {q.prompt}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(q.options.length ? q.options : [q.answer]).map((o) => (
                  <Button
                    key={o}
                    variant={answers[q.id] === o ? "default" : "outline"}
                    className="justify-start"
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                  >
                    {o}
                  </Button>
                ))}
              </div>
              {submitted && (
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  {(answers[q.id] ?? "").trim().toLowerCase() === q.answer.trim().toLowerCase() ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 text-destructive" />
                  )}
                  {q.answer} — {q.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {!submitted && (
          <Button onClick={() => void submit()} disabled={questions.length === 0}>
            {t("submit")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("quizLibrary")}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSubjects")}</SelectItem>
              {(subjects ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {lang === "th" ? s.name_th : s.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelpChat />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("quizLibraryHint")}</p>

      {loading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}

      <div className="grid gap-3 md:grid-cols-2">
        {(quizzes.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          (quizzes.data ?? []).map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{q.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{q.difficulty}</Badge>
                  {q.ai_confidence != null && (
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="size-3" /> {Math.round(Number(q.ai_confidence) * 100)}%
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={() => void open({ id: q.id, title: q.title })}>
                  {t("attempt")}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
