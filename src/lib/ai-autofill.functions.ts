import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  filename: string;
  mimeType: string;
  // For text-ish files: raw text (client-truncated). For images: base64 data URL.
  textSample?: string;
  imageDataUrl?: string;
};

const SYSTEM = `You extract structured educational metadata from a single learning resource.
Return concise, learner-friendly fields. If unknown, use an empty string or empty array.
Respond ONLY with JSON matching:
{"title":string,"description":string,"subject":string,"board":string,"region":string,"language":string,"tags":string[]}
- title: short, <=80 chars
- description: 1-2 sentences, <=220 chars
- subject: e.g. "Physics", "History"
- board: e.g. "CBSE", "ICSE", "IB", "" if unclear
- region: e.g. "India — WB", "" if unclear
- language: e.g. "English"
- tags: 3-6 short lowercase kebab-case tags`;

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

export const aiAutofillMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data }) => {
    const apiKey = resolveApiKey();
    const baseUrl = resolveGeminiBaseUrl();
    const model = process.env.AI_MODEL ?? "gemini-2.0-flash";

    const parts: Array<Record<string, unknown>> = [
      {
        text: `Filename: ${data.filename}\nMIME: ${data.mimeType}\n${
          data.textSample ? `\nContent sample:\n"""${data.textSample.slice(0, 8000)}"""` : ""
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
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI quota exhausted. Check your API billing.");
      throw new Error(`AI request failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = {};
    }
    return {
      title: String(parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      subject: String(parsed.subject ?? ""),
      board: String(parsed.board ?? ""),
      region: String(parsed.region ?? ""),
      language: String(parsed.language ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  });
