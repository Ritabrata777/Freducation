import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { useServerFn } from "@tanstack/react-start";
import { Icon } from "@/components/Icon";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { aiAutofillMetadata } from "@/lib/ai-autofill.functions";
import { checkLinkReachable } from "@/lib/auto-flag.functions";
import { sha256Hex, scanBanned, checkImageResolution, findDuplicateByHash, loadAutoFlagConfig, type AutoFlag } from "@/lib/auto-flag";

const TEXT_EXT = /\.(txt|md|csv|json)$/i;
const IMAGE_EXT = /\.(png|jpe?g)$/i;

function readAsText(file: File, maxBytes = 200_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").slice(0, maxBytes));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file.slice(0, maxBytes));
  });
}
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_authenticated/ingest")({
  head: () => ({
    meta: [
      { title: "Document Ingestion — Freducation" },
      { name: "description", content: "Upload academic papers, datasets, and reference materials to the Freducation repository." },
      { property: "og:title", content: "Document Ingestion — Freducation" },
    ],
  }),
  component: IngestPage,
});

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx|txt|csv|json|zip|png|jpg|jpeg|md)$/i;

type MaterialType = "pdf" | "notes" | "image" | "link" | "video" | "mcq";

function IngestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType>("pdf");
  const [externalUrl, setExternalUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [region, setRegion] = useState("");
  const [board, setBoard] = useState("");
  const [language, setLanguage] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [trusted, setTrusted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_trusted_contributor", { _user_id: user.id }).then(({ data }) => {
      setTrusted(Boolean(data));
    });
  }, [user]);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();

  const isLink = materialType === "link" || materialType === "video";

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!ALLOWED.test(f.name)) {
      toast.error("Unsupported file type", { description: "Use PDF, DOCX, TXT, CSV, JSON, ZIP, PNG, JPG, or MD." });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("File too large", { description: "Maximum upload size is 500MB." });
      return;
    }
    setFile(f);
    toast.success("File attached", { description: f.name });
  };

  const [autofilling, setAutofilling] = useState(false);
  const autofillFn = useServerFn(aiAutofillMetadata);

  const [flags, setFlags] = useState<AutoFlag[]>([]);
  const linkCheckFn = useServerFn(checkLinkReachable);

  const reset = () => {
    setFile(null); setTitle(""); setDescription(""); setExternalUrl("");
    setSubject(""); setRegion(""); setBoard(""); setLanguage(""); setTagsInput("");
    setTitleError(undefined);
    setFlags([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function runAutoFlagChecks(): Promise<{ reasons: AutoFlag[]; contentHash: string | null }> {
    const reasons: AutoFlag[] = [];
    let contentHash: string | null = null;

    const cfg = await loadAutoFlagConfig();

    // Banned content in metadata
    const metaBlob = `${title} ${description} ${tagsInput}`;
    const metaBanned = scanBanned(metaBlob, cfg.banned_keywords);
    if (metaBanned) reasons.push(metaBanned);

    if (isLink && externalUrl.trim()) {
      try {
        const res = await linkCheckFn({ data: { url: externalUrl.trim(), timeoutMs: cfg.link_timeout_ms } });
        if (!res.ok) {
          reasons.push({
            code: "broken_link",
            message: `Link returned ${res.status || "no response"} — may be broken`,
          });
        }
      } catch {
        reasons.push({ code: "broken_link", message: "Link could not be reached" });
      }
    }

    if (!isLink && file) {
      if (IMAGE_EXT.test(file.name)) {
        const imgFlag = await checkImageResolution(file, cfg.min_image_dim);
        if (imgFlag) reasons.push(imgFlag);
      }
      if (TEXT_EXT.test(file.name)) {
        try {
          const text = await readAsText(file, 2_000_000);
          const bodyBanned = scanBanned(text, cfg.banned_keywords);
          if (bodyBanned && !reasons.some((r) => r.code === "banned_content")) {
            reasons.push(bodyBanned);
          }
          const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
          if (normalized.length >= 50) {
            contentHash = await sha256Hex(normalized);
            const dup = await findDuplicateByHash(contentHash);
            if (dup) reasons.push(dup);
          }
        } catch {
          // ignore read failures
        }
      }
    }


    return { reasons, contentHash };
  }


  const runAutofill = async () => {
    if (isLink) {
      if (!externalUrl.trim()) {
        toast.error("Enter a link URL first");
        return;
      }
    } else if (!file) {
      toast.error("Attach a file first");
      return;
    }
    setAutofilling(true);
    try {
      let textSample: string | undefined;
      let imageDataUrl: string | undefined;
      let filename = file?.name ?? externalUrl;
      let mimeType = file?.type || "application/octet-stream";

      if (isLink) {
        textSample = `External URL: ${externalUrl}`;
        mimeType = "text/uri-list";
      } else if (file) {
        if (TEXT_EXT.test(file.name)) {
          textSample = await readAsText(file);
        } else if (IMAGE_EXT.test(file.name) && file.size < 4 * 1024 * 1024) {
          imageDataUrl = await readAsDataUrl(file);
        }
      }

      const meta = await autofillFn({ data: { filename, mimeType, textSample, imageDataUrl } });
      if (meta.title && !title) setTitle(meta.title);
      if (meta.description && !description) setDescription(meta.description);
      if (meta.subject && !subject) setSubject(meta.subject);
      if (meta.board && !board) setBoard(meta.board);
      if (meta.region && !region) setRegion(meta.region);
      if (meta.language && !language) setLanguage(meta.language);
      if (meta.tags.length && !tagsInput) setTagsInput(meta.tags.join(", "));
      toast.success("Fields auto-filled", { description: "Review and edit before publishing." });
    } catch (err) {
      toast.error("Auto-fill failed", { description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setAutofilling(false);
    }
  };

  const commit = async () => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    if (!title.trim()) {
      setTitleError("Document title is required.");
      toast.error("Missing document title");
      return;
    }
    setTitleError(undefined);
    if (isLink) {
      if (!externalUrl.trim()) {
        toast.error("Link URL required");
        return;
      }
    } else if (!file) {
      toast.error("Attach a file to upload");
      return;
    }

    setSubmitting(true);
    try {
      let file_url: string | null = null;
      if (!isLink && file) {
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;
        file_url = path;
      }

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Run auto-flag checks (broken link, low-res image, duplicate text, banned content)
      const { reasons, contentHash } = await runAutoFlagChecks();
      setFlags(reasons);

      // Trusted contributors (admin, or 5+ live uploads with 0 reports) skip manual review
      const { data: trusted } = await supabase.rpc("is_trusted_contributor", { _user_id: user.id });
      // Any auto-flag routes to review regardless of trust
      const nextStatus = reasons.length > 0 ? "flagged" : trusted ? "live" : "pending";

      const { error: insErr } = await supabase.from("materials").insert({
        title: title.trim(),
        description: description.trim(),
        material_type: materialType,
        file_url,
        external_url: isLink ? externalUrl.trim() : null,
        tags,
        subject: subject.trim(),
        region: region.trim(),
        board: board.trim(),
        language: language.trim(),
        status: nextStatus,
        created_by: user.id,
        flag_reasons: reasons.map((r) => r.message),
        content_hash: contentHash,
      });
      if (insErr) throw insErr;

      if (reasons.length > 0) {
        toast.warning("Sent to review queue", {
          description: `Auto-flagged: ${reasons.map((r) => r.code.replaceAll("_", " ")).join(", ")}`,
        });
      } else if (trusted) {
        toast.success("Material published", { description: `${title} is now live in the library.` });
      } else {
        toast.success("Submitted for review", { description: "A moderator will publish it shortly. Trusted contributors skip this step." });
      }
      reset();
      navigate({ to: "/library" });
    } catch (err) {
      toast.error("Commit failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-on-background min-h-screen flex flex-col font-body-md text-body-md selection:bg-primary-container selection:text-on-primary-container">
      <TopNav />
      <main className="flex-1 flex flex-col pt-28">
        <div className="p-margin max-w-container-max mx-auto w-full flex-1 flex flex-col">

          <div className="mb-8">
            <h2 className="font-headline-lg text-headline-lg text-on-background">Document Ingestion</h2>
            <p className="font-body-md text-secondary mt-2 max-w-2xl">
              Upload academic papers, datasets, or reference materials — or share an external link. Everything you contribute is credited to you.
            </p>
            {trusted !== null && (
              <div className={`mt-4 glass-card rounded-xl p-3 flex items-center gap-3 text-sm ${trusted ? "border border-emerald-400/30" : ""}`}>
                <Icon name={trusted ? "verified" : "hourglass_top"} className={trusted ? "text-emerald-300" : "text-amber-300"} />
                <div className="flex-1 min-w-0">
                  {trusted ? (
                    <>
                      <p className="font-medium">Trusted contributor — auto-publish enabled</p>
                      <p className="text-secondary text-xs">Your uploads go live immediately, no manual review.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Pending review</p>
                      <p className="text-secondary text-xs">Reach 5 approved uploads with zero reports to unlock auto-publish.</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 gap-gutter flex-1">
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
              <div className="bento-card p-6 flex-1 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-6">
                  <h3 className="font-label-sm text-label-sm text-on-surface tracking-widest uppercase">
                    {isLink ? "External Link" : "Source File"}
                  </h3>
                  <span className="px-2 py-1 bg-surface/60 text-secondary text-[10px] font-mono-code rounded-sm">
                    {isLink ? "URL" : "MAX 500MB"}
                  </span>
                </div>

                {isLink ? (
                  <div className="flex-1 flex flex-col justify-center">
                    <label className="font-label-sm text-on-surface mb-2">Link URL</label>
                    <input
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      placeholder="https://youtu.be/… or https://en.wikipedia.org/…"
                      className="w-full h-12 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:outline-none focus:border-primary"
                      type="url"
                    />
                    <p className="font-body-md text-secondary mt-3">
                      Point learners at a YouTube video, Wikipedia article, Google Drive doc, or any public URL.
                    </p>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      acceptFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-2 border-dashed border-glass-border rounded-lg bg-surface/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 transition-colors duration-200 group cursor-pointer hover:bg-surface/60 hover:border-primary"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt,.csv,.json,.zip,.png,.jpg,.jpeg,.md"
                      onChange={(e) => acceptFile(e.target.files?.[0])}
                    />
                    <div className="w-16 h-16 rounded-full bg-surface/60 flex items-center justify-center mb-4 group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                      <Icon name={file ? "description" : "cloud_upload"} style={{ fontSize: 30 }} />
                    </div>
                    {file ? (
                      <>
                        <h4 className="font-headline-md text-headline-md text-on-surface mb-2">{file.name}</h4>
                        <p className="font-body-md text-secondary mb-6 text-center max-w-md">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB · ready to commit
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="bg-surface/60 text-on-surface border border-glass-border px-6 py-2 rounded font-label-sm hover:bg-surface/80 transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <h4 className="font-headline-md text-headline-md text-on-surface mb-2">Drag &amp; Drop files here</h4>
                        <p className="font-body-md text-secondary mb-6 text-center max-w-md">
                          Supported: PDF, DOCX, TXT, CSV, JSON, ZIP, PNG, JPG, MD.
                        </p>
                        <button type="button" className="bg-primary text-on-primary px-6 py-2 rounded font-label-sm hover:bg-surface-tint transition-colors">
                          Browse Files
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
              <div className="bento-card p-6 flex-1">
                <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-4 mb-6">
                  <h3 className="font-label-sm text-label-sm text-on-surface tracking-widest uppercase">Metadata</h3>
                  <button
                    type="button"
                    onClick={runAutofill}
                    disabled={autofilling}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-[11px] font-label-sm border border-glass-border transition-all ${
                      autofilling ? "opacity-70 cursor-not-allowed" : "hover:brightness-110"
                    }`}
                    title="Use AI to suggest title, description, tags, and more"
                  >
                    <Icon name={autofilling ? "progress_activity" : "auto_awesome"} style={{ fontSize: 14 }} className={autofilling ? "animate-spin" : ""} />
                    {autofilling ? "Thinking…" : "Auto-fill with AI"}
                  </button>
                </div>
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void commit();
                  }}
                >
                  <Field label="Title" error={titleError}>
                    <input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(undefined); }}
                      aria-invalid={!!titleError}
                      className={`w-full h-10 px-3 bg-surface border rounded font-body-md placeholder:text-text-secondary transition-all ${
                        titleError ? "border-error focus:border-error" : "border-outline-variant focus:border-primary"
                      }`}
                      placeholder="e.g. Class 10 Physics — Optics"
                    />
                  </Field>

                  <Field label="Material Type">
                    <select
                      value={materialType}
                      onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                      className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded focus:border-primary font-body-md text-on-surface appearance-none"
                    >
                      <option value="pdf">PDF</option>
                      <option value="notes">Notes / Doc</option>
                      <option value="image">Image</option>
                      <option value="link">External Link</option>
                      <option value="video">Video (YouTube etc.)</option>
                      <option value="mcq">Quiz / MCQ</option>
                    </select>
                  </Field>

                  <Field label="Short Description">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary resize-none"
                      placeholder="What's inside? 1–2 lines."
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Subject">
                      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics"
                        className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary" />
                    </Field>
                    <Field label="Board">
                      <input value={board} onChange={(e) => setBoard(e.target.value)} placeholder="CBSE"
                        className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary" />
                    </Field>
                    <Field label="Region">
                      <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="India — WB"
                        className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary" />
                    </Field>
                    <Field label="Language">
                      <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English"
                        className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary" />
                    </Field>
                  </div>

                  <Field label="Tags (comma separated)">
                    <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="class-10, optics, ray-diagrams"
                      className="w-full h-10 px-3 bg-glass-surface border border-glass-border rounded font-body-md focus:border-primary" />
                  </Field>

                  <div className="mt-2 pt-4 border-t border-outline-variant flex gap-3">
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 border-outline-variant py-2 rounded font-label-sm transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`flex-1 bg-primary text-on-primary py-2 rounded font-label-sm flex justify-center items-center gap-2 ${
                        submitting ? "opacity-70 cursor-not-allowed" : "hover:bg-surface-tint"
                      }`}
                    >
                      {submitting ? (
                        <>
                          <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                          Publishing…
                        </>
                      ) : (
                        <>
                          <Icon name="check" style={{ fontSize: 14 }} /> Publish
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-label-sm text-on-surface text-label-sm">{label}</label>
      {children}
      {error && <span className="font-label-sm text-[11px] text-error">{error}</span>}
    </div>
  );
}
