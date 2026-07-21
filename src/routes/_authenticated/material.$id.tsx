import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";
import { ProgressControls } from "@/components/ProgressControls";
import { MaterialComments } from "@/components/MaterialComments";

export const Route = createFileRoute("/_authenticated/material/$id")({
  head: () => ({
    meta: [
      { title: "Material — Freducation" },
      { name: "description", content: "Preview and download a Freducation library material." },
      { property: "og:title", content: "Material — Freducation" },
      { property: "og:description", content: "Preview and download a Freducation library material." },
    ],
  }),
  component: MaterialPage,
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
  created_by: string | null;
  status: string;
  flag_reasons: string[] | null;
};

const TEXT_EXT = ["txt", "md", "csv", "json", "log", "yaml", "yml", "srt"];
const AUDIO_EXT = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
const VIDEO_EXT = ["mp4", "webm", "mov", "mkv", "m4v"];
const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"];

function extOf(path: string | null | undefined) {
  if (!path) return "";
  const clean = path.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

function detectKind(m: Material, ext: string): "pdf" | "image" | "video" | "audio" | "text" | "link" | "unknown" {
  if (m.external_url) return "link";
  if (ext === "pdf" || m.material_type === "pdf") return "pdf";
  if (IMG_EXT.includes(ext) || m.material_type === "image") return "image";
  if (VIDEO_EXT.includes(ext) || m.material_type === "video") return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (TEXT_EXT.includes(ext) || m.material_type === "notes") return "text";
  return "unknown";
}

function actionIcon(a: string) {
  if (a?.includes("delete")) return "delete";
  if (a?.includes("hide") || a?.includes("flag")) return "visibility_off";
  if (a?.includes("live") || a?.includes("approve")) return "check_circle";
  if (a?.includes("dismiss")) return "cancel";
  return "gavel";
}
function actionLabel(a: string) {
  const map: Record<string, string> = {
    material_hide: "hid this material",
    material_flag: "flagged this material",
    material_reject: "rejected this material",
    material_live: "approved this material",
    material_delete: "deleted this material",
    report_dismiss: "dismissed a report on this material",
  };
  return map[a] ?? a?.replaceAll("_", " ") ?? "moderated";
}



function MaterialPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [textBody, setTextBody] = useState<string | null>(null);

  const materialQ = useQuery({
    queryKey: ["material", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, description, material_type, external_url, file_url, tags, language, region, board, subject, created_at, created_by, status, flag_reasons")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Material | null;
    },
  });

  const authorQ = useQuery({
    queryKey: ["material", id, "author", materialQ.data?.created_by],
    enabled: !!materialQ.data?.created_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", materialQ.data!.created_by!)
        .maybeSingle();
      return data;
    },
  });

  const modLogQ = useQuery({
    queryKey: ["material", id, "moderation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("moderation_log")
        .select("id, action, actor_name, reason, target_label, created_at, metadata")
        .or(`target_id.eq.${id},metadata->>material_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const material = materialQ.data;
  const ext = extOf(material?.file_url ?? material?.external_url ?? null);
  const kind = material ? detectKind(material, ext) : "unknown";

  useEffect(() => {
    if (!material) return;
    let active = true;
    (async () => {
      setUrlLoading(true);
      if (material.external_url) {
        if (active) {
          setSignedUrl(material.external_url);
          setUrlLoading(false);
        }
        return;
      }
      if (!material.file_url) {
        if (active) setUrlLoading(false);
        return;
      }
      const { data, error } = await supabase.storage
        .from("materials")
        .createSignedUrl(material.file_url, 60 * 30);
      if (!active) return;
      if (error || !data?.signedUrl) {
        toast.error("Couldn't load file", { description: error?.message ?? "File unavailable." });
        setUrlLoading(false);
        return;
      }
      setSignedUrl(data.signedUrl);
      setUrlLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [material]);

  useEffect(() => {
    if (kind !== "text" || !signedUrl) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(signedUrl);
        const t = await res.text();
        if (active) setTextBody(t);
      } catch {
        if (active) setTextBody(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [kind, signedUrl]);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const buildFilename = (blob: Blob) => {
    const base =
      material?.file_url?.split("/").pop() ||
      material?.title?.replace(/[\\/:*?"<>|]+/g, "_") ||
      "download";
    if (/\.[a-z0-9]{1,8}$/i.test(base)) return base;
    const mimeExt: Record<string, string> = {
      "application/pdf": "pdf",
      "text/plain": "txt",
      "text/markdown": "md",
      "text/csv": "csv",
      "application/json": "json",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };
    const guess = mimeExt[blob.type] || ext;
    return guess ? `${base}.${guess}` : base;
  };

  const download = async () => {
    if (!material || downloading) return;
    setDownloadError(null);
    setDownloadProgress(0);

    // External links open in a new tab rather than downloading.
    if (material.external_url) {
      window.open(material.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    setDownloading(true);
    try {
      let blob: Blob | null = null;
      // Try streaming the signed URL for progress feedback; fall back to the
      // Supabase storage API if the fetch fails (e.g. CORS).
      if (signedUrl) {
        try {
          const res = await fetch(signedUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentLength = res.headers.get("content-length");
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          const reader = res.body?.getReader();
          if (!reader) throw new Error("Readable stream not available");
          const chunks: BlobPart[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              if (total) setDownloadProgress(Math.round((received / total) * 100));
            }
          }
          blob = new Blob(chunks);
        } catch (fetchErr) {
          if (material.file_url) {
            const { data, error } = await supabase.storage
              .from("materials")
              .download(material.file_url);
            if (error) throw error;
            blob = data;
          } else {
            throw fetchErr;
          }
        }
      } else if (material.file_url) {
        const { data, error } = await supabase.storage
          .from("materials")
          .download(material.file_url);
        if (error) throw error;
        blob = data;
      }
      if (!blob) throw new Error("No file available to download.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(blob);
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Download started");
    } catch (err) {
      setDownloadError((err as Error).message);
      setDownloadProgress(0);
      toast.error("Download failed", { description: (err as Error).message });
    } finally {
      setDownloading(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", { description: "Material URL copied to clipboard." });
    } catch {
      toast.error("Could not copy link");
    }
  };

  const isTypingTarget = (el: EventTarget | null): boolean =>
    el instanceof HTMLElement &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable);

  const downloadRef = useRef(download);
  downloadRef.current = download;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (fullscreen) {
          setFullscreen(false);
        } else {
          navigate({ to: "/library" });
        }
        return;
      }
      if ((e.key === "d" || e.key === "D") && !isTypingTarget(e.target)) {
        e.preventDefault();
        downloadRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, navigate]);

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant">
        <div className="max-w-container-max mx-auto px-margin pt-4 pb-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] font-label-sm uppercase tracking-wider text-secondary mb-2">
            <Link to="/library" className="hover:text-primary transition-colors inline-flex items-center gap-1">
              <Icon name="menu_book" style={{ fontSize: 14 }} />
              Library
            </Link>
            <Icon name="chevron_right" style={{ fontSize: 14 }} className="text-text-muted" />
            <span className="text-on-surface-variant truncate max-w-[40ch] normal-case tracking-normal">
              {materialQ.isLoading ? "Loading…" : material?.title ?? "Not found"}
            </span>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-outline-variant font-label-sm text-label-sm shrink-0"
            >
              <Icon name="arrow_back" style={{ fontSize: 18 }} />
              Back to Library
            </Link>
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                {material?.material_type ?? "material"}
              </p>
              <h1 className="font-headline-md text-headline-md text-on-background truncate text-[20px]">
                {materialQ.isLoading ? "Loading…" : material?.title ?? "Not found"}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(signedUrl || material?.external_url) && (
                <button
                  onClick={download}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Icon
                    name={downloading ? "progress_activity" : "download"}
                    className={downloading ? "animate-spin" : ""}
                    style={{ fontSize: 18 }}
                  />
                  {downloading
                    ? downloadProgress > 0
                      ? `${downloadProgress}%`
                      : "Downloading…"
                    : "Download"}
                </button>
              )}

              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-outline-variant font-label-sm text-label-sm"
                >
                  <Icon name="open_in_new" style={{ fontSize: 18 }} />
                  Open
                </a>
              )}
              <button
                onClick={share}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-outline-variant font-label-sm text-label-sm"
              >
                <Icon name="share" style={{ fontSize: 18 }} />
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      {downloading && (
        <div className="max-w-container-max mx-auto px-margin pb-gutter">
          <div className="bento-card p-4 flex items-center gap-4">
            <Icon
              name="progress_activity"
              className="animate-spin text-primary"
              style={{ fontSize: 20 }}
            />
            <div className="flex-1">
              <p className="font-label-sm text-label-sm text-on-surface mb-2">
                Downloading {material?.title ?? "file"}…
              </p>
              <div className="h-2 bg-surface-container/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
            <span className="font-label-sm text-label-sm text-secondary">
              {downloadProgress > 0 ? `${downloadProgress}%` : "Preparing…"}
            </span>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="max-w-container-max mx-auto px-margin pb-gutter">
          <div className="bento-card p-4 flex items-start gap-3 border border-error">
            <Icon
              name="error"
              className="text-error"
              style={{ fontSize: 20 }}
            />
            <div className="flex-1">
              <p className="font-label-sm text-label-sm text-on-surface">
                Download failed
              </p>
              <p className="font-body-sm text-body-sm text-secondary">
                {downloadError}
              </p>
            </div>
            <button
              onClick={download}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm"
            >
              <Icon name="refresh" style={{ fontSize: 18 }} />
              Retry
            </button>
          </div>
        </div>
      )}

      <main className={`max-w-container-max mx-auto px-margin grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-gutter ${downloading || downloadError ? "pb-gutter" : "py-gutter"}`}>
        <section className="bento-card overflow-hidden min-h-[70vh] flex flex-col">
          {materialQ.isLoading || urlLoading ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <div className="flex items-center gap-2 text-secondary">
                <Icon name="progress_activity" className="animate-spin" />
                <span className="font-label-sm">Loading preview…</span>
              </div>
            </div>
          ) : !material ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <Icon name="error" className="text-error mb-3" style={{ fontSize: 40 }} />
              <p className="font-body-md text-on-surface mb-4">Material not found.</p>
              <Link to="/library" className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm">
                Back to Library
              </Link>
            </div>
          ) : !signedUrl ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <p className="text-secondary font-body-md">No preview available.</p>
            </div>
          ) : kind === "image" ? (
            <div className="flex-1 flex items-center justify-center bg-surface/30 p-4 relative group/media">
              <img src={signedUrl} alt={material.title} className="max-w-full max-h-[80vh] object-contain" />
              <button
                onClick={() => setFullscreen(true)}
                className="absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-overlay text-white font-label-sm text-label-sm opacity-0 group-hover/media:opacity-100 transition-opacity"
                aria-label="Fullscreen"
              >
                <Icon name="fullscreen" style={{ fontSize: 18 }} />
                Fullscreen
              </button>
            </div>
          ) : kind === "video" ? (
            <div className="flex-1 bg-black flex items-center justify-center relative group/media">
              <video src={signedUrl} controls className="max-w-full max-h-[80vh]" />
              <button
                onClick={() => setFullscreen(true)}
                className="absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-overlay text-white font-label-sm text-label-sm opacity-0 group-hover/media:opacity-100 transition-opacity"
                aria-label="Fullscreen"
              >
                <Icon name="fullscreen" style={{ fontSize: 18 }} />
                Fullscreen
              </button>
            </div>

          ) : kind === "audio" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 bg-surface/30">
              <Icon name="graphic_eq" className="text-primary" style={{ fontSize: 64 }} />
              <audio src={signedUrl} controls className="w-full max-w-lg" />
            </div>
          ) : kind === "pdf" ? (
            <iframe src={signedUrl} title={material.title} className="flex-1 w-full border-0 min-h-[80vh]" />
          ) : kind === "text" ? (
            <div className="flex-1 overflow-auto p-6 bg-surface/30">
              {textBody === null ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <pre className="font-mono-code text-[13px] leading-6 whitespace-pre-wrap break-words text-on-surface">
                  {textBody}
                </pre>
              )}
            </div>
          ) : kind === "link" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <Icon name="link" className="text-primary mb-3" style={{ fontSize: 40 }} />
              <p className="font-body-md text-on-surface mb-2 break-all max-w-lg">{signedUrl}</p>
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm mt-3"
              >
                <Icon name="open_in_new" style={{ fontSize: 18 }} />
                Open external resource
              </a>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <Icon name="description" className="text-secondary mb-3" style={{ fontSize: 40 }} />
              <p className="font-body-md text-on-surface mb-4">
                This file type can't be previewed inline{ext ? ` (.${ext})` : ""}.
              </p>
              <button
                onClick={download}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm"
              >
                <Icon name="download" style={{ fontSize: 18 }} />
                Download file
              </button>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-gutter h-fit">
          {material && <ProgressControls materialId={material.id} variant="full" />}
          <div className="bento-card p-6">
            <h2 className="font-headline-md text-[16px] text-on-background mb-4">Details</h2>
          {material?.description && (
            <p className="font-body-md text-on-surface-variant mb-4">{material.description}</p>
          )}
          <dl className="space-y-3 font-body-md text-[13px]">
            {material?.created_by && (
              <div className="flex justify-between gap-4 border-b border-outline-variant/50 pb-2">
                <dt className="text-secondary uppercase font-label-sm text-[11px] tracking-wider">Contributor</dt>
                <dd className="text-on-surface text-right">
                  <Link
                    to="/u/$userId"
                    params={{ userId: material.created_by }}
                    className="inline-flex items-center gap-1 hover:underline text-primary"
                  >
                    <Icon name="person" className="text-sm" />
                    {authorQ.data?.display_name ?? "View profile"}
                  </Link>
                </dd>
              </div>
            )}
            {[
              ["Subject", material?.subject],
              ["Board", material?.board],
              ["Region", material?.region],
              ["Language", material?.language],
              ["Type", material?.material_type],
              ["Format", ext ? `.${ext}` : "—"],
              ["Added", material?.created_at ? new Date(material.created_at).toLocaleDateString() : "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 border-b border-outline-variant/50 pb-2 last:border-0">
                <dt className="text-secondary uppercase font-label-sm text-[11px] tracking-wider">{k}</dt>
                <dd className="text-on-surface text-right break-words">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {material?.tags?.length ? (
            <div className="mt-4">
              <p className="text-secondary uppercase font-label-sm text-[11px] tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {material.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-surface/60 border border-glass-border-subtle text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider rounded-sm">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          </div>
        </aside>
      </main>

      {material && (
        <div className="max-w-container-max mx-auto px-margin pb-gutter space-y-gutter">
          <AppealPanel material={material} />
          <MaterialComments materialId={material.id} />
          {modLogQ.data && modLogQ.data.length > 0 && (
            <section className="bento-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="gavel" className="text-secondary" />
                <h2 className="font-headline-md text-[16px]">Moderation history</h2>
                <span className="text-xs text-secondary">Public transparency log</span>
              </div>
              <ul className="space-y-3">
                {modLogQ.data.map((e: any) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm border-b border-outline-variant/40 pb-3 last:border-0">
                    <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10">
                      <Icon name={actionIcon(e.action)} className="text-sm" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-on-surface">
                        <span className="font-medium">{e.actor_name ?? "Moderator"}</span>{" "}
                        <span className="text-secondary">{actionLabel(e.action)}</span>
                      </p>
                      {e.reason && <p className="text-secondary text-xs mt-0.5">Reason: {e.reason}</p>}
                    </div>
                    <span className="text-xs text-secondary shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}


      {fullscreen && signedUrl && (kind === "image" || kind === "video") && (
        <div
          className="fixed inset-0 z-50 bg-glass-overlay flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => e.key === "Escape" && setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 z-10 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-surface hover:bg-glass-surface-strong text-white font-label-sm"
            aria-label="Close fullscreen"
            autoFocus
          >
            <Icon name="close" style={{ fontSize: 18 }} />
            Close
          </button>
          {kind === "image" ? (
            <img src={signedUrl} alt={material?.title ?? ""} className="max-w-screen max-h-screen w-auto h-auto object-contain" />
          ) : (
            <video
              src={signedUrl}
              controls
              autoPlay
              className="max-w-screen max-h-screen w-auto h-auto"
            />
          )}
        </div>
      )}
    </div>
  );
}

type EvidenceDraft =
  | { kind: "link"; url: string; name?: string }
  | { kind: "file"; path: string; name: string; size?: number; content_type?: string };

function AppealPanel({ material }: { material: Material }) {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const isOwner = !!me && me === material.created_by;
  const needsAppeal = ["hidden", "removed", "flagged", "rejected", "pending"].includes(material.status);

  const appealQ = useQuery({
    queryKey: ["material", material.id, "my-appeal", me],
    enabled: isOwner && needsAppeal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_appeals")
        .select("id, status, reason, admin_note, evidence, created_at, resolved_at")
        .eq("material_id", material.id)
        .eq("user_id", me!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [reason, setReason] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!isOwner || !needsAppeal) return null;

  const existing = appealQ.data as
    | { id: string; status: string; reason: string; admin_note: string | null; evidence: EvidenceDraft[] | null; created_at: string; resolved_at: string | null }
    | null
    | undefined;
  const statusColor =
    existing?.status === "approved" ? "text-primary"
    : existing?.status === "rejected" ? "text-error"
    : "text-warning";

  const addLink = () => {
    try {
      const u = new URL(linkUrl.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are allowed.");
    } catch (e) {
      toast.error("Enter a valid http(s) URL", { description: e instanceof Error ? e.message : "" });
      return;
    }
    if (evidence.length >= 10) {
      toast.error("You can attach at most 10 pieces of evidence.");
      return;
    }
    setEvidence((es) => [...es, { kind: "link", url: linkUrl.trim(), name: linkName.trim() || undefined }]);
    setLinkUrl("");
    setLinkName("");
  };

  const onFile = async (file: File) => {
    if (!me) return;
    if (evidence.length >= 10) {
      toast.error("You can attach at most 10 pieces of evidence.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 15 MB per attachment." });
      return;
    }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const path = `${me}/appeals/${material.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("materials").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) throw error;
      setEvidence((es) => [
        ...es,
        { kind: "file", path, name: file.name, size: file.size, content_type: file.type || undefined },
      ]);
      toast.success("Evidence uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "" });
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = async (idx: number) => {
    const item = evidence[idx];
    if (item?.kind === "file") {
      // Best-effort cleanup; ignore failure so the UI stays consistent.
      await supabase.storage.from("materials").remove([item.path]).catch(() => {});
    }
    setEvidence((es) => es.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("Please explain your appeal (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const { submitAppeal } = await import("@/lib/admin.functions");
      await submitAppeal({ data: { material_id: material.id, reason: reason.trim(), evidence } });
      toast.success("Appeal submitted. A moderator will review it soon.");
      setReason("");
      setEvidence([]);
      appealQ.refetch();
    } catch (e) {
      toast.error("Could not submit appeal", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bento-card p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="campaign" className="text-warning" />
        <h2 className="font-headline-md text-[16px]">This upload is not publicly visible</h2>
      </div>
      <p className="text-secondary text-sm">
        Status: <span className="text-on-background">{material.status}</span>
        {material.flag_reasons && material.flag_reasons.length > 0 && (
          <> · Flags: <span className="text-on-background">{material.flag_reasons.join(", ")}</span></>
        )}
      </p>

      {appealQ.isLoading ? (
        <Skeleton className="h-24 w-full mt-4" />
      ) : existing ? (
        <div className="mt-4 space-y-2">
          <div className="text-sm">
            <span className="text-secondary">Your appeal is </span>
            <span className={`font-medium ${statusColor}`}>{existing.status}</span>
            <span className="text-secondary"> · submitted {new Date(existing.created_at).toLocaleString()}</span>
          </div>
          <div className="p-3 rounded bg-surface-container text-sm">
            <div className="text-secondary text-xs mb-1">Your reason</div>
            <div className="whitespace-pre-wrap">{existing.reason}</div>
          </div>
          {existing.admin_note && (
            <div className="p-3 rounded bg-surface-container text-sm">
              <div className="text-secondary text-xs mb-1">Moderator note</div>
              <div className="whitespace-pre-wrap">{existing.admin_note}</div>
            </div>
          )}
          {existing.evidence && existing.evidence.length > 0 && (
            <div className="p-3 rounded bg-surface-container text-sm">
              <div className="text-secondary text-xs mb-2">Evidence you attached</div>
              <ul className="space-y-1">
                {existing.evidence.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <Icon name={e.kind === "link" ? "link" : "attach_file"} style={{ fontSize: 14 }} />
                    <span className="truncate">{e.kind === "link" ? (e.name || e.url) : e.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {existing.status === "rejected" && (
            <p className="text-xs text-secondary">
              You can revise the material and submit a new appeal by editing then re-uploading. Repeated frivolous appeals may be blocked.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-secondary">Explain why this should be reviewed again</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="e.g. The banned-keyword match is a false positive — the term appears as part of a chapter title, not as sensitive content."
              className="mt-1 w-full px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background text-sm focus:outline-none"
            />
            <span className="text-xs text-secondary">{reason.length}/2000</span>
          </label>

          <div className="rounded-lg border border-outline-variant p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-background font-medium">Supporting evidence <span className="text-secondary font-normal">(optional, up to 10)</span></span>
              <span className="text-xs text-secondary">{evidence.length}/10</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://source-of-truth.example/page"
                className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background text-sm focus:outline-none"
              />
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Label (optional)"
                maxLength={200}
                className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={addLink}
                disabled={!linkUrl.trim() || evidence.length >= 10}
                className="px-3 py-2 rounded bg-glass-surface text-on-background text-sm disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Icon name="add_link" style={{ fontSize: 16 }} /> Add link
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded bg-glass-surface cursor-pointer w-fit">
              <Icon name={uploading ? "progress_activity" : "upload_file"} className={uploading ? "animate-spin" : ""} style={{ fontSize: 16 }} />
              <span>{uploading ? "Uploading…" : "Attach file (max 15 MB)"}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading || evidence.length >= 10}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>

            {evidence.length > 0 && (
              <ul className="space-y-1">
                {evidence.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs bg-surface-container rounded px-2 py-1">
                    <Icon name={e.kind === "link" ? "link" : "attach_file"} style={{ fontSize: 14 }} />
                    <span className="truncate flex-1">{e.kind === "link" ? (e.name || e.url) : `${e.name}${e.size ? ` · ${Math.round(e.size / 1024)} KB` : ""}`}</span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(i)}
                      className="text-secondary hover:text-error"
                      aria-label="Remove"
                    >
                      <Icon name="close" style={{ fontSize: 14 }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || reason.trim().length < 10}
            className="px-4 py-2 rounded bg-primary text-on-primary font-label-sm disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Request re-review"}
          </button>
        </div>
      )}
    </section>
  );
}

