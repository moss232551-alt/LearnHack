import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FocusLab" },
      { name: "description", content: "Sign in or create your FocusLab account to start studying." },
      { property: "og:title", content: "Sign in — FocusLab" },
      { property: "og:description", content: "Sign in or create your FocusLab account to start studying." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  displayName: z.string().trim().max(60).optional(),
});

function AuthPage() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function run(mode: "in" | "up") {
    const parsed = schema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: parsed.data.displayName || parsed.data.email.split("@")[0] },
          },
        });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-lg font-bold tracking-tight">
          FocusLab
        </Link>
        <LangToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("appName")}</CardTitle>
            <CardDescription>{t("tagline")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">{t("signIn")}</TabsTrigger>
                <TabsTrigger value="up">{t("signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="in" className="space-y-3 pt-4">
                <Field label={t("email")} value={email} onChange={setEmail} type="email" />
                <Field label={t("password")} value={password} onChange={setPassword} type="password" />
                <Button className="w-full" disabled={busy} onClick={() => run("in")}>
                  {t("signIn")}
                </Button>
              </TabsContent>

              <TabsContent value="up" className="space-y-3 pt-4">
                <Field label={t("displayName")} value={displayName} onChange={setDisplayName} />
                <Field label={t("email")} value={email} onChange={setEmail} type="email" />
                <Field label={t("password")} value={password} onChange={setPassword} type="password" />
                <Button className="w-full" disabled={busy} onClick={() => run("up")}>
                  {t("signUp")}
                </Button>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {lang === "th" ? "หรือ" : "or"}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              {t("continueGoogle")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
    </div>
  );
}
