import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, LayoutDashboard, ListChecks, Settings, Shield, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useIsAdmin } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const nav = [
    { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { to: "/lessons", label: t("lessons"), icon: BookOpen },
    { to: "/rooms", label: t("rooms"), icon: Users },
    { to: "/quizzes", label: t("quizLibrary"), icon: ListChecks },
    { to: "/leaderboard", label: t("leaderboard"), icon: Trophy },
    { to: "/settings", label: t("settings"), icon: Settings },
  ] as const;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link to="/dashboard" className="text-base font-bold tracking-tight">
            FocusLab
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "rounded-full px-3 py-1.5 text-sm bg-secondary text-secondary-foreground font-medium" }}
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                activeProps={{ className: "ml-1 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium" }}
              >
                <Shield className="size-3.5" />
                {t("admin")}
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border/70 bg-background/95 backdrop-blur md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground"
            activeProps={{ className: "flex flex-col items-center gap-1 py-2 text-[10px] text-primary font-medium" }}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
