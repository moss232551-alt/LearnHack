import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_POLICY_VERSION } from "@/components/ConsentDialog";
import { useLang } from "@/lib/i18n";
import { useInvalidate, useProfile, useSession } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Privacy & settings — FocusLab" },
      { name: "description", content: "Manage consent, download your data and delete focus-detection records." },
      { property: "og:title", content: "Privacy & settings — FocusLab" },
      { property: "og:description", content: "PDPA controls: consent history, data export and deletion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { data: user } = useSession();
  const { data: profile } = useProfile();
  const invalidate = useInvalidate();

  const consents = useQuery({
    queryKey: ["consents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("consent_records")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const setFlag = useMutation({
    mutationFn: async (patch: { is_minor?: boolean; monitoring_opt_out?: boolean; language?: string }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
      if (patch.monitoring_opt_out !== undefined) {
        await supabase.from("consent_records").insert({
          user_id: user!.id,
          scope: "focus_detection",
          decision: patch.monitoring_opt_out ? "withdrawn" : "reenabled",
          policy_version: CONSENT_POLICY_VERSION,
        });
      }
    },
    onSuccess: () => {
      invalidate(["profile", "consents"]);
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const wipe = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("focus_events").delete().eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success(lang === "th" ? "ลบข้อมูลแล้ว" : "Detection data deleted"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function download() {
    const [p, c, s, f] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id),
      supabase.from("consent_records").select("*").eq("user_id", user!.id),
      supabase.from("study_sessions").select("*").eq("user_id", user!.id),
      supabase.from("focus_events").select("*").eq("user_id", user!.id),
    ]);
    const blob = new Blob(
      [JSON.stringify({ profile: p.data, consents: c.data, sessions: s.data, focusEvents: f.data }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "focuslab-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("settings")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("privacyFirst")}</CardTitle>
          <CardDescription>{t("consentRightsBody")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label={t("imMinor")}>
            <Switch
              checked={!!profile?.is_minor}
              onCheckedChange={(v) => setFlag.mutate({ is_minor: v })}
            />
          </Row>
          <Row label={profile?.monitoring_opt_out ? t("withdrawn") : t("withdrawForever")}>
            <Switch
              checked={!!profile?.monitoring_opt_out}
              onCheckedChange={(v) => setFlag.mutate({ monitoring_opt_out: v })}
            />
          </Row>
          <Row label={lang === "th" ? "ภาษา" : "Language"}>
            <div className="flex gap-2">
              {(["th", "en"] as const).map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={lang === l ? "default" : "outline"}
                  onClick={() => {
                    setLang(l);
                    setFlag.mutate({ language: l });
                  }}
                >
                  {l.toUpperCase()}
                </Button>
              ))}
            </div>
          </Row>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={download}>
              <Download className="size-4" /> {t("downloadData")}
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => wipe.mutate()}>
              <Trash2 className="size-4" /> {t("deleteFocusData")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldOff className="size-4" /> {t("consentHistory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(consents.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            (consents.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-border/60 py-2 last:border-0">
                <Badge variant="secondary">{c.decision}</Badge>
                <span className="text-xs text-muted-foreground">{c.scope}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
