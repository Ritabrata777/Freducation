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

export const aiAutofillMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) throw new Error("AI API key not configured (set AI_API_KEY)");
    const apiUrl =
      process.env.AI_GATEWAY_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const model = process.env.AI_MODEL ?? "gemini-2.0-flash";

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Filename: ${data.filename}\nMIME: ${data.mimeType}\n${
          data.textSample ? `\nContent sample:\n"""${data.textSample.slice(0, 8000)}"""` : ""
        }`,
      },
    ];
    if (data.imageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: data.imageDataUrl } });
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI quota exhausted. Check your API billing.");
      throw new Error(`AI request failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
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
