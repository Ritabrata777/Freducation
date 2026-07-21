import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { TopNav } from "@/components/TopNav";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { adminDeleteMaterial, setMaterialStatus } from "@/lib/admin.functions";
import { ProgressControls } from "@/components/ProgressControls";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Freducation" },
      { name: "description", content: "Browse the central repository of academic materials in the Freducation library." },
      { property: "og:title", content: "Library — Freducation" },
      { property: "og:description", content: "Browse the central repository of academic materials in the Freducation library." },
    ],
  }),
  component: LibraryPage,
});

type Material = {
  id: string;
  title: string;
  description: string | null;
  material_type: "pdf" | "link" | "notes" | "image" | "mcq" | "video";
  external_url: string | null;
  file_url: string | null;
  tags: string[];
  language: string | null;
  region: string | null;
  board: string | null;
  subject: string | null;
  created_at: string;
};


function LibraryPage() {
  const [query, setQuery] = useState("");

  const materialsQ = useQuery({
    queryKey: ["library", "materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, description, material_type, external_url, file_url, tags, language, region, board, subject, created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as Material[];
    },
  });

  const filtered = useMemo(() => {
    const rows = materialsQ.data ?? [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [materialsQ.data, query]);

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav query={query} setQuery={setQuery} />
      <main className="pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-margin">
          <div className="mb-gutter flex items-baseline justify-between">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-background">Library</h1>
              <p className="font-body-md text-secondary mt-1">
                {materialsQ.isLoading ? "Loading materials…" : `${filtered.length} live ${filtered.length === 1 ? "material" : "materials"}`}
              </p>
            </div>
            <Link
              to="/ingest"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm"
            >
              <Icon name="add" style={{ fontSize: 18 }} />
              Contribute
            </Link>
          </div>

          {materialsQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter auto-rows-[280px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bento-card p-4">
                  <Skeleton className="h-32 w-full mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : materialsQ.isError ? (
            <div className="bento-card p-10 text-center">
              <Icon name="cloud_off" className="text-error mx-auto mb-3" style={{ fontSize: 32 }} />
              <p className="font-body-md text-error">Couldn't load the library. Please try again.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bento-card p-10 text-center">
              <Icon name="menu_book" className="text-secondary mx-auto mb-3" style={{ fontSize: 32 }} />
              <h3 className="font-headline-md text-headline-md text-on-background mb-1">Nothing here yet</h3>
              <p className="font-body-md text-secondary mb-4">
                {query ? "No materials match your filter." : "Be the first to contribute a study resource."}
              </p>
              <Link to="/ingest" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">
                <Icon name="cloud_upload" style={{ fontSize: 18 }} />
                Upload a material
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {filtered.map((m) => (
                <MaterialCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


const TYPE_ICON: Record<Material["material_type"], string> = {
  pdf: "picture_as_pdf",
  link: "link",
  notes: "sticky_note_2",
  image: "image",
  mcq: "quiz",
  video: "play_circle",
};

function MaterialCard({ m }: { m: Material }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteMaterial);
  const setStatus = useServerFn(setMaterialStatus);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["library", "materials"] });
  const hideM = useMutation({
    mutationFn: () => setStatus({ data: { materialId: m.id, status: "flagged" } }),
    onSuccess: () => { invalidate(); toast.success("Hidden from library"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });
  const delM = useMutation({
    mutationFn: () => del({ data: { materialId: m.id } }),
    onSuccess: () => { invalidate(); toast.success("Material deleted"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <div className="relative group">
      <Link
        to="/material/$id"
        params={{ id: m.id }}
        className="bento-card rounded flex flex-col overflow-hidden cursor-pointer transition-colors duration-300 min-h-[240px] text-left"
      >
        <div className="p-4 flex flex-col flex-1 h-full w-full">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 border border-glass-border-subtle bg-surface/60 flex items-center justify-center rounded">
              <Icon name={TYPE_ICON[m.material_type]} className="text-primary" />
            </div>
            <span className="px-2 py-0.5 bg-surface/60 border border-glass-border-subtle rounded font-mono-code text-[10px] uppercase text-on-surface-variant">
              {m.material_type}
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2 text-[18px]">
            {m.title}
          </h3>
          {m.description && (
            <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-2">{m.description}</p>
          )}
          <div className="mt-auto flex flex-wrap gap-1 pt-4 border-t border-outline-variant/50">
            {[m.subject, m.board, m.region, m.language, ...m.tags]
              .filter((t): t is string => !!t)
              .slice(0, 4)
              .map((t, idx) => (
                <span
                  key={`${t}-${idx}`}
                  className="px-1.5 py-0.5 bg-surface/60 border border-glass-border-subtle text-on-surface-variant font-label-sm text-[9px] uppercase tracking-wider rounded-sm"
                >
                  {t}
                </span>
              ))}
          </div>
        </div>
      </Link>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <ProgressControls materialId={m.id} variant="compact" />
        {isAdmin && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideM.mutate(); }}
              disabled={hideM.isPending}
              title="Hide from library (flag)"
              className="p-1.5 rounded bg-black/70 border border-glass-border text-secondary hover:text-on-background backdrop-blur-sm"
            ><Icon name="visibility_off" style={{ fontSize: 16 }} /></button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Permanently delete "${m.title}"?`)) delM.mutate(); }}
              disabled={delM.isPending}
              title="Delete permanently"
              className="p-1.5 rounded bg-black/70 border border-error/40 text-error hover:bg-error/20 backdrop-blur-sm"
            ><Icon name="delete" style={{ fontSize: 16 }} /></button>
          </>
        )}
      </div>
    </div>
  );
}

