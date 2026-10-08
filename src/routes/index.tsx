import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuit, ShieldCheck, Sparkles, Timer, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FocusLab — AI study summaries & focus rooms for STEM students" },
      {
        name: "description",
        content:
          "Turn lecture slides into AI summaries and quizzes, study in consent-based focus rooms, and keep your streak alive.",
      },
      { property: "og:title", content: "FocusLab — STEM study community" },
      {
        property: "og:description",
        content: "AI lesson summaries, quizzes, focus rooms, streaks and leaderboards for university STEM students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, lang } = useLang();
  const { data: user } = useSession();

  const features = [
    {
      icon: BrainCircuit,
      th: "AI เฉพาะทางรายวิชา",
      en: "Subject-specialist AI",
      thb: "เลือก agent ฟิสิกส์ เคมี คณิต หรือวิศวกรรมคอมพิวเตอร์ ให้สรุปสไลด์ด้วยศัพท์เฉพาะที่ถูกต้อง",
      enb: "Physics, chemistry, maths or CE agents summarise your slides with the right terminology.",
    },
    {
      icon: Sparkles,
      th: "ควิซอัตโนมัติ + ตรวจคุณภาพ",
      en: "Auto quizzes with AI QA",
      thb: "สร้างควิซจากสรุปทันที และให้ AI ตรวจเฉลย ความกำกวม และความเหมาะสมก่อนเผยแพร่",
      enb: "Generate quizzes instantly; AI checks answers, ambiguity and appropriateness before publishing.",
    },
    {
      icon: Users,
      th: "ห้องโฟกัสเดี่ยว/กลุ่ม",
      en: "Solo & group focus rooms",
      thb: "ทบทวนพร้อมเพื่อน พร้อมการตรวจจับสมาธิที่เปิด-ปิดได้เอง",
      enb: "Study alongside friends, with focus detection you switch on and off yourself.",
    },
    {
      icon: Timer,
      th: "โพโมโดโร + สัตว์เลี้ยง",
      en: "Pomodoro + virtual pet",
      thb: "จับเวลาเรียน-พัก และเลี้ยงสัตว์เสมือนที่โตตามเวลาโฟกัสของคุณ",
      enb: "Time your sprints and grow a pet that levels up with your focus minutes.",
    },
    {
      icon: Trophy,
      th: "สตรีคและลีดเดอร์บอร์ด",
      en: "Streaks & leaderboards",
      thb: "เช็คอินรายวัน เก็บแต้ม และแข่งกับเพื่อนรายสัปดาห์",
      enb: "Check in daily, earn points and compete weekly with friends.",
    },
    {
      icon: ShieldCheck,
      th: "ออกแบบตาม PDPA",
      en: "PDPA-first privacy",
      thb: "ขอความยินยอมชัดเจน เก็บเฉพาะผลจำแนกกิจกรรม ลบอัตโนมัติใน 24 ชม. เพิกถอนได้ทุกเมื่อ",
      enb: "Clear consent, activity labels only, auto-deleted in 24h, withdraw any time.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-lg font-bold tracking-tight text-foreground">FocusLab</span>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button asChild size="sm">
            <Link to={user ? "/dashboard" : "/auth"}>{user ? t("dashboard") : t("signIn")}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <ShieldCheck className="size-3.5" /> {t("privacyFirst")}
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            {t("tagline")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{t("heroSub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>{t("getStarted")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/leaderboard">{t("leaderboard")}</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.en} className="border-border/70 bg-card/80">
                <CardHeader className="pb-2">
                  <f.icon className="size-6 text-primary" />
                  <CardTitle className="text-base">{lang === "th" ? f.th : f.en}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed text-muted-foreground">
                  {lang === "th" ? f.thb : f.enb}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        FocusLab · {lang === "th" ? "สร้างเพื่อนักศึกษาสาย STEM" : "Built for STEM students"}
      </footer>
    </div>
  );
}
