import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProgress } from "@/hooks/use-progress";
import { useAuth } from "@/hooks/use-auth";

export type RecommendedMaterial = {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  subject: string | null;
  region: string | null;
  language: string | null;
  board: string | null;
  tags: string[];
  created_at: string;
  score: number;
  reasons: string[];
};

type Candidate = Omit<RecommendedMaterial, "score" | "reasons">;

type Facets = { subject: string | null; region: string | null; language: string | null; board: string | null; tags: string[] };

// Weight per progress status — items the user actively engaged with count more
const STATUS_WEIGHT: Record<string, number> = { reading: 3, completed: 2, saved: 1 };
// Weight per facet dimension — subject/language are stronger signals than tag overlap
const DIM_WEIGHT = { subject: 4, language: 3, region: 2, board: 2, tag: 1 };

export function useRecommendations(limit = 6) {
  const { user } = useAuth();
  const progressQ = useMyProgress();

  const progressIds = (progressQ.data ?? []).map((r) => r.material_id);

  // Fetch facets for materials the user already engaged with (affinity source)
  const historyQ = useQuery({
    queryKey: ["recs", "history", user?.id, progressIds.join(",")],
    enabled: !!user && progressIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, subject, region, language, board, tags")
        .in("id", progressIds);
      if (error) throw error;
      return data as (Facets & { id: string })[];
    },
  });

  // Fetch a candidate pool of live materials the user hasn't touched
  const candidatesQ = useQuery({
    queryKey: ["recs", "candidates", user?.id, progressIds.length],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("materials")
        .select("id, title, description, material_type, subject, region, language, board, tags, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(120);
      if (progressIds.length > 0) {
        // Exclude anything the user already engaged with
        q = q.not("id", "in", `(${progressIds.map((id) => `"${id}"`).join(",")})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const data = (() => {
    if (!candidatesQ.data) return [] as RecommendedMaterial[];

    // Build affinity vector from history
    const affinity = {
      subject: new Map<string, number>(),
      region: new Map<string, number>(),
      language: new Map<string, number>(),
      board: new Map<string, number>(),
      tag: new Map<string, number>(),
    };

    const progressByMat = new Map<string, string>();
    (progressQ.data ?? []).forEach((p) => progressByMat.set(p.material_id, p.status));

    (historyQ.data ?? []).forEach((m) => {
      const w = STATUS_WEIGHT[progressByMat.get(m.id) ?? "saved"] ?? 1;
      const bump = (map: Map<string, number>, key: string | null) => {
        if (!key) return;
        map.set(key, (map.get(key) ?? 0) + w);
      };
      bump(affinity.subject, m.subject);
      bump(affinity.region, m.region);
      bump(affinity.language, m.language);
      bump(affinity.board, m.board);
      (m.tags ?? []).forEach((t) => bump(affinity.tag, t));
    });

    const hasAffinity =
      affinity.subject.size + affinity.region.size + affinity.language.size + affinity.board.size + affinity.tag.size >
      0;

    const scored = candidatesQ.data.map((m) => {
      const reasons: string[] = [];
      let score = 0;

      const check = (
        dim: keyof typeof DIM_WEIGHT,
        key: string | null,
        label?: string,
      ) => {
        if (!key) return;
        const map = affinity[dim];
        const a = map.get(key);
        if (a && a > 0) {
          score += a * DIM_WEIGHT[dim];
          if (label && reasons.length < 3) reasons.push(label);
        }
      };
      check("subject", m.subject, m.subject ? `Subject: ${m.subject}` : undefined);
      check("language", m.language, m.language ? `Language: ${m.language}` : undefined);
      check("region", m.region, m.region ? `Region: ${m.region}` : undefined);
      check("board", m.board, m.board ? `Board: ${m.board}` : undefined);
      (m.tags ?? []).forEach((t: string) => check("tag", t, `#${t}`));

      // Small freshness boost so ties break toward newer materials
      const ageDays = (Date.now() - new Date(m.created_at).getTime()) / 86_400_000;
      const freshness = Math.max(0, 5 - ageDays / 7); // decays over ~5 weeks
      score += freshness;

      return { ...m, score, reasons } as RecommendedMaterial;
    });

    // If no history yet, fall back to freshest picks
    if (!hasAffinity) {
      return scored
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)
        .map((m) => ({ ...m, reasons: ["New arrival"] }));
    }

    return scored
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  })();

  return {
    data,
    isLoading: progressQ.isLoading || candidatesQ.isLoading || historyQ.isLoading,
    isError: candidatesQ.isError || historyQ.isError,
    hasHistory: progressIds.length > 0,
  };
}
