import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { summarizeLesson } from "@/lib/ai.functions";
import { useLang } from "@/lib/i18n";
import { useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/lessons/")({
  head: () => ({
    meta: [
      { title: "Lessons — FocusLab" },
      { name: "description", content: "Turn slide text into AI summaries and quizzes for your STEM subjects." },
      { property: "og:title", content: "Lessons — FocusLab" },
      { property: "og:description", content: "AI summaries and quizzes from your own course material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LessonsPage,
});

const formSchema = z.object({
  title: z.string().trim().min(3).max(140),
  subjectId: z.string().uuid(),
  sourceText: z.string().trim().min(40).max(60000),
});

function LessonsPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const { data: subjects } = useSubjects();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [detailLevel, setDetailLevel] = useState("medium");

  const mine = useQuery({
    queryKey: ["lessons", "mine", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, status, visibility, created_at, subject_id")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const shared = useQuery({
    queryKey: ["lessons", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, uses_count, subject_id")
        .eq("visibility", "public")
        .eq("status", "published")
        .order("uses_count", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = formSchema.safeParse({ title, subjectId, sourceText });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      const subject = subjects?.find((s) => s.id === parsed.data.subjectId);
      const { summary } = await summarizeLesson({
        data: {
          sourceText: parsed.data.sourceText,
          agentPrompt: subject?.agent_prompt ?? "You are a STEM tutor.",
          detailLevel,
          lang,
        },
      });
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          author_id: user!.id,
          title: parsed.data.title,
          subject_id: parsed.data.subjectId,
          source_text: parsed.data.sourceText,
          detail_level: detailLevel,
          summary,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setTitle("");
      setSourceText("");
      navigate({ to: "/lessons/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create lesson"),
  });

  async function readFile(file: File) {
    if (file.size > 2_000_000) {
      toast.error(lang === "th" ? "ไฟล์ใหญ่เกิน 2MB" : "File is larger than 2MB");
      return;
    }
    setSourceText((await file.text()).slice(0, 60000));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 140));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("lessons")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("newLesson")}</CardTitle>
          <CardDescription>{t("sourceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("title")}</Label>
              <Input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("subject")}</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("subject")} />
                </SelectTrigger>
                <SelectContent>
                  {(subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {lang === "th" ? s.name_th : s.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("sourceText")}</Label>
            <Textarea
              rows={8}
              value={sourceText}
              maxLength={60000}
              onChange={(e) => setSourceText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-4" /> {t("uploadFile")}
              </Button>
              <span className="text-xs text-muted-foreground">{sourceText.length} / 60000</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-1.5">
              <Label>{t("detailLevel")}</Label>
              <Select value={detailLevel} onValueChange={setDetailLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">{t("short")}</SelectItem>
                  <SelectItem value="medium">{t("medium")}</SelectItem>
                  <SelectItem value="detailed">{t("detailed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="gap-1.5" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {create.isPending ? t("thinking") : t("summarize")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">{t("myLessons")}</TabsTrigger>
          <TabsTrigger value="public">{t("publicLessons")}</TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="pt-4">
          <LessonList
            items={(mine.data ?? []).map((l) => ({ id: l.id, title: l.title, meta: l.status }))}
            empty={t("empty")}
          />
        </TabsContent>
        <TabsContent value="public" className="pt-4">
          <LessonList
            items={(shared.data ?? []).map((l) => ({ id: l.id, title: l.title, meta: `${l.uses_count} uses` }))}
            empty={t("empty")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LessonList({ items, empty }: { items: { id: string; title: string; meta: string }[]; empty: string }) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((l) => (
        <Link key={l.id} to="/lessons/$id" params={{ id: l.id }}>
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <span className="text-sm font-medium">{l.title}</span>
              <Badge variant="secondary">{l.meta}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
