import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Flame, Sparkles, Star, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pomodoro } from "@/components/Pomodoro";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { awardPoints, useInvalidate, useProfile, useSession } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FocusLab" },
      { name: "description", content: "Your streak, points, focus minutes, virtual pet and pomodoro timer." },
      { property: "og:title", content: "Dashboard — FocusLab" },
      { property: "og:description", content: "Track your streak, points and focus minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const PETS = ["🥚", "🐣", "🐥", "🦉", "🦅"];

function Dashboard() {
  const { t, lang } = useLang();
  const { data: user } = useSession();
  const { data: profile } = useProfile();
  const invalidate = useInvalidate();

  const today = new Date().toISOString().slice(0, 10);
  const alreadyCheckedIn = profile?.last_checkin === today;

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const streak = profile?.last_checkin === yesterday ? (profile?.streak_count ?? 0) + 1 : 1;
      const { error } = await supabase
        .from("profiles")
        .update({ last_checkin: today, streak_count: streak })
        .eq("id", user.id);
      if (error) throw error;
      await supabase.from("checkins").insert({ user_id: user.id, day: today });
      await awardPoints(user.id, 10);
      return streak;
    },
    onSuccess: (streak) => {
      invalidate(["profile"]);
      toast.success(lang === "th" ? `เช็คอินสำเร็จ! สตรีค ${streak} วัน` : `Checked in! ${streak}-day streak`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Check-in failed"),
  });

  const petStage = Math.min(5, Math.max(1, profile?.pet_stage ?? 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {lang === "th" ? "สวัสดี" : "Hi"}, {profile?.display_name ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("heroSub")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Star} label={t("points")} value={String(profile?.points ?? 0)} />
        <Stat icon={Flame} label={t("streak")} value={`${profile?.streak_count ?? 0} ${t("days")}`} />
        <Stat icon={Timer} label={t("focusMinutes")} value={String(profile?.focus_minutes ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("pet")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-6xl">{PETS[petStage - 1]}</div>
            <p className="mt-3 text-xs text-muted-foreground">{t("petHint")}</p>
            <p className="mt-1 text-xs font-medium text-primary">
              {lang === "th" ? "ระดับ" : "Stage"} {petStage}/5
            </p>
            <Button
              className="mt-4 w-full"
              disabled={alreadyCheckedIn || checkIn.isPending}
              onClick={() => checkIn.mutate()}
            >
              {alreadyCheckedIn ? t("checkedIn") : t("checkIn")}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-1">
          <Pomodoro
            onFocusMinute={() => {
              if (user) void awardPoints(user.id, 1, 1);
            }}
          />
        </div>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{lang === "th" ? "เริ่มทบทวน" : "Start studying"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="secondary" className="w-full justify-start gap-2">
              <Link to="/lessons">
                <Sparkles className="size-4" /> {t("newLesson")}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-start gap-2">
              <Link to="/rooms">
                <Timer className="size-4" /> {t("rooms")}
              </Link>
            </Button>
            <Button asChild variant="secondary" className="w-full justify-start gap-2">
              <Link to="/leaderboard">
                <Star className="size-4" /> {t("leaderboard")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
