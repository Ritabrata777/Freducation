import { supabase } from "@/integrations/supabase/client";

export type AutoFlagConfig = {
  banned_keywords: string[];
  min_image_dim: number;
  link_timeout_ms: number;
};

export const DEFAULT_AUTO_FLAG_CONFIG: AutoFlagConfig = {
  banned_keywords: [
    "spam", "scam", "phishing", "malware", "porn", "nsfw",
    "hate", "slur", "kill yourself", "terror", "drug deal",
  ],
  min_image_dim: 400,
  link_timeout_ms: 8000,
};

export type AutoFlag = { code: string; message: string };

export async function loadAutoFlagConfig(): Promise<AutoFlagConfig> {
  const { data } = await supabase
    .from("auto_flag_config")
    .select("banned_keywords, min_image_dim, link_timeout_ms")
    .eq("id", true)
    .maybeSingle();
  if (!data) return DEFAULT_AUTO_FLAG_CONFIG;
  return {
    banned_keywords: (data.banned_keywords ?? DEFAULT_AUTO_FLAG_CONFIG.banned_keywords) as string[],
    min_image_dim: data.min_image_dim ?? DEFAULT_AUTO_FLAG_CONFIG.min_image_dim,
    link_timeout_ms: data.link_timeout_ms ?? DEFAULT_AUTO_FLAG_CONFIG.link_timeout_ms,
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function scanBanned(text: string, keywords: string[]): AutoFlag | null {
  const lower = text.toLowerCase();
  const hit = keywords
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .find((w) => lower.includes(w));
  return hit ? { code: "banned_content", message: `Contains restricted keyword "${hit}"` } : null;
}

export async function checkImageResolution(file: File, minDim: number): Promise<AutoFlag | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const shortEdge = Math.min(img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      if (shortEdge > 0 && shortEdge < minDim) {
        resolve({
          code: "low_resolution",
          message: `Image is ${img.naturalWidth}×${img.naturalHeight}, below ${minDim}px minimum`,
        });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ code: "unreadable_image", message: "Image file could not be decoded" });
    };
    img.src = url;
  });
}

export async function findDuplicateByHash(hash: string): Promise<AutoFlag | null> {
  const { data } = await supabase
    .from("materials")
    .select("id, title")
    .eq("content_hash", hash)
    .limit(1)
    .maybeSingle();
  if (data) {
    return { code: "duplicate_text", message: `Matches existing material "${data.title}"` };
  }
  return null;
}
