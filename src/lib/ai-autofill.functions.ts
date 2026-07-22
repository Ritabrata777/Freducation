import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  filename: string;
  mimeType: string;
  // For text-ish files: raw text (client-truncated). For images: base64 data URL.
  textSample?: string;
  imageDataUrl?: string;
};

type MetadataResult = {
  title: string;
  description: string;
  subject: string;
  board: string;
  region: string;
  language: string;
  tags: string[];
  source?: "ai" | "fallback";
};

const SYSTEM = `You extract structured educational metadata from a single learning resource.
Use the actual extracted material content as the primary source of truth whenever it is present.
Infer the true academic subject/discipline from the content itself, not just the filename.
Summarize what the material contains in a specific, learner-friendly way.
Return concise fields. If unknown, use an empty string or empty array.
Respond ONLY with JSON matching:
{"title":string,"description":string,"subject":string,"board":string,"region":string,"language":string,"tags":string[]}
- title: short, <=80 chars
- description: 2-3 sentences, specific to the actual topics covered, <=320 chars
- subject: the best-fit discipline, e.g. "Physics", "Mechanical Engineering", "Medicine", "Computer Science"
- board: e.g. "CBSE", "ICSE", "IB", university/program if obvious, or "" if unclear
- region: e.g. "India — WB", "" if unclear
- language: e.g. "English"
- tags: 4-8 short lowercase kebab-case tags based on real topics in the material`;

const DEFAULT_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta";

function resolveApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.AI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Gemini API key not configured (set GEMINI_API_KEY or AI_API_KEY in .env)");
  }
  return apiKey.trim();
}

function resolveGeminiBaseUrl(): string {
  const configured = process.env.AI_GATEWAY_URL?.trim();
  if (!configured) return DEFAULT_GEMINI_URL;
  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return configured.replace(/\/+$/, "");
  } catch {
    throw new Error(
      "AI_GATEWAY_URL must be a full Gemini API base URL (e.g. https://generativelanguage.googleapis.com/v1beta). " +
        "Put your API key in GEMINI_API_KEY or AI_API_KEY, not AI_GATEWAY_URL.",
    );
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function extractJsonText(value: unknown): string {
  if (typeof value !== "string") return "{}";
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed || "{}";
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag).trim().toLowerCase())
    .map((tag) => tag.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .slice(0, 6);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function detectSubject(text: string): string {
  const lower = text.toLowerCase();
  const map: Array<{ subject: string; needles: string[] }> = [
    {
      subject: "Medicine",
      needles: [
        "medical",
        "medicine",
        "mbbs",
        "anatomy",
        "physiology",
        "pathology",
        "pharmacology",
        "surgery",
        "clinical",
        "diagnosis",
      ],
    },
    {
      subject: "Mechanical Engineering",
      needles: [
        "mechanical engineering",
        "mechanical",
        "thermodynamics",
        "fluid mechanics",
        "machine design",
        "manufacturing",
        "strength of materials",
        "heat transfer",
      ],
    },
    {
      subject: "Civil Engineering",
      needles: [
        "civil engineering",
        "civil",
        "surveying",
        "structural analysis",
        "concrete technology",
        "geotechnical",
        "transportation engineering",
        "environmental engineering",
      ],
    },
    {
      subject: "Electrical Engineering",
      needles: [
        "electrical engineering",
        "electrical",
        "power systems",
        "circuit theory",
        "machines",
        "control systems",
        "transformer",
        "transmission line",
      ],
    },
    {
      subject: "Electronics Engineering",
      needles: [
        "electronics engineering",
        "electronics",
        "digital electronics",
        "analog electronics",
        "microcontroller",
        "vlsi",
        "signals and systems",
        "embedded systems",
      ],
    },
    {
      subject: "Chemical Engineering",
      needles: [
        "chemical engineering",
        "chemical process",
        "process control",
        "mass transfer",
        "heat exchanger",
        "reaction engineering",
        "unit operations",
        "process dynamics",
      ],
    },
    {
      subject: "Biomedical Engineering",
      needles: [
        "biomedical engineering",
        "biomedical",
        "medical devices",
        "biomechanics",
        "bioinstrumentation",
        "prosthetics",
        "biomaterials",
        "clinical engineering",
      ],
    },
    {
      subject: "Aerospace Engineering",
      needles: [
        "aerospace engineering",
        "aerospace",
        "aerodynamics",
        "aircraft",
        "propulsion",
        "flight mechanics",
        "avionics",
        "spacecraft",
      ],
    },
    {
      subject: "Engineering",
      needles: ["engineering", "btech", "be", "mtech", "engineering drawing"],
    },
    {
      subject: "Computer Science",
      needles: [
        "computer science",
        "computer",
        "programming",
        "python",
        "java",
        "javascript",
        "algorithm",
        "database",
        "network",
        "operating system",
        "data structures",
      ],
    },
    {
      subject: "Physics",
      needles: [
        "physics",
        "optics",
        "electricity",
        "magnetism",
        "motion",
        "force",
        "waves",
        "mechanics",
      ],
    },
    {
      subject: "Chemistry",
      needles: [
        "chemistry",
        "chemical",
        "organic",
        "inorganic",
        "periodic table",
        "molecule",
        "atom",
        "acid",
        "base",
      ],
    },
    {
      subject: "Biology",
      needles: [
        "biology",
        "cell",
        "genetics",
        "evolution",
        "botany",
        "zoology",
        "photosynthesis",
        "microbiology",
      ],
    },
    {
      subject: "Mathematics",
      needles: [
        "mathematics",
        "math",
        "algebra",
        "geometry",
        "calculus",
        "trigonometry",
        "statistics",
        "probability",
        "equation",
        "linear algebra",
      ],
    },
    {
      subject: "Economics",
      needles: ["economics", "demand", "supply", "inflation", "market", "gdp", "trade"],
    },
    {
      subject: "Business Studies",
      needles: ["business", "accounting", "finance", "management", "marketing", "entrepreneurship"],
    },
    {
      subject: "Law",
      needles: ["law", "legal", "constitution", "jurisprudence", "contract", "criminal law"],
    },
    {
      subject: "History",
      needles: ["history", "civilization", "revolution", "empire", "war", "independence"],
    },
    {
      subject: "Geography",
      needles: ["geography", "climate", "soil", "map", "river", "earthquake", "continent"],
    },
    {
      subject: "Political Science",
      needles: [
        "political science",
        "democracy",
        "parliament",
        "rights",
        "government",
        "public policy",
      ],
    },
    {
      subject: "English",
      needles: ["english", "grammar", "poem", "poetry", "prose", "literature", "comprehension"],
    },
  ];

  let best: { subject: string; score: number } | null = null;
  for (const entry of map) {
    const score = entry.needles.reduce((sum, needle) => sum + (lower.includes(needle) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { subject: entry.subject, score };
    }
  }

  return best?.subject ?? "General Studies";
}

function detectBoard(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes("CBSE")) return "CBSE";
  if (upper.includes("ICSE")) return "ICSE";
  if (upper.includes("IGCSE")) return "IGCSE";
  if (upper.includes("IB")) return "IB";
  return "";
}

function detectLanguage(text: string): string {
  return /[\u0900-\u097F]/.test(text) ? "Hindi" : "English";
}

function summarizeSnippet(sample: string): string {
  const cleaned = sample.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentenceMatch = cleaned.match(/(.{80,260}?[.!?])(?:\s|$)/);
  if (sentenceMatch?.[1]) return sentenceMatch[1].trim();
  return `${cleaned.slice(0, 220).trim()}${cleaned.length > 220 ? "…" : ""}`;
}

function describeMaterialType(mimeType: string, filename: string): string {
  const lower = `${mimeType} ${filename}`.toLowerCase();
  if (lower.includes("pdf")) return "PDF study material";
  if (lower.includes("image") || /\.(png|jpe?g|gif|webp)$/i.test(filename)) {
    return "visual reference material";
  }
  if (lower.includes("uri-list") || /^https?:/i.test(filename)) return "linked learning resource";
  if (lower.includes("json") || lower.includes("csv") || lower.includes("zip")) {
    return "supplementary academic resource";
  }
  return "study material";
}

function buildFallbackDescription(args: {
  title: string;
  subject: string;
  board: string;
  language: string;
  mimeType: string;
  filename: string;
  sample: string;
}): string {
  const materialType = describeMaterialType(args.mimeType, args.filename);
  const parts = [
    `${args.title} appears to be ${materialType} for ${args.subject}.`,
    args.board
      ? `The content likely aligns with the ${args.board} curriculum and is written in ${args.language}.`
      : `The content is written in ${args.language} and seems intended for guided study, revision, or classroom reference.`,
  ];

  const snippet = summarizeSnippet(args.sample);
  if (snippet) {
    parts.push(`Based on the extracted text, it covers: ${snippet}`);
  }

  return parts.join(" ").slice(0, 420);
}

function buildFallbackMetadata(data: Input): MetadataResult {
  const rawName = data.filename.replace(/\.[^.]+$/, "");
  const normalizedName = rawName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const sample = data.textSample?.trim() ?? "";
  const combined = `${normalizedName}\n${sample}`.trim();
  const subject = detectSubject(combined);
  const board = detectBoard(combined);
  const language = detectLanguage(combined || rawName);
  const title = toTitleCase(normalizedName || "Untitled material").slice(0, 80);
  const description = buildFallbackDescription({
    title,
    subject,
    board,
    language,
    mimeType: data.mimeType,
    filename: data.filename,
    sample,
  });

  const tags = sanitizeTags([subject, board, language, ...normalizedName.split(/\s+/).slice(0, 4)]);

  return {
    title,
    description,
    subject,
    board,
    region: "",
    language,
    tags,
    source: "fallback",
  };
}

export const aiAutofillMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data }) => {
    const fallback = buildFallbackMetadata(data);

    let apiKey: string;
    let baseUrl: string;
    try {
      apiKey = resolveApiKey();
      baseUrl = resolveGeminiBaseUrl();
    } catch {
      return fallback;
    }

    const model = process.env.AI_MODEL ?? "gemini-2.0-flash";

    const parts: Array<Record<string, unknown>> = [
      {
        text: `Filename: ${data.filename}\nMIME: ${data.mimeType}\n${
          data.textSample
            ? `\nExtracted material text (primary evidence):\n"""${data.textSample.slice(0, 12000)}"""`
            : ""
        }`,
      },
    ];

    if (data.imageDataUrl) {
      const image = parseDataUrl(data.imageDataUrl);
      if (image) {
        parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
      }
    }

    const res = await fetch(`${baseUrl}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 402) {
        return fallback;
      }
      const body = await res.text();
      throw new Error(`AI request failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const partsText =
      json?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text ?? "")
        .join("\n") ?? "{}";
    const raw = extractJsonText(partsText);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return fallback;
    }

    const result: MetadataResult = {
      title: String(parsed.title ?? "").trim(),
      description: String(parsed.description ?? "").trim(),
      subject: String(parsed.subject ?? "").trim(),
      board: String(parsed.board ?? "").trim(),
      region: String(parsed.region ?? "").trim(),
      language: String(parsed.language ?? "").trim(),
      tags: sanitizeTags(parsed.tags),
      source: "ai",
    };

    return {
      ...fallback,
      ...result,
      title: result.title || fallback.title,
      description: result.description || fallback.description,
      subject: result.subject || fallback.subject,
      board: result.board || fallback.board,
      region: result.region || fallback.region,
      language: result.language || fallback.language,
      tags: result.tags.length > 0 ? result.tags : fallback.tags,
    };
  });
