import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProgress } from "@/hooks/use-progress";
import { useRecommendations } from "@/hooks/use-recommendations";
import { ProgressControls } from "@/components/ProgressControls";
import { exportPageViewsCsv } from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Freducation" },
      { name: "description", content: "Your regional learning hub — browse, upload and discover educational materials." },
      { property: "og:title", content: "Home — Freducation" },
      { property: "og:description", content: "Your regional learning hub — browse, upload and discover educational materials." },
    ],
  }),
  component: Home,
});

type MaterialRow = {
  id: string;
  title: string;
  material_type: string;
  region: string | null;
  status: string;
  created_at: string;
};

function formatType(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Home() {
  const { loading: authLoading, isAdmin, user } = useAuth();

  const recentQ = useQuery({
    queryKey: ["home", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, material_type, region, status, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as MaterialRow[];
    },
  });

  const statsQ = useQuery({
    queryKey: ["home", "stats"],
    queryFn: async () => {
      const [materials, live, collections] = await Promise.all([
        supabase.from("materials").select("id", { count: "exact", head: true }),
        supabase.from("materials").select("id", { count: "exact", head: true }).eq("status", "live"),
        supabase.from("collections").select("id", { count: "exact", head: true }),
      ]);
      return {
        totalMaterials: materials.count ?? 0,
        liveMaterials: live.count ?? 0,
        collections: collections.count ?? 0,
      };
    },
  });

  const viewsQ = useQuery({
    queryKey: ["home", "total_views"],
    enabled: isAdmin,
    queryFn: async () => {
      const [total, anon] = await Promise.all([
        supabase.rpc("total_page_views"),
        supabase.rpc("anonymous_page_views"),
      ]);
      if (total.error) throw total.error;
      if (anon.error) throw anon.error;
      return { total: Number(total.data ?? 0), anon: Number(anon.data ?? 0) };
    },
  });


  const progressQ = useMyProgress();
  const resumeTarget = (progressQ.data ?? []).find(
    (r) => r.status === "reading" || r.status === "saved",
  );
  const resumeQ = useQuery({
    queryKey: ["home", "resume", resumeTarget?.material_id],
    enabled: !!resumeTarget?.material_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title")
        .eq("id", resumeTarget!.material_id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; title: string } | null;
    },
  });

  const recs = useRecommendations(6);

  const loading = recentQ.isLoading || statsQ.isLoading || authLoading;
  const rows = recentQ.data ?? [];
  const hasError = recentQ.isError || statsQ.isError;

  const adminMetrics = [
    { label: "Collections", icon: "folder", value: statsQ.data?.collections.toLocaleString() ?? "—" },
    { label: "Materials", icon: "inventory_2", value: statsQ.data?.totalMaterials.toLocaleString() ?? "—" },
    { label: "Live", icon: "check_circle", value: statsQ.data?.liveMaterials.toLocaleString() ?? "—" },
    { label: "Sys Health", icon: "monitor_heart", value: hasError ? "!!!" : "OK", accent: hasError },
  ];

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-margin">

          {isAdmin ? (
            <>
              <div className="mb-gutter">
                <h1 className="font-headline-lg text-headline-lg text-on-background">System Overview</h1>
                <p className="text-secondary font-body-md mt-1">Recent uploads and telemetry across the ledger.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bento-card p-6 h-32 flex flex-col justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))
                  : adminMetrics.map((m) => (
                      <div
                        key={m.label}
                        className={`bento-card p-6 flex flex-col justify-between h-32 ${m.accent ? "border-error/30 bg-error-container/10" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-label-sm text-label-sm uppercase tracking-wider ${m.accent ? "text-error" : "text-secondary"}`}>
                            {m.label}
                          </span>
                          <Icon name={m.icon} className={m.accent ? "text-error" : "text-secondary"} style={{ fontSize: 14 }} />
                        </div>
                        <div className={`font-headline-lg text-headline-lg ${m.accent ? "text-error" : "text-on-background"}`}>{m.value}</div>
                      </div>
                    ))}
              </div>
            </>
          ) : (
            <>
              <div className="bento-card p-8 mb-gutter bg-gradient-to-br from-white/10 to-transparent">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mb-2">Welcome back</p>
                    <h1 className="font-headline-lg text-headline-lg text-on-background">Hi, {displayName} 👋</h1>
                    <p className="text-secondary font-body-md mt-2 max-w-xl">
                      Discover region-specific learning materials or contribute your own to help others learn.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {resumeQ.data && resumeTarget ? (
                      <Link
                        to="/material/$id"
                        params={{ id: resumeQ.data.id }}
                        title={`Resume: ${resumeQ.data.title}`}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm hover:opacity-90 transition max-w-[280px]"
                      >
                        <Icon name="play_circle" style={{ fontSize: 18 }} />
                        <span className="truncate">
                          Resume: {resumeQ.data.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider opacity-70 shrink-0">
                          {resumeTarget.status === "reading" ? "Reading" : "Saved"}
                        </span>
                      </Link>
                    ) : null}
                    <Link
                      to="/library"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-outline-variant text-on-background font-label-sm text-label-sm transition"
                    >
                      <Icon name="menu_book" style={{ fontSize: 18 }} />
                      Browse Library
                    </Link>
                    <Link
                      to="/ingest"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border-outline-variant text-on-background font-label-sm text-label-sm transition"
                    >
                      <Icon name="cloud_upload" style={{ fontSize: 18 }} />
                      Upload Material
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-gutter mb-gutter">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bento-card p-6 h-28 flex flex-col justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-7 w-16" />
                    </div>
                  ))
                ) : (
                  <>
                    <StatCard label="Total Views" icon="visibility" value={viewsQ.data?.total ?? 0} />
                    <StatCard label="Anonymous Views" icon="person_off" value={viewsQ.data?.anon ?? 0} />
                    <StatCard label="Collections" icon="folder" value={statsQ.data?.collections ?? 0} />
                    <StatCard label="Live Materials" icon="check_circle" value={statsQ.data?.liveMaterials ?? 0} />
                    <StatCard label="Total Materials" icon="inventory_2" value={statsQ.data?.totalMaterials ?? 0} />
                  </>
                )}
              </div>

              <div className="flex justify-end mb-gutter">
                <ExportViewsButton />
              </div>

            </>
          )}

          {!isAdmin && (recs.isLoading || recs.data.length > 0) && (
            <section className="mb-gutter">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-background text-[20px]">
                    {recs.hasHistory ? "Recommended for you" : "Fresh picks to get started"}
                  </h2>
                  <p className="font-body-md text-secondary text-sm mt-1">
                    {recs.hasHistory
                      ? "Based on subjects, regions, and languages in your reading history."
                      : "Save or start reading a few materials to personalize this feed."}
                  </p>
                </div>
                <Link to="/my-list" className="text-primary font-label-sm text-label-sm hover:underline shrink-0">
                  My List →
                </Link>
              </div>

              {recs.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bento-card p-5">
                      <Skeleton className="h-5 w-2/3 mb-3" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
                  {recs.data.map((m) => (
                    <div key={m.id} className="bento-card p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link
                          to="/material/$id"
                          params={{ id: m.id }}
                          className="font-headline-md text-headline-md text-on-surface text-[16px] hover:text-primary transition-colors line-clamp-2"
                        >
                          {m.title}
                        </Link>
                        <span className="text-[10px] font-label-sm uppercase tracking-wider text-secondary shrink-0 border border-glass-border rounded px-1.5 py-0.5">
                          {formatType(m.material_type)}
                        </span>
                      </div>
                      {m.description && (
                        <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-3 text-sm">
                          {m.description}
                        </p>
                      )}
                      {m.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {m.reasons.map((r) => (
                            <span key={r} className="text-[10px] font-label-sm text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto pt-3 border-t border-outline-variant/50 flex items-center justify-between gap-2">
                        <span className="font-mono-code text-mono-code text-secondary text-[11px] truncate">
                          {[m.subject, m.region, m.language].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <ProgressControls materialId={m.id} variant="compact" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}


          <div className="bento-card overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/50 bg-surface/40 backdrop-blur-sm flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-background text-[20px]">
                {isAdmin ? "Recent Material Uploads" : "Latest Materials"}
              </h3>
              <Link to="/library" className="text-primary font-label-sm text-label-sm hover:underline">
                View all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/50 bg-surface/40 backdrop-blur-sm">
                    {["Title", "Type", "Region", "Status", "Uploaded"].map((h) => (
                      <th key={h} className="py-3 px-6 font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono-code text-mono-code text-on-surface-variant">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-outline-variant/50 bg-surface/40">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="py-4 px-6"><Skeleton className="h-4 w-full max-w-[160px]" /></td>
                        ))}
                      </tr>
                    ))
                  ) : hasError ? (
                    <tr><td colSpan={5} className="py-10 text-center text-error font-body-md">Couldn't load materials. Try again in a moment.</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-secondary font-body-md">No materials yet — head to Ingest to add the first one.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-b border-outline-variant/50 hover:bg-surface-container-low/60 transition-colors bg-surface/40 cursor-pointer">
                        <td className="py-4 px-6 font-body-md text-on-background font-medium">
                          <Link to="/material/$id" params={{ id: r.id }} className="hover:text-primary">
                            {r.title}
                          </Link>
                        </td>
                        <td className="py-4 px-6">{formatType(r.material_type)}</td>
                        <td className="py-4 px-6">{r.region || "—"}</td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2 py-1 rounded border text-[12px] font-label-sm bg-primary-container/10 text-primary border-primary/20">
                            Live
                          </span>
                        </td>
                        <td className="py-4 px-6">{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, icon, value }: { label: string; icon: string; value: number }) {
  return (
    <div className="bento-card p-6 flex flex-col justify-between h-28">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{label}</span>
        <Icon name={icon} className="text-secondary" style={{ fontSize: 16 }} />
      </div>
      <div className="font-headline-lg text-headline-lg text-on-background">{value.toLocaleString()}</div>
    </div>
  );
}

function ExportViewsButton() {
  const fetchCsv = useServerFn(exportPageViewsCsv);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const { csv, count } = await fetchCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `page-views-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${count.toLocaleString()} rows`);
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-glass-surface border border-outline-variant text-on-background font-label-sm text-label-sm hover:bg-glass-surface/80 disabled:opacity-50"
    >
      <Icon name={busy ? "hourglass_top" : "download"} style={{ fontSize: 18 }} />
      {busy ? "Exporting…" : "Export page views CSV"}
    </button>
  );
}
