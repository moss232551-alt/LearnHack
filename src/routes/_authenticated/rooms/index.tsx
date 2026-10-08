import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, LogIn, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CONSENT_POLICY_VERSION, ConsentDialog } from "@/components/ConsentDialog";
import { HelpChat } from "@/components/HelpChat";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useInvalidate, useProfile, useSession, useSubjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/rooms/")({
  head: () => ({
    meta: [
      { title: "Focus rooms — FocusLab" },
      { name: "description", content: "Create or join live STEM study rooms with chat, shared PDFs and quiz games." },
      { property: "og:title", content: "Focus rooms — FocusLab" },
      { property: "og:description", content: "Live STEM study rooms with chat, shared materials and consent-based focus nudges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomsLobby,
});

const nameSchema = z.string().trim().min(2).max(60);

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function RoomsLobby() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { data: user } = useSession();
  const { data: profile } = useProfile();
  const { data: subjects } = useSubjects();
  const invalidate = useInvalidate();

  const [roomName, setRoomName] = useState("");
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [mode, setMode] = useState<"solo" | "group">("group");
  const [wantMonitoring, setWantMonitoring] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [filter, setFilter] = useState("all");

  const blockedByPolicy = !!profile?.is_minor || !!profile?.monitoring_opt_out;

  const myRooms = useQuery({
    queryKey: ["rooms", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_rooms")
        .select("*")
        .eq("owner_id", user!.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openRooms = useQuery({
    queryKey: ["open-rooms", filter],
    queryFn: async () => {
      let q = supabase
        .from("study_rooms")
        .select("*")
        .eq("mode", "group")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter !== "all") q = q.eq("subject_id", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createRoom = useMutation({
    mutationFn: async (monitored: boolean) => {
      const parsed = nameSchema.safeParse(roomName);
      if (!parsed.success) throw new Error(lang === "th" ? "กรุณาตั้งชื่อห้อง" : "Please name the room");
      const { data, error } = await supabase
        .from("study_rooms")
        .insert({
          owner_id: user!.id,
          name: parsed.data,
          topic: topic.trim().slice(0, 120),
          subject_id: subjectId || null,
          mode,
          monitored,
          join_code: code(),
        })
        .select("*")
        .single();
      if (error) throw error;
      if (monitored) {
        await supabase.from("consent_records").insert({
          user_id: user!.id,
          scope: "focus_detection",
          decision: "granted",
          policy_version: CONSENT_POLICY_VERSION,
        });
      }
      await supabase.from("room_members").insert({ room_id: data.id, user_id: user!.id });
      return data;
    },
    onSuccess: (r) => {
      setRoomName("");
      setTopic("");
      invalidate(["rooms", "open-rooms"]);
      navigate({ to: "/rooms/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create room"),
  });

  const join = useMutation({
    mutationFn: async (roomId?: string) => {
      let room = null as { id: string } | null;
      if (roomId) {
        room = { id: roomId };
      } else {
        const { data, error } = await supabase
          .from("study_rooms")
          .select("id")
          .eq("join_code", joinCode.trim().toUpperCase())
          .eq("active", true)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(lang === "th" ? "ไม่พบห้องนี้" : "Room not found");
        room = data;
      }
      await supabase.from("room_members").upsert(
        { room_id: room.id, user_id: user!.id },
        { onConflict: "room_id,user_id", ignoreDuplicates: true },
      );
      return room;
    },
    onSuccess: (r) => {
      setJoinCode("");
      navigate({ to: "/rooms/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not join"),
  });

  const subjectName = (id: string | null) => {
    const s = subjects?.find((x) => x.id === id);
    return s ? (lang === "th" ? s.name_th : s.name_en) : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("rooms")}</h1>
        <div className="ml-auto">
          <HelpChat />
        </div>
      </div>

      {profile?.is_minor && (
        <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">{t("minorNotice")}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("createRoom")}</CardTitle>
            <CardDescription>{t("consentDataBody")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("roomName")}</Label>
              <Input value={roomName} maxLength={60} onChange={(e) => setRoomName(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="space-y-1.5">
                <Label>{t("topic")}</Label>
                <Input value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              {(["solo", "group"] as const).map((m) => (
                <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                  {t(m)}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{t("monitored")}</span>
              <Switch checked={wantMonitoring} disabled={blockedByPolicy} onCheckedChange={setWantMonitoring} />
            </div>
            <Button
              className="w-full gap-1.5"
              disabled={createRoom.isPending}
              onClick={() => (wantMonitoring && !blockedByPolicy ? setConsentOpen(true) : createRoom.mutate(false))}
            >
              <Plus className="size-4" /> {t("createRoom")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("joinRoom")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("joinCode")}</Label>
              <Input
                value={joinCode}
                maxLength={8}
                className="font-mono uppercase"
                onChange={(e) => setJoinCode(e.target.value)}
              />
            </div>
            <Button className="w-full gap-1.5" variant="secondary" onClick={() => join.mutate(undefined)}>
              <LogIn className="size-4" /> {t("joinRoom")}
            </Button>

            <div className="space-y-1.5 pt-2">
              <Label>{t("browseRooms")}</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
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
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("browseRooms")}</h2>
        {(openRooms.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          (openRooms.data ?? []).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <Users className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(r.subject_id)}
                    {r.topic ? ` · ${r.topic}` : ""}
                  </p>
                </div>
                {r.monitored && (
                  <Badge variant="outline" className="gap-1">
                    <Eye className="size-3" /> {t("monitored")}
                  </Badge>
                )}
                <Button size="sm" className="ml-auto" onClick={() => join.mutate(r.id)}>
                  {t("enterRoom")}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("myRooms")}</h2>
        {(myRooms.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          (myRooms.data ?? []).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <span className="text-sm font-medium">{r.name}</span>
                <Badge variant="secondary">{t(r.mode as "solo")}</Badge>
                <Badge variant="outline">{subjectName(r.subject_id)}</Badge>
                <Badge variant="outline" className="font-mono">
                  {r.join_code}
                </Badge>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={() => navigate({ to: "/rooms/$id", params: { id: r.id } })}
                >
                  {t("enterRoom")}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <ConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onDecision={(accepted) => {
          setConsentOpen(false);
          if (!accepted && user) {
            void supabase.from("consent_records").insert({
              user_id: user.id,
              scope: "focus_detection",
              decision: "declined",
              policy_version: CONSENT_POLICY_VERSION,
            });
          }
          createRoom.mutate(accepted);
        }}
      />
    </div>
  );
}
