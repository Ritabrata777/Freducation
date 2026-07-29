import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AiToolId =
  "study-guide" | "quiz" | "flashcards" | "learning-path" | "concept-explainer" | "request-match";

type SectionToolId = Exclude<AiToolId, "quiz" | "flashcards">;

type AiToolsInput = {
  tool: AiToolId;
  prompt: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

type FlashcardItem = {
  front: string;
  back: string;
  hint?: string;
};

type StructuredSection = {
  heading: string;
  body: string | string[];
};

type StructuredAiResult =
  | {
      kind: "quiz";
      title: string;
      topic: string;
      questions: QuizQuestion[];
    }
  | {
      kind: "flashcards";
      title: string;
      topic: string;
      cards: FlashcardItem[];
    }
  | {
      kind: SectionToolId;
      title: string;
      topic: string;
      sections: StructuredSection[];
      keyTakeaways?: string[];
    };

type AiToolGeneration = {
  text: string;
  structured?: StructuredAiResult;
};

type AiToolsResult = {
  text: string;
  source: "python-rag" | "literouter" | "fallback";
  tool: AiToolId;
  topic: string;
  structured?: StructuredAiResult;
};

type MaterialContextRow = {
  title: string;
  description: string | null;
  subject: string | null;
  board: string | null;
  region: string | null;
  language: string | null;
  tags: string[] | null;
};

type RequestContextRow = {
  title: string;
  description: string | null;
  subject: string | null;
  board: string | null;
  region: string | null;
  status: string;
};

type QueryResponse<T> = { data: T[] | null; error: { message: string } | null };
type QueryBuilder<T> = {
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>;
  limit: (count: number) => PromiseLike<QueryResponse<T>>;
};
type SupabaseLike = {
  from: <T>(table: string) => {
    select: (columns: string) => QueryBuilder<T>;
  };
};

const DEFAULT_LITEROUTER_URL = "https://api.literouter.com/v1";
const DEFAULT_AI_MODEL = "gpt-5-nano";
const DEFAULT_QUIZ_QUESTION_COUNT = 10;

const TOOL_LABELS: Record<AiToolId, string> = {
  "study-guide": "Study Guide",
  quiz: "Quiz Generator",
  flashcards: "Flashcards",
  "learning-path": "Learning Path",
  "concept-explainer": "Concept Explainer",
  "request-match": "Request Matcher",
};

const TOOL_INSTRUCTIONS: Record<AiToolId, string> = {
  "study-guide":
    "Create a structured study guide with overview, key concepts, important terms, revision notes, and suggested next steps.",
  quiz: "Generate multiple-choice questions with four options each. Keep the correct answer and explanation separate from the visible question body.",
  flashcards: "Generate concise flashcards as front/back active-recall cards.",
  "learning-path":
    "Create a step-by-step learning path from beginner to advanced, including milestones, recommended practice, and estimated effort.",
  "concept-explainer":
    "Explain the concept clearly with intuition, examples, common mistakes, and where it is used.",
  "request-match":
    "Match the learner need with existing library resources if possible, identify gaps, and suggest what contributors should upload next.",
};

function resolveApiKey(): string | null {
  const apiKey =
    process.env.LITEROUTER_API_KEY ?? process.env.LITE_ROUTER_API_KEY ?? process.env.AI_API_KEY;
  return apiKey?.trim() ? apiKey.trim() : null;
}

function resolveLiteRouterBaseUrl(): string {
  return (
    process.env.LITEROUTER_BASE_URL?.trim() ||
    process.env.LITE_ROUTER_BASE_URL?.trim() ||
    process.env.AI_GATEWAY_URL?.trim() ||
    DEFAULT_LITEROUTER_URL
  ).replace(/\/+$/, "");
}

function requestedQuizQuestionCount(prompt: string): number | null {
  const numericCount =
    prompt.match(
      /(?:^|\b)(\d{1,2})\s*(?:mcqs?|multiple[-\s]?choice|quiz\s+questions?|questions?|items?)\b/i,
    ) ??
    prompt.match(
      /(?:mcqs?|multiple[-\s]?choice|quiz\s+questions?|questions?|items?).{0,24}?\b(\d{1,2})\b/i,
    );

  if (numericCount) {
    const count = Number(numericCount[1]);
    if (Number.isFinite(count)) return Math.min(Math.max(count, 1), 30);
  }

  const wordCounts: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    fifteen: 15,
    twenty: 20,
  };
  const wordCount = prompt.match(
    /(?:^|\b)(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s*(?:mcqs?|multiple[-\s]?choice|quiz\s+questions?|questions?|items?)\b/i,
  );

  return wordCount ? wordCounts[wordCount[1].toLowerCase()] : null;
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

type RawStructuredResult = {
  kind?: unknown;
  title?: unknown;
  topic?: unknown;
  questions?: unknown;
  cards?: unknown;
  sections?: unknown;
  keyTakeaways?: unknown;
};

function isSectionTool(kind: unknown): kind is SectionToolId {
  return (
    typeof kind === "string" &&
    ["study-guide", "learning-path", "concept-explainer", "request-match"].includes(kind)
  );
}

function parseStructuredResult(raw: string): StructuredAiResult | undefined {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as RawStructuredResult;
    if (!parsed || typeof parsed !== "object") return undefined;

    if (parsed.kind === "quiz" && Array.isArray(parsed.questions)) {
      const questions = parsed.questions
        .map((q: unknown) => {
          const row = q as Partial<QuizQuestion>;
          return {
            question: typeof row.question === "string" ? row.question.trim() : "",
            options: Array.isArray(row.options)
              ? row.options.filter(
                  (option: unknown): option is string => typeof option === "string",
                )
              : [],
            answer: typeof row.answer === "string" ? row.answer.trim() : "",
            explanation: typeof row.explanation === "string" ? row.explanation.trim() : "",
          };
        })
        .filter((q) => q.question && q.options.length >= 2);

      if (questions.length) {
        return {
          kind: "quiz",
          title: typeof parsed.title === "string" ? parsed.title : "Quiz",
          topic: typeof parsed.topic === "string" ? parsed.topic : "Selected topic",
          questions,
        };
      }
    }

    if (parsed.kind === "flashcards" && Array.isArray(parsed.cards)) {
      const cards = parsed.cards
        .map((card: unknown) => {
          const row = card as Partial<FlashcardItem>;
          return {
            front: typeof row.front === "string" ? row.front.trim() : "",
            back: typeof row.back === "string" ? row.back.trim() : "",
            hint: typeof row.hint === "string" ? row.hint.trim() : undefined,
          };
        })
        .filter((card) => card.front && card.back);

      if (cards.length) {
        return {
          kind: "flashcards",
          title: typeof parsed.title === "string" ? parsed.title : "Flashcards",
          topic: typeof parsed.topic === "string" ? parsed.topic : "Selected topic",
          cards,
        };
      }
    }

    if (isSectionTool(parsed.kind) && Array.isArray(parsed.sections)) {
      const sections = parsed.sections
        .map((section) => {
          const row = section as Partial<StructuredSection>;
          return {
            heading: typeof row.heading === "string" ? row.heading.trim() : "Section",
            body:
              typeof row.body === "string"
                ? row.body.trim()
                : Array.isArray(row.body)
                  ? row.body.filter((line): line is string => typeof line === "string")
                  : "",
          };
        })
        .filter((section) => section.heading && section.body);

      if (sections.length) {
        return {
          kind: parsed.kind,
          title: typeof parsed.title === "string" ? parsed.title : TOOL_LABELS[parsed.kind],
          topic: typeof parsed.topic === "string" ? parsed.topic : "Selected topic",
          sections,
          keyTakeaways: Array.isArray(parsed.keyTakeaways)
            ? parsed.keyTakeaways.filter((line): line is string => typeof line === "string")
            : undefined,
        };
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function renderStructuredText(structured: StructuredAiResult): string {
  if (structured.kind === "quiz") {
    return [
      structured.title,
      `Topic: ${structured.topic}`,
      "",
      ...structured.questions.flatMap((q, index) => [
        `${index + 1}. ${q.question}`,
        ...q.options.map(
          (option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`,
        ),
        `Answer: ${q.answer}`,
        `Explanation: ${q.explanation}`,
        "",
      ]),
    ].join("\n");
  }

  if (structured.kind === "flashcards") {
    return [
      structured.title,
      `Topic: ${structured.topic}`,
      "",
      ...structured.cards.flatMap((card, index) => [
        `${index + 1}. ${card.front}`,
        `Answer: ${card.back}`,
        card.hint ? `Hint: ${card.hint}` : "",
        "",
      ]),
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    structured.title,
    `Topic: ${structured.topic}`,
    "",
    ...structured.sections.flatMap((section) => [
      section.heading,
      ...(Array.isArray(section.body) ? section.body.map((line) => `- ${line}`) : [section.body]),
      "",
    ]),
    ...(structured.keyTakeaways?.length
      ? ["Key takeaways", ...structured.keyTakeaways.map((line) => `- ${line}`)]
      : []),
  ].join("\n");
}

function buildFallback(input: AiToolsInput): AiToolGeneration {
  const topic = input.prompt.trim() || "the selected topic";

  if (input.tool === "quiz") {
    const count = requestedQuizQuestionCount(input.prompt) ?? DEFAULT_QUIZ_QUESTION_COUNT;
    const structured: StructuredAiResult = {
      kind: "quiz",
      title: `${TOOL_LABELS[input.tool]}: ${topic}`,
      topic,
      questions: Array.from({ length: count }).map((_, index) => ({
        question: `Draft question ${index + 1} about ${topic}?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
        explanation:
          "This is a local draft because LiteRouter is not configured. Set LITEROUTER_API_KEY for generated explanations.",
      })),
    };
    return { text: renderStructuredText(structured), structured };
  }

  if (input.tool === "flashcards") {
    const structured: StructuredAiResult = {
      kind: "flashcards",
      title: `Flashcards: ${topic}`,
      topic,
      cards: Array.from({ length: 8 }).map((_, index) => ({
        front: `Key recall prompt ${index + 1} for ${topic}`,
        back: "Local draft answer. Configure LiteRouter for AI-generated flashcards.",
      })),
    };
    return { text: renderStructuredText(structured), structured };
  }

  const structured: StructuredAiResult = {
    kind: input.tool,
    title: `${TOOL_LABELS[input.tool]}: ${topic}`,
    topic,
    sections: [
      {
        heading: "Local draft",
        body: [
          "LiteRouter is not configured yet, so this is a local scaffold.",
          "Set LITEROUTER_API_KEY to enable AI generation directly from the app.",
          "Python RAG is optional and only needed for future advanced retrieval workflows.",
        ],
      },
      {
        heading: "Suggested workflow",
        body: [
          "Retrieve relevant Freducation materials and open requests.",
          "Rank them with ML retrieval.",
          "Generate notes, quizzes, flashcards, explanations, or paths from that context.",
        ],
      },
    ],
  };

  return { text: renderStructuredText(structured), structured };
}

async function buildLibraryContext(context: { supabase: SupabaseLike }) {
  const [materials, requests] = await Promise.all([
    context.supabase
      .from<MaterialContextRow>("materials")
      .select("title, description, subject, board, region, language, tags")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(16),
    context.supabase
      .from<RequestContextRow>("material_requests")
      .select("title, description, subject, board, region, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const materialLines = (materials.data ?? []).map((m, index) => {
    const facets = [m.subject, m.board, m.region, m.language].filter(Boolean).join(" · ");
    const tags = Array.isArray(m.tags) && m.tags.length ? ` #${m.tags.join(" #")}` : "";
    return `${index + 1}. ${m.title}${facets ? ` (${facets})` : ""}: ${m.description ?? ""}${tags}`;
  });

  const requestLines = (requests.data ?? []).map((r, index) => {
    const facets = [r.subject, r.board, r.region].filter(Boolean).join(" · ");
    return `${index + 1}. ${r.title}${facets ? ` (${facets})` : ""}: ${r.description ?? ""}`;
  });

  return [
    "Recent live library materials:",
    materialLines.length ? materialLines.join("\n") : "No live materials found.",
    "",
    "Open learner requests:",
    requestLines.length ? requestLines.join("\n") : "No open requests found.",
  ].join("\n");
}

async function callPythonRag(
  input: AiToolsInput,
  contextText: string,
): Promise<AiToolGeneration | null> {
  const serviceUrl = process.env.AI_RAG_SERVICE_URL ?? process.env.LEARNHOUSE_AI_URL;
  if (!serviceUrl?.trim()) return null;

  try {
    const res = await fetch(`${serviceUrl.replace(/\/+$/, "")}/ai-tools/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: input.tool, prompt: input.prompt, context: contextText }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { text?: unknown };
    return typeof json.text === "string" ? { text: json.text } : null;
  } catch {
    return null;
  }
}

function formatLiteRouterErrorDetail(detail: string): string {
  const compact = detail.replace(/\s+/g, " ").trim();
  return compact.length > 500 ? `${compact.slice(0, 500)}…` : compact;
}

function buildJsonContract(input: AiToolsInput): string {
  if (input.tool === "quiz") {
    const count = requestedQuizQuestionCount(input.prompt) ?? DEFAULT_QUIZ_QUESTION_COUNT;
    return [
      `Return exactly ${count} multiple-choice questions unless the user's prompt explicitly requested a different count already reflected here.`,
      "Return only JSON with this shape:",
      '{"kind":"quiz","title":"string","topic":"string","questions":[{"question":"string","options":["string","string","string","string"],"answer":"string","explanation":"string"}]}',
      "Do not include the answer or explanation inside the question text. Keep answer and explanation only in their fields.",
      "Use four clear options per question. The answer field must match the correct option text exactly or include its option label and text.",
    ].join("\n");
  }

  if (input.tool === "flashcards") {
    return [
      "Return only JSON with this shape:",
      '{"kind":"flashcards","title":"string","topic":"string","cards":[{"front":"string","back":"string","hint":"optional string"}]}',
      "Create 8-12 concise cards unless the prompt requests a specific count.",
    ].join("\n");
  }

  return [
    "Return only JSON with this shape:",
    `{"kind":"${input.tool}","title":"string","topic":"string","sections":[{"heading":"string","body":"string or string array"}],"keyTakeaways":["string"]}`,
    "Use clear headings, short paragraphs, and practical learning steps.",
  ].join("\n");
}

async function callLiteRouter(
  input: AiToolsInput,
  contextText: string,
): Promise<AiToolGeneration | null> {
  const apiKey = resolveApiKey();
  if (!apiKey) return null;

  const system = [
    "You are Freducation AI Tools, a context-aware academic assistant.",
    "Use provided library materials and requests as retrieval context.",
    "Keep output concise, structured, and directly usable by students.",
    "Return valid JSON only. Do not wrap the JSON in markdown fences.",
  ].join(" ");

  const user = [
    `Tool: ${TOOL_LABELS[input.tool]}`,
    `Task: ${TOOL_INSTRUCTIONS[input.tool]}`,
    `User topic/prompt: ${input.prompt}`,
    "",
    "Output contract:",
    buildJsonContract(input),
    "",
    "Freducation context:",
    contextText,
  ].join("\n");

  const model = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const endpoint = `${resolveLiteRouterBaseUrl()}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const detail = formatLiteRouterErrorDetail(await res.text());
      throw new Error(
        `LiteRouter request failed (${res.status} ${res.statusText || "HTTP error"}) using model ${model}${detail ? `: ${detail}` : ""}`,
      );
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error(`LiteRouter returned an empty response using model ${model}.`);
    }

    const structured = parseStructuredResult(text);
    return { text: structured ? renderStructuredText(structured) : text.trim(), structured };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LiteRouter")) throw error;
    const detail = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`LiteRouter request failed using model ${model}: ${detail}`);
  }
}

export const runAiDashboardTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AiToolsInput) => data)
  .handler(async ({ data, context }): Promise<AiToolsResult> => {
    const prompt = data.prompt.trim();
    if (!prompt) throw new Error("Enter a topic, material name, or learning goal first.");

    const input = { ...data, prompt };
    const ragContext = context as unknown as { supabase: SupabaseLike };
    const contextText = await buildLibraryContext(ragContext);

    const liteRouterResult = await callLiteRouter(input, contextText);
    if (liteRouterResult) {
      return { ...liteRouterResult, source: "literouter", tool: input.tool, topic: prompt };
    }

    const pythonResult = await callPythonRag(input, contextText);
    if (pythonResult)
      return { ...pythonResult, source: "python-rag", tool: input.tool, topic: prompt };

    const fallback = buildFallback(input);
    return { ...fallback, source: "fallback", tool: input.tool, topic: prompt };
  });
