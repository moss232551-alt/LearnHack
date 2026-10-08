import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useInvalidate, useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — FocusLab" },
      { name: "description", content: "Moderate lessons, manage learners and review the audit log." },
      { property: "og:title", content: "Admin — FocusLab" },
      { property: "og:description", content: "FocusLab moderation and administration console." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useLang();
  const { data: user } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const invalidate = useInvalidate();
  const [reason, setReason] = useState("");
  const { data: subjects } = useSubjects();
  const [subjForm, setSubjForm] = useState({ code: "", name_th: "", name_en: "", agent_prompt: "" });

  const quizQueue = useQuery({
    queryKey: ["admin", "quiz-queue"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("id, title, status, difficulty, ai_confidence")
        .eq("status", "pending")
        .order("created_at");
      return data ?? [];
    },
  });

  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const counts = async (table: "profiles" | "lessons" | "quizzes" | "study_sessions" | "consent_records") =>
        (await supabase.from(table).select("id", { count: "exact", head: true })).count ?? 0;
      const [learners, lessons, quizzes, sessions, consents] = await Promise.all([
        counts("profiles"),
        counts("lessons"),
        counts("quizzes"),
        counts("study_sessions"),
        counts("consent_records"),
      ]);
      const { count: checkins } = await supabase
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .gte("day", since);
      return { learners, lessons, quizzes, sessions, consents, checkins: checkins ?? 0 };
    },
  });

  const saveSubject = useMutation({
    mutationFn: async () => {
      const { code, name_th, name_en, agent_prompt } = subjForm;
      if (!code.trim() || !name_en.trim()) throw new Error("Code and English name are required");
      const { error } = await supabase.from("subjects").insert({
        code: code.trim().toUpperCase(),
        name_th: name_th.trim() || name_en.trim(),
        name_en: name_en.trim(),
        agent_prompt: agent_prompt.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubjForm({ code: "", name_th: "", name_en: "", agent_prompt: "" });
      invalidate(["subjects"]);
      toast.success(lang === "th" ? "เพิ่มวิชาแล้ว" : "Subject added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save subject"),
  });

  const toggleSubject = useMutation({
    mutationFn: async (s: { id: string; active: boolean }) => {
      const { error } = await supabase.from("subjects").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["subjects"]),
  });

  const queue = useQuery({
    queryKey: ["admin", "queue"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id, title, summary, status, author_id")
        .eq("status", "pending")
        .order("created_at");
      return data ?? [];
    },
  });

  const users = useQuery({
    queryKey: ["admin", "users"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, points, suspended")
        .order("points", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["admin", "audit"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: async (a: { action: string; targetType: string; targetId: string; patch?: object }) => {
      if (a.targetType === "quiz") {
        const { error } = await supabase.from("quizzes").update(a.patch!).eq("id", a.targetId);
        if (error) throw error;
      } else if (a.targetType === "lesson") {
        const { error } = await supabase.from("lessons").update(a.patch!).eq("id", a.targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").update(a.patch!).eq("id", a.targetId);
        if (error) throw error;
      }
      await supabase.from("admin_audit_log").insert({
        admin_id: user!.id,
        action: a.action,
        target_type: a.targetType,
        target_id: a.targetId,
        reason: reason.trim().slice(0, 500) || null,
      });
    },
    onSuccess: () => {
      setReason("");
      invalidate(["admin"]);
      toast.success(lang === "th" ? "ดำเนินการแล้ว" : "Done");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  if (isLoading) return null;
  if (!isAdmin)
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {lang === "th" ? "คุณไม่มีสิทธิ์เข้าถึงหน้านี้" : "You do not have access to this page."}
      </p>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("admin")}</h1>

      <Input
        placeholder={t("reason")}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        className="max-w-md"
      />

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">{t("moderationQueue")}</TabsTrigger>
          <TabsTrigger value="quizzes">{t("quizLibrary")}</TabsTrigger>
          <TabsTrigger value="subjects">{t("subject")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("analytics")}</TabsTrigger>
          <TabsTrigger value="users">{t("userManagement")}</TabsTrigger>
          <TabsTrigger value="audit">{t("auditLog")}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3 pt-4">
          {(queue.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            (queue.data ?? []).map((l) => (
              <Card key={l.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{l.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-4 text-xs text-muted-foreground">{l.summary}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        act.mutate({
                          action: "approve_lesson",
                          targetType: "lesson",
                          targetId: l.id,
                          patch: { status: "published", visibility: "public" },
                        })
                      }
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        act.mutate({
                          action: "reject_lesson",
                          targetType: "lesson",
                          targetId: l.id,
                          patch: { status: "rejected", visibility: "private" },
                        })
                      }
                    >
                      {t("reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-3 pt-4">
          {(quizQueue.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            (quizQueue.data ?? []).map((q) => (
              <Card key={q.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <span className="text-sm font-medium">{q.title}</span>
                  <Badge variant="secondary">{q.difficulty}</Badge>
                  {q.ai_confidence != null && (
                    <Badge variant="outline">{Math.round(Number(q.ai_confidence) * 100)}%</Badge>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        act.mutate({
                          action: "approve_quiz",
                          targetType: "quiz",
                          targetId: q.id,
                          patch: { status: "published", visibility: "public" },
                        })
                      }
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        act.mutate({
                          action: "reject_quiz",
                          targetType: "quiz",
                          targetId: q.id,
                          patch: { status: "rejected", visibility: "private" },
                        })
                      }
                    >
                      {t("reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="subjects" className="space-y-3 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("addSubject")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input
                    value={subjForm.code}
                    maxLength={20}
                    onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ชื่อไทย</Label>
                  <Input
                    value={subjForm.name_th}
                    maxLength={60}
                    onChange={(e) => setSubjForm({ ...subjForm, name_th: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>English name</Label>
                  <Input
                    value={subjForm.name_en}
                    maxLength={60}
                    onChange={(e) => setSubjForm({ ...subjForm, name_en: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("agentPrompt")}</Label>
                <Textarea
                  rows={3}
                  value={subjForm.agent_prompt}
                  maxLength={2000}
                  onChange={(e) => setSubjForm({ ...subjForm, agent_prompt: e.target.value })}
                />
              </div>
              <Button size="sm" disabled={saveSubject.isPending} onClick={() => saveSubject.mutate()}>
                {t("addSubject")}
              </Button>
            </CardContent>
          </Card>

          {(subjects ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <Badge variant="outline" className="font-mono">
                  {s.code}
                </Badge>
                <span className="text-sm font-medium">{lang === "th" ? s.name_th : s.name_en}</span>
                {!s.active && <Badge variant="secondary">off</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => toggleSubject.mutate({ id: s.id, active: s.active })}
                >
                  {t("active")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="analytics" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["analyticsUsers", analytics.data?.learners],
              ["analyticsLessons", analytics.data?.lessons],
              ["analyticsQuizzes", analytics.data?.quizzes],
              ["analyticsSessions", analytics.data?.sessions],
              ["analyticsActive", analytics.data?.checkins],
              ["analyticsConsents", analytics.data?.consents],
            ].map(([key, value]) => (
              <Card key={key as string}>
                <CardContent className="py-5">
                  <p className="text-xs text-muted-foreground">{t(key as "analyticsUsers")}</p>
                  <p className="text-2xl font-bold">{(value as number) ?? "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-2 pt-4">
          {(users.data ?? []).map((u) => (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <span className="text-sm font-medium">{u.display_name}</span>
                {u.suspended && <Badge variant="destructive">{t("suspend")}</Badge>}
                <span className="text-xs text-muted-foreground">{u.points} pts</span>
                <Button
                  size="sm"
                  variant={u.suspended ? "outline" : "destructive"}
                  className="ml-auto"
                  onClick={() =>
                    act.mutate({
                      action: u.suspended ? "unsuspend_user" : "suspend_user",
                      targetType: "user",
                      targetId: u.id,
                      patch: { suspended: !u.suspended },
                    })
                  }
                >
                  {u.suspended ? t("unsuspend") : t("suspend")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2 pt-4">
          {(audit.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            (audit.data ?? []).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 py-2">
                <Badge variant="secondary">{a.action}</Badge>
                <span className="text-xs text-muted-foreground">{a.target_type}</span>
                <span className="text-xs text-muted-foreground">{a.reason}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
