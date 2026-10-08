import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — FocusLab" },
      { name: "description", content: "See how your points and streaks compare with other STEM learners." },
      { property: "og:title", content: "Leaderboard — FocusLab" },
      { property: "og:description", content: "Points and streaks across the FocusLab community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { t } = useLang();
  const { data: user } = useSession();

  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, points, streak_count, focus_minutes")
        .order("points", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Trophy className="size-6 text-primary" /> {t("leaderboard")}
      </h1>

      {(board.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {(board.data ?? []).map((p, i) => (
            <Card key={p.id} className={p.id === user?.id ? "border-primary/60" : undefined}>
              <CardContent className="flex items-center gap-4 py-3">
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{p.display_name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="size-3.5" />
                  {p.streak_count}
                </span>
                <span className="text-xs text-muted-foreground">{p.focus_minutes}m</span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">{p.points}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
