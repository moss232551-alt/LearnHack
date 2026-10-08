import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { helpChat } from "@/lib/ai.functions";
import { useLang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

/** Small app-usage assistant. Separate from the subject-content AI. */
export function HelpChat() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await helpChat({ data: { messages: next, lang } });
      setMessages([...next, { role: "assistant", content: reply || "…" }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Help assistant unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LifeBuoy className="size-4" /> {t("helpBot")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex h-96 w-[22rem] flex-col p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t("helpBot")}</p>
          <p className="text-xs text-muted-foreground">{t("helpBotHint")}</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {lang === "th" ? "เช่น “สร้างควิซยังไง” หรือ “ปิดการตรวจจับยังไง”" : "e.g. “How do I create a quiz?”"}
            </p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-full whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {m.content}
              </div>
            ),
          )}
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
          <Input
            ref={inputRef}
            value={input}
            maxLength={500}
            placeholder={t("askHelp")}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={busy}>
            <Send className="size-4" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
