import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { TopNav } from "@/components/TopNav";
import { useMyProgress, type ProgressStatus } from "@/hooks/use-progress";
import { ProgressControls } from "@/components/ProgressControls";

export const Route = createFileRoute("/_authenticated/my-list")({
  head: () => ({
    meta: [
      { title: "My List — Freducation" },
      { name: "description", content: "Your saved, in-progress, and completed study materials." },
      { property: "og:title", content: "My List — Freducation" },
      { property: "og:description", content: "Your saved, in-progress, and completed study materials." },
    ],
  }),
  component: MyListPage,
});

type Material = {
  id: string;
  title: string;
  description: string | null;
  material_type: "pdf" | "link" | "notes" | "image" | "mcq" | "video";
  subject: string | null;
  region: string | null;
  language: string | null;
  board: string | null;
  tags: string[];
};

const TABS: { key: ProgressStatus | "all"; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "list" },
  { key: "saved", label: "Read later", icon: "bookmark" },
  { key: "reading", label: "Reading", icon: "auto_stories" },
  { key: "completed", label: "Completed", icon: "task_alt" },
];

function MyListPage() {
  const [tab, setTab] = useState<ProgressStatus | "all">("all");
  const progressQ = useMyProgress();

  const ids = useMemo(() => (progressQ.data ?? []).map((r) => r.material_id), [progressQ.data]);

  const materialsQ = useQuery({
    queryKey: ["my-list", "materials", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, description, material_type, subject, region, language, board, tags")
        .in("id", ids);
      if (error) throw error;
      return data as Material[];
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, Material>();
    (materialsQ.data ?? []).forEach((x) => m.set(x.id, x));
    return m;
  }, [materialsQ.data]);

  const rows = (progressQ.data ?? [])
    .filter((r) => tab === "all" || r.status === tab)
    .map((r) => ({ progress: r, material: byId.get(r.material_id) }))
    .filter((r): r is { progress: typeof r.progress; material: Material } => !!r.material);

  const counts = {
    all: progressQ.data?.length ?? 0,
    saved: progressQ.data?.filter((r) => r.status === "saved").length ?? 0,
    reading: progressQ.data?.filter((r) => r.status === "reading").length ?? 0,
    completed: progressQ.data?.filter((r) => r.status === "completed").length ?? 0,
  };

  const loading = progressQ.isLoading || materialsQ.isLoading;

  const breakdowns = useMemo(() => {
    const dims = { subject: new Map<string, { total: number; completed: number; reading: number; saved: number }>(), region: new Map<string, { total: number; completed: number; reading: number; saved: number }>(), language: new Map<string, { total: number; completed: number; reading: number; saved: number }>() };
    (progressQ.data ?? []).forEach((p) => {
      const m = byId.get(p.material_id);
      if (!m) return;
      (["subject", "region", "language"] as const).forEach((dim) => {
        const key = (m[dim] as string | null) || "Unspecified";
        const bucket = dims[dim].get(key) ?? { total: 0, completed: 0, reading: 0, saved: 0 };
        bucket.total += 1;
        bucket[p.status] += 1;
        dims[dim].set(key, bucket);
      });
    });
    const toRows = (m: Map<string, { total: number; completed: number; reading: number; saved: number }>) =>
      Array.from(m.entries())
        .map(([label, v]) => ({ label, ...v, rate: v.total === 0 ? 0 : Math.round((v.completed / v.total) * 100) }))
        .sort((a, b) => b.total - a.total);
    return { subject: toRows(dims.subject), region: toRows(dims.region), language: toRows(dims.language) };
  }, [progressQ.data, byId]);

  const overallRate = counts.all === 0 ? 0 : Math.round((counts.completed / counts.all) * 100);

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-margin">
          <div className="mb-gutter">
            <h1 className="font-headline-lg text-headline-lg text-on-background">My List</h1>
            <p className="font-body-md text-secondary mt-1">
              Track what you're studying, save materials for later, and celebrate what you've finished.
            </p>
          </div>

          {!loading && counts.all > 0 && (
            <div className="mb-gutter grid grid-cols-1 lg:grid-cols-4 gap-gutter">
              <div className="bento-card p-5 lg:col-span-1 flex flex-col justify-between">
                <div>
                  <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mb-2">Completion rate</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-lg text-headline-lg text-on-background">{overallRate}%</span>
                    <span className="text-secondary font-body-md">{counts.completed} / {counts.all}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${overallRate}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-label-sm uppercase tracking-wider text-secondary">
                    <span className="inline-flex items-center gap-1"><Icon name="task_alt" style={{ fontSize: 12 }} className="text-emerald-400" /> {counts.completed} done</span>
                    <span className="inline-flex items-center gap-1"><Icon name="auto_stories" style={{ fontSize: 12 }} className="text-primary" /> {counts.reading} reading</span>
                    <span className="inline-flex items-center gap-1"><Icon name="bookmark" style={{ fontSize: 12 }} /> {counts.saved} later</span>
                  </div>
                </div>
              </div>

              <BreakdownCard title="By Subject" icon="school" rows={breakdowns.subject} />
              <BreakdownCard title="By Region" icon="public" rows={breakdowns.region} />
              <BreakdownCard title="By Language" icon="translate" rows={breakdowns.language} />
            </div>
          )}


          <div className="flex flex-wrap gap-2 mb-gutter">
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = counts[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-label-sm text-label-sm transition-colors ${
                    active
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-glass-surface border-glass-border text-secondary hover:text-on-background"
                  }`}
                >
                  <Icon name={t.icon} style={{ fontSize: 16 }} />
                  {t.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-black/40"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bento-card p-4">
                  <Skeleton className="h-6 w-2/3 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : progressQ.isError ? (
            <div className="bento-card p-10 text-center">
              <Icon name="cloud_off" className="text-error mx-auto mb-3" style={{ fontSize: 32 }} />
              <p className="font-body-md text-error">Couldn't load your list. Please try again.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bento-card p-10 text-center">
              <Icon name="bookmarks" className="text-secondary mx-auto mb-3" style={{ fontSize: 32 }} />
              <h3 className="font-headline-md text-headline-md text-on-background mb-1">Nothing here yet</h3>
              <p className="font-body-md text-secondary mb-4">
                Open any material and use the study controls to save it, mark it as reading, or complete it.
              </p>
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm"
              >
                <Icon name="menu_book" style={{ fontSize: 18 }} />
                Browse Library
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {rows.map(({ progress, material }) => (
                <div key={material.id} className="bento-card p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link
                      to="/material/$id"
                      params={{ id: material.id }}
                      className="font-headline-md text-headline-md text-on-surface text-[18px] hover:text-primary transition-colors line-clamp-2"
                    >
                      {material.title}
                    </Link>
                    <StatusBadge status={progress.status} />
                  </div>
                  {material.description && (
                    <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-3">
                      {material.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-outline-variant/50">
                    <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                      {new Date(progress.updated_at).toLocaleDateString()}
                    </p>
                    <ProgressControls materialId={material.id} variant="compact" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ProgressStatus }) {
  const map: Record<ProgressStatus, { label: string; icon: string; cls: string }> = {
    reading: { label: "Reading", icon: "auto_stories", cls: "bg-primary/20 text-primary border-primary/40" },
    saved: { label: "Later", icon: "bookmark", cls: "bg-surface/60 text-on-surface border-glass-border" },
    completed: { label: "Done", icon: "task_alt", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-label-sm text-[10px] uppercase tracking-wider ${s.cls}`}>
      <Icon name={s.icon} style={{ fontSize: 12 }} />
      {s.label}
    </span>
  );
}

type BreakdownRow = { label: string; total: number; completed: number; reading: number; saved: number; rate: number };

function BreakdownCard({ title, icon, rows }: { title: string; icon: string; rows: BreakdownRow[] }) {
  const top = rows.slice(0, 5);
  return (
    <div className="bento-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} className="text-secondary" style={{ fontSize: 16 }} />
        <h3 className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{title}</h3>
      </div>
      {top.length === 0 ? (
        <p className="font-body-md text-secondary text-sm">No data yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {top.map((r) => (
            <li key={r.label}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-body-md text-on-background truncate" title={r.label}>{r.label}</span>
                <span className="font-mono-code text-mono-code text-secondary text-[11px] shrink-0">
                  {r.completed}/{r.total} · {r.rate}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${r.rate}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
