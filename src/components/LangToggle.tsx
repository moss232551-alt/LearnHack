import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => setLang(lang === "th" ? "en" : "th")}
      aria-label="Toggle language"
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold uppercase">{lang === "th" ? "ไทย" : "EN"}</span>
    </Button>
  );
}
