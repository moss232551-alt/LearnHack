import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useLang } from "@/lib/i18n";

const FOCUS = 25 * 60;
const BREAK = 5 * 60;

export function Pomodoro({ onFocusMinute }: { onFocusMinute?: () => void }) {
  const { t, lang } = useLang();
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const tick = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          const next = mode === "focus" ? "break" : "focus";
          setMode(next);
          return next === "focus" ? FOCUS : BREAK;
        }
        return s - 1;
      });
      if (mode === "focus") {
        tick.current += 1;
        if (tick.current % 60 === 0) onFocusMinute?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode, onFocusMinute]);

  const total = mode === "focus" ? FOCUS : BREAK;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("pomodoro")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {mode === "focus" ? (lang === "th" ? "ช่วงเรียน" : "Focus") : lang === "th" ? "ช่วงพัก" : "Break"}
          </p>
          <p className="mt-1 font-mono text-5xl font-semibold tabular-nums text-foreground">
            {mm}:{ss}
          </p>
        </div>
        <Progress value={((total - left) / total) * 100} />
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={() => setRunning((r) => !r)} className="gap-1.5">
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? t("pause") : t("start")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setRunning(false);
              setMode("focus");
              setLeft(FOCUS);
            }}
          >
            <RotateCcw className="size-4" />
            {t("reset")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
