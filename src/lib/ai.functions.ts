import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { callAI, parseJson, LEN } from "./ai-core.server";

export const summarizeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceText: string; agentPrompt: string; detailLevel: string; lang: string }) => {
    if (!d.sourceText || d.sourceText.trim().length < 40) throw new Error("Please provide more source content.");
    return { ...d, sourceText: d.sourceText.slice(0, 60000) };
  })
  .handler(async ({ data }) => {
    const content = await callAI([
      {
        role: "system",
        content: `${data.agentPrompt}\nYou write study summaries for university STEM students. Answer in ${
          data.lang === "th" ? "Thai" : "English"
        }. ${LEN[data.detailLevel] ?? LEN["medium"]}\nUse markdown with these sections: ## Key topics, ## Formulas & definitions, ## Worked example, ## Common misconceptions.`,
      },
      { role: "user", content: `Summarise this course material:\n\n${data.sourceText}` },
    ]);
    return { summary: content };
  });

export type GeneratedQuestion = {
  qtype: "mcq" | "truefalse" | "fill";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { summary: string; agentPrompt: string; difficulty: string; count: number; lang: string }) => ({
    ...d,
    summary: (d.summary ?? "").slice(0, 40000),
    count: Math.min(Math.max(Number(d.count) || 5, 1), 20),
  }))
  .handler(async ({ data }) => {
    const raw = await callAI(
      [
        {
          role: "system",
          content: `${data.agentPrompt}\nYou generate retrieval-practice quizzes. Answer in ${
            data.lang === "th" ? "Thai" : "English"
          }. Difficulty: ${data.difficulty}. Return JSON only: {"questions":[{"qtype":"mcq"|"truefalse"|"fill","prompt":string,"options":string[],"answer":string,"explanation":string}]}. For mcq give 4 options and the answer must exactly match one option. For truefalse options are ["True","False"] (or Thai equivalents) . For fill, options is [].`,
        },
        { role: "user", content: `Create ${data.count} questions from this lesson summary:\n\n${data.summary}` },
      ],
      true,
    );
    const parsed = parseJson<{ questions: GeneratedQuestion[] }>(raw, { questions: [] });
    return { questions: parsed.questions.slice(0, data.count) };
  });

export const reviewQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { questions: GeneratedQuestion[]; sourceSummary: string; lang: string }) => d)
  .handler(async ({ data }) => {
    const raw = await callAI(
      [
        {
          role: "system",
          content: `You are a quiz quality assurance reviewer for a student study platform. Answer feedback in ${
            data.lang === "th" ? "Thai" : "English"
          }. Check: (1) answer correctness against the source, (2) question quality — ambiguity, multiple correct answers, weak distractors, (3) content moderation — profanity, inappropriate or likely copyrighted material, (4) difficulty calibration. Return JSON only: {"verdict":"pass"|"revise"|"block","confidence":0-1,"difficulty":"easy"|"medium"|"hard","issues":[{"question":number,"problem":string,"suggestion":string}],"summary":string}`,
        },
        {
          role: "user",
          content: `Source summary:\n${(data.sourceSummary ?? "").slice(0, 20000)}\n\nQuestions:\n${JSON.stringify(
            data.questions,
          ).slice(0, 20000)}`,
        },
      ],
      true,
    );
    return parseJson(raw, {
      verdict: "revise",
      confidence: 0.3,
      difficulty: "medium",
      issues: [],
      summary: "AI review could not be parsed; sent for human review.",
    });
  });

export const classifyFocus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { windowText: string; subject: string }) => ({
    windowText: (d.windowText ?? "").slice(0, 2000),
    subject: d.subject ?? "",
  }))
  .handler(async ({ data }) => {
    const raw = await callAI(
      [
        {
          role: "system",
          content: `Classify whether an on-screen activity description is study-related for the subject "${data.subject}". Be conservative: when unsure, answer on_task to avoid false alarms. Return JSON only: {"classification":"on_task"|"off_task","confidence":0-1}`,
        },
        { role: "user", content: data.windowText },
      ],
      true,
    );
    return parseJson<{ classification: "on_task" | "off_task"; confidence: number }>(raw, {
      classification: "on_task",
      confidence: 0.2,
    });
  });

/** In-app help assistant: answers "how do I use FocusLab" questions only. */
export const helpChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[]; lang: string }) => ({
    lang: d.lang,
    messages: (d.messages ?? []).slice(-12).map((m) => ({
      role: m.role,
      content: (m.content ?? "").slice(0, 2000),
    })),
  }))
  .handler(async ({ data }) => {
    const system = `You are the FocusLab help assistant. You ONLY answer questions about how to use the FocusLab app — not subject/course content (redirect those to the subject AI in Lessons).
Answer in ${data.lang === "th" ? "Thai" : "English"}. Be short (max 6 lines) and use markdown lists when helpful.
App map:
- Dashboard: daily check-in, streak, points, virtual pet, Pomodoro.
- Lessons: paste or upload slide text, a subject-specialist AI writes a structured summary, then generates a quiz that an AI QA reviewer checks before publishing. Publishing sets status "pending" for admin review.
- Focus rooms: create a solo or group room, pick a STEM subject and topic, share the join code. Inside a room there is live chat, PDF study materials (auto-summarised), an AI quiz you can launch as a multiplayer race, and an optional consent-based focus detection.
- Focus detection: never on by default. You must accept a consent screen, an indicator shows while it runs, one click turns it off, and labels are deleted within 24h. Minors and users who opted out cannot enable it.
- Quiz library: public, AI-reviewed quizzes anyone can attempt; correct answers give points.
- Leaderboard: weekly and all-time ranking by points.
- Settings: language, minor flag, monitoring opt-out, download your data, delete focus data, consent history.
If asked something outside the app, say you only cover app usage.`;

    const content = await callAI([
      { role: "system", content: system },
      ...data.messages.map((m) => ({ role: "user" as const, content: `${m.role === "assistant" ? "[assistant said] " : ""}${m.content}` })),
    ]);
    return { reply: content };
  });
