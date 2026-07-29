import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Icon } from "@/components/Icon";
import { downloadAiResultPdf } from "@/lib/ai-pdf-export";
import { runAiDashboardTool } from "@/lib/ai-tools.functions";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "AI Tools — Freducation" },
      {
        name: "description",
        content:
          "Generate study guides, quizzes, flashcards, explanations, learning paths, and request matches with Freducation AI.",
      },
      { property: "og:title", content: "AI Tools — Freducation" },
      {
        property: "og:description",
        content: "A LiteRouter-powered AI learning workspace for contextual education support.",
      },
    ],
  }),
  component: AiToolsPage,
});

type AiToolId =
  "study-guide" | "quiz" | "flashcards" | "learning-path" | "concept-explainer" | "request-match";

type SectionToolId = Exclude<AiToolId, "quiz" | "flashcards">;

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

type AiToolResult = {
  text: string;
  source: string;
  tool: AiToolId;
  topic: string;
  structured?: StructuredAiResult;
};

const AI_TOOL_OPTIONS: ReadonlyArray<{
  id: AiToolId;
  title: string;
  eyebrow: string;
  icon: string;
  description: string;
  placeholder: string;
  accent: string;
}> = [
  {
    id: "study-guide",
    title: "Study Guide",
    eyebrow: "Plan",
    icon: "auto_stories",
    description: "Structured notes, key ideas, revision map, and next steps.",
    placeholder: "e.g. Thermodynamics for mechanical engineering",
    accent: "from-primary/20 to-transparent",
  },
  {
    id: "quiz",
    title: "Quiz Generator",
    eyebrow: "Test",
    icon: "quiz",
    description: "MCQs with hidden answers. Defaults to 10 questions unless you ask otherwise.",
    placeholder: "e.g. Digital image processing, or 5 questions on DIP",
    accent: "from-tertiary/20 to-transparent",
  },
  {
    id: "flashcards",
    title: "Flashcards",
    eyebrow: "Recall",
    icon: "style",
    description: "Active-recall cards with concise fronts, answers, and optional hints.",
    placeholder: "e.g. VLSI design important terms",
    accent: "from-secondary/20 to-transparent",
  },
  {
    id: "learning-path",
    title: "Learning Path",
    eyebrow: "Roadmap",
    icon: "route",
    description: "Step-by-step milestones, practice tasks, and learning sequence.",
    placeholder: "e.g. Learn data structures for interviews",
    accent: "from-primary-container/20 to-transparent",
  },
  {
    id: "concept-explainer",
    title: "Concept Explainer",
    eyebrow: "Explain",
    icon: "psychology",
    description: "Intuition, examples, common mistakes, and real-world use cases.",
    placeholder: "e.g. Explain operational amplifiers",
    accent: "from-surface-container-high/50 to-transparent",
  },
  {
    id: "request-match",
    title: "Request Matcher",
    eyebrow: "Match",
    icon: "hub",
    description: "Connect learner needs with materials and contributor upload gaps.",
    placeholder: "e.g. Need MBBS anatomy practical revision resources",
    accent: "from-error-container/20 to-transparent",
  },
];

const TOOL_LABELS: Record<AiToolId, string> = Object.fromEntries(
  AI_TOOL_OPTIONS.map((tool) => [tool.id, tool.title]),
) as Record<AiToolId, string>;

const SOURCE_LABELS: Record<string, string> = {
  literouter: "LiteRouter",
  "python-rag": "Python RAG",
  fallback: "Local Draft",
};

function AiToolsPage() {
  const runTool = useServerFn(runAiDashboardTool);
  const [selected, setSelected] = useState<AiToolId>("study-guide");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AiToolResult | null>(null);
  const [selectedChoices, setSelectedChoices] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const activeTool = AI_TOOL_OPTIONS.find((tool) => tool.id === selected) ?? AI_TOOL_OPTIONS[0];
  const topicReady = prompt.trim().length > 0;

  const aiMutation = useMutation({
    mutationFn: (input: { tool: AiToolId; prompt: string }) => runTool({ data: input }),
    onSuccess: (data) => {
      setResult(data);
      setSelected(data.tool);
      setPrompt(data.topic);
      setSelectedChoices({});
      setRevealedAnswers({});
      toast.success("AI result ready", {
        description:
          data.source === "python-rag"
            ? "Generated using the optional Python RAG service."
            : data.source === "literouter"
              ? "Generated using LiteRouter with Freducation context."
              : "Generated using the local fallback.",
      });
    },
    onError: (error) => {
      toast.error("AI tool failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    },
  });

  const runGeneration = (tool = selected, topic = prompt) => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      toast.error("Add a topic first", {
        description: "Type what you want to learn, then choose an AI tool.",
      });
      return;
    }
    aiMutation.mutate({ tool, prompt: cleanTopic });
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    toast.success("Copied result", { description: "The generated content is on your clipboard." });
  };

  const exportPdf = async () => {
    if (!result) return;
    await downloadAiResultPdf(result);
    toast.success("PDF export started");
  };

  const revealAllAnswers = () => {
    if (result?.structured?.kind !== "quiz") return;
    const allVisible = result.structured.questions.every((_, index) => revealedAnswers[index]);
    setRevealedAnswers(
      Object.fromEntries(result.structured.questions.map((_, index) => [index, !allVisible])),
    );
  };

  if (result) {
    return (
      <AiResultView
        result={result}
        busy={aiMutation.isPending}
        selectedChoices={selectedChoices}
        revealedAnswers={revealedAnswers}
        onBack={() => setResult(null)}
        onCopy={copyResult}
        onExportPdf={exportPdf}
        onRegenerate={() => runGeneration(result.tool, result.topic)}
        onRevealAll={revealAllAnswers}
        onSelectChoice={(questionIndex, option) =>
          setSelectedChoices((current) => ({ ...current, [questionIndex]: option }))
        }
        onToggleAnswer={(questionIndex) =>
          setRevealedAnswers((current) => ({
            ...current,
            [questionIndex]: !current[questionIndex],
          }))
        }
      />
    );
  }

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-36 lg:pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin">
          <section className="bento-card overflow-hidden mb-gutter">
            <div className="relative p-6 md:p-8 bg-linear-to-br from-primary/15 via-white/5 to-transparent">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="font-label-sm text-label-sm uppercase tracking-wider text-primary mb-3">
                    AI Learning Suite
                  </p>
                  <h1 className="font-headline-lg text-headline-lg text-on-background">
                    Start with a topic. Then choose the AI tool.
                  </h1>
                  <p className="text-secondary font-body-md mt-3 max-w-2xl">
                    Type your learning goal first, then pick Study Guide, Quiz Generator,
                    Flashcards, or another tool. Quizzes default to 10 questions unless you ask for
                    a specific count.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <ToolbarBadge icon="bolt" label="LiteRouter" tone="primary" />
                  <ToolbarBadge icon="memory" label="gpt-5-nano" />
                  <ToolbarBadge icon="dataset" label="Library context" />
                  <ToolbarBadge icon="hub" label="RAG optional" />
                </div>
              </div>
            </div>
          </section>

          <section
            className="grid grid-cols-1 lg:grid-cols-12 gap-gutter"
            aria-label="AI workspace"
          >
            <aside className="lg:col-span-4 xl:col-span-3">
              <div className="sticky top-28 flex flex-col gap-3">
                <div className="px-1">
                  <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                    2. Select tool
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Cards unlock after you enter a topic, keeping the flow topic-first.
                  </p>
                </div>

                {AI_TOOL_OPTIONS.map((tool) => {
                  const active = selected === tool.id;
                  const disabled = !topicReady || aiMutation.isPending;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelected(tool.id)}
                      className={`group bento-card p-4 text-left transition-all bg-linear-to-br ${tool.accent} ${
                        active
                          ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "hover:border-primary/30 hover:bg-surface-container-low/70"
                      } ${disabled ? "cursor-not-allowed opacity-45 grayscale" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid size-9 place-items-center rounded-xl border ${
                              active
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-glass-border bg-glass-surface text-secondary group-hover:text-primary"
                            }`}
                          >
                            <Icon name={tool.icon} style={{ fontSize: 19 }} />
                          </span>
                          <div>
                            <span className="font-label-sm text-[10px] uppercase tracking-wider text-secondary">
                              {tool.eyebrow}
                            </span>
                            <h3 className="font-headline-md text-[15px] leading-5 text-on-background">
                              {tool.title}
                            </h3>
                          </div>
                        </div>
                        {active ? (
                          <Icon
                            name="check_circle"
                            className="text-primary"
                            style={{ fontSize: 18 }}
                          />
                        ) : null}
                      </div>
                      <p className="font-body-md text-sm text-secondary mt-3 leading-5">
                        {tool.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="lg:col-span-8 xl:col-span-9 bento-card p-5 md:p-6 flex flex-col gap-5">
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  runGeneration();
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                      1. Enter topic
                    </p>
                    <h2 className="font-headline-md text-headline-md text-on-background text-[22px]">
                      What should Freducation AI build for you?
                    </h2>
                  </div>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-label-sm uppercase tracking-wider text-primary">
                    Active: {activeTool.title}
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={8}
                    placeholder={activeTool.placeholder}
                    className="peer w-full min-h-56 resize-y rounded-2xl border border-glass-border bg-glass-input px-5 py-5 pb-20 font-body-md text-on-surface placeholder:text-secondary/80 shadow-inner transition focus:border-primary focus:bg-surface/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="pointer-events-none absolute left-5 bottom-5 text-xs text-secondary peer-focus:text-primary">
                    Tip: for quizzes, write “5 questions on DIP” to override the default 10.
                  </div>
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <span className="hidden rounded-full border border-glass-border bg-glass-surface px-3 py-1 text-[10px] font-label-sm uppercase tracking-wider text-secondary sm:inline-flex">
                      {prompt.trim().length} chars
                    </span>
                    <button
                      type="submit"
                      disabled={aiMutation.isPending || !topicReady}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-sm text-label-sm text-on-primary shadow-lg shadow-primary/10 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon
                        name={aiMutation.isPending ? "progress_activity" : "auto_awesome"}
                        className={aiMutation.isPending ? "animate-spin" : ""}
                        style={{ fontSize: 18 }}
                      />
                      {aiMutation.isPending ? "Generating…" : `Run ${activeTool.title}`}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <WorkflowNote
                    icon="edit_note"
                    title="Topic first"
                    body="The prompt drives every AI tool, so start by describing exactly what you need."
                  />
                  <WorkflowNote
                    icon="touch_app"
                    title="Select a tool"
                    body="Choose the output style from the sidebar after your topic is ready."
                  />
                  <WorkflowNote
                    icon="open_in_full"
                    title="Focused results"
                    body="Generated content opens in a full response view with reveal and export tools."
                  />
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function AiResultView({
  result,
  busy,
  selectedChoices,
  revealedAnswers,
  onBack,
  onCopy,
  onExportPdf,
  onRegenerate,
  onRevealAll,
  onSelectChoice,
  onToggleAnswer,
}: {
  result: AiToolResult;
  busy: boolean;
  selectedChoices: Record<number, string>;
  revealedAnswers: Record<number, boolean>;
  onBack: () => void;
  onCopy: () => void;
  onExportPdf: () => void;
  onRegenerate: () => void;
  onRevealAll: () => void;
  onSelectChoice: (questionIndex: number, option: string) => void;
  onToggleAnswer: (questionIndex: number) => void;
}) {
  const title = result.structured?.title ?? `${TOOL_LABELS[result.tool]}: ${result.topic}`;
  const allAnswersShown =
    result.structured?.kind === "quiz" &&
    result.structured.questions.length > 0 &&
    result.structured.questions.every((_, index) => revealedAnswers[index]);

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-36 lg:pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin">
          <section className="bento-card overflow-hidden mb-gutter">
            <div className="p-5 md:p-6 bg-linear-to-br from-primary/15 via-white/5 to-transparent">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={onBack}
                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-surface px-3 py-1.5 text-xs font-label-sm text-secondary transition hover:text-on-background"
                  >
                    <Icon name="arrow_back" style={{ fontSize: 16 }} />
                    Edit prompt
                  </button>
                  <p className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                    {TOOL_LABELS[result.tool]} result
                  </p>
                  <h1 className="mt-2 font-headline-lg text-headline-lg text-on-background">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-secondary">Topic: {result.topic}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton icon="content_copy" label="Copy Text" onClick={onCopy} />
                  <ActionButton
                    icon="picture_as_pdf"
                    label="Export PDF"
                    onClick={onExportPdf}
                    primary
                  />
                  <ActionButton
                    icon={busy ? "progress_activity" : "autorenew"}
                    label={busy ? "Regenerating…" : "Regenerate"}
                    onClick={onRegenerate}
                    disabled={busy}
                  />
                  {result.structured?.kind === "quiz" ? (
                    <ActionButton
                      icon={allAnswersShown ? "visibility_off" : "visibility"}
                      label={allAnswersShown ? "Hide All Answers" : "Show All Answers"}
                      onClick={onRevealAll}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <ToolbarBadge
                  icon="bolt"
                  label={SOURCE_LABELS[result.source] ?? result.source}
                  tone="primary"
                />
                <ToolbarBadge icon="library_books" label="Printable result" />
                {result.structured?.kind === "quiz" ? (
                  <ToolbarBadge
                    icon="quiz"
                    label={`${result.structured.questions.length} questions`}
                  />
                ) : null}
              </div>
            </div>
          </section>

          {result.structured ? (
            <StructuredResult
              result={result.structured}
              selectedChoices={selectedChoices}
              revealedAnswers={revealedAnswers}
              onSelectChoice={onSelectChoice}
              onToggleAnswer={onToggleAnswer}
            />
          ) : (
            <RawResult text={result.text} />
          )}
        </div>
      </main>
    </div>
  );
}

function StructuredResult({
  result,
  selectedChoices,
  revealedAnswers,
  onSelectChoice,
  onToggleAnswer,
}: {
  result: StructuredAiResult;
  selectedChoices: Record<number, string>;
  revealedAnswers: Record<number, boolean>;
  onSelectChoice: (questionIndex: number, option: string) => void;
  onToggleAnswer: (questionIndex: number) => void;
}) {
  if (result.kind === "quiz") {
    return (
      <section className="grid grid-cols-1 gap-4" aria-label="Quiz questions">
        {result.questions.map((question, questionIndex) => {
          const revealed = !!revealedAnswers[questionIndex];
          return (
            <article
              key={`${question.question}-${questionIndex}`}
              className="bento-card p-5 md:p-6"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-label-sm text-primary">
                  {questionIndex + 1}
                </span>
                <div>
                  <p className="font-body-md text-base leading-7 text-on-background">
                    {question.question}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    Choose an option, then reveal the answer when you are ready.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {question.options.map((option, optionIndex) => {
                  const selected = selectedChoices[questionIndex] === option;
                  const correct = revealed && option === question.answer;
                  return (
                    <button
                      key={`${option}-${optionIndex}`}
                      type="button"
                      onClick={() => onSelectChoice(questionIndex, option)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                        correct
                          ? "border-primary/50 bg-primary/10"
                          : selected
                            ? "border-outline bg-surface-container-low"
                            : "border-outline-variant/70 bg-surface/30 hover:border-primary/30 hover:bg-surface-container-low/60"
                      }`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-label-sm ${
                          selected || correct
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-glass-border text-secondary"
                        }`}
                      >
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span className="font-body-md text-sm leading-5 text-on-surface">
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-outline-variant/60 pt-4">
                <button
                  type="button"
                  onClick={() => onToggleAnswer(questionIndex)}
                  className="inline-flex items-center gap-2 rounded-full border border-glass-border bg-glass-surface px-3 py-1.5 text-xs font-label-sm text-secondary transition hover:text-on-background"
                >
                  <Icon
                    name={revealed ? "visibility_off" : "visibility"}
                    style={{ fontSize: 16 }}
                  />
                  {revealed ? "Hide Answer" : "Reveal Answer"}
                </button>

                <div
                  className={`grid transition-all duration-300 ${
                    revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 p-4">
                      <p className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
                        Correct answer
                      </p>
                      <p className="mt-1 font-body-md text-sm text-on-background">
                        {question.answer}
                      </p>
                      <p className="mt-3 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                        Explanation
                      </p>
                      <p className="mt-1 font-body-md text-sm leading-6 text-on-surface">
                        {question.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  if (result.kind === "flashcards") {
    return (
      <section
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Flashcards"
      >
        {result.cards.map((card, index) => (
          <article key={`${card.front}-${index}`} className="bento-card p-5">
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-primary">
              Card {index + 1}
            </span>
            <h2 className="mt-2 font-headline-md text-[17px] leading-6 text-on-background">
              {card.front}
            </h2>
            {card.hint ? <p className="mt-3 text-xs text-secondary">Hint: {card.hint}</p> : null}
            <div className="mt-4 rounded-xl border border-outline-variant/60 bg-surface/40 p-4">
              <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Answer
              </p>
              <p className="mt-1 font-body-md text-sm leading-6 text-on-surface">{card.back}</p>
            </div>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4" aria-label="Generated content">
      {result.sections.map((section, index) => (
        <article key={`${section.heading}-${index}`} className="bento-card p-5 md:p-6">
          <p className="font-label-sm text-[10px] uppercase tracking-wider text-primary">
            Section {index + 1}
          </p>
          <h2 className="mt-2 font-headline-md text-[20px] text-on-background">
            {section.heading}
          </h2>
          {Array.isArray(section.body) ? (
            <ul className="mt-3 space-y-2">
              {section.body.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-6 text-on-surface">
                  <span className="mt-2 size-1.5 rounded-full bg-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-body-md text-sm leading-7 text-on-surface">{section.body}</p>
          )}
        </article>
      ))}

      {"keyTakeaways" in result && result.keyTakeaways?.length ? (
        <article className="bento-card p-5 md:p-6 border-primary/30 bg-primary/5">
          <h2 className="font-headline-md text-[20px] text-on-background">Key Takeaways</h2>
          <ul className="mt-3 space-y-2">
            {result.keyTakeaways.map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-6 text-on-surface">
                <Icon
                  name="check_circle"
                  className="mt-0.5 text-primary"
                  style={{ fontSize: 16 }}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}

function RawResult({ text }: { text: string }) {
  return (
    <section className="bento-card p-5 md:p-6">
      <pre className="whitespace-pre-wrap font-body-md text-sm leading-7 text-on-surface">
        {text}
      </pre>
    </section>
  );
}

function ToolbarBadge({
  icon,
  label,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  tone?: "neutral" | "primary";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-label-sm ${
        tone === "primary"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-glass-border bg-glass-surface text-secondary"
      }`}
    >
      <Icon name={icon} style={{ fontSize: 16 }} />
      {label}
    </span>
  );
}

function WorkflowNote({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface/35 p-4">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="text-primary" style={{ fontSize: 18 }} />
        <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-on-background">
          {title}
        </h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-secondary">{body}</p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-label-sm text-label-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-primary text-on-primary hover:opacity-90"
          : "border border-glass-border bg-glass-surface text-secondary hover:text-on-background"
      }`}
    >
      <Icon name={icon} className={disabled ? "animate-spin" : ""} style={{ fontSize: 17 }} />
      {label}
    </button>
  );
}
