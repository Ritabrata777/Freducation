import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { Icon } from "@/components/Icon";
import { RequireAdmin } from "@/components/RequireAdmin";
import { Skeleton } from "@/components/Skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReports, dismissReport, setMaterialStatus, adminDeleteMaterial, listModerationLog, listAutoFlagQueue, listAutoFlagStats, listAppeals, resolveAppeal } from "@/lib/admin.functions";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AUTO_FLAG_CONFIG, type AutoFlagConfig } from "@/lib/auto-flag";

export const Route = createFileRoute("/_authenticated/admin/policies")({
  head: () => ({
    meta: [
      { title: "Policies — Freducation" },
      { name: "description", content: "Moderation queue, regional access controls, and API integrations for Freducation administrators." },
      { property: "og:title", content: "Policies — Freducation" },
      { property: "og:description", content: "Moderation queue, regional access controls, and API integrations for Freducation administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <PoliciesPage />
    </RequireAdmin>
  ),
});

function PoliciesPage() {
  return (
    <div className="text-on-background font-body-md min-h-screen">
      <TopNav />
      <main className="pt-28 flex flex-col min-h-screen w-full max-w-[1440px] mx-auto">
        <div className="p-margin">

          <div className="grid grid-cols-12 gap-gutter">
            {/* Auto-flag settings */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <AutoFlagSettings />
            </div>

            {/* Contributor appeals */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <AppealsQueue />
            </div>

            {/* Auto-flag false-positive tracking */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <AutoFlagStats />
            </div>

            {/* Auto-flag review queue */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <AutoFlagQueue />
            </div>


            {/* Moderation queue */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <ReportsQueue />
            </div>

            {/* Moderation log */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-4">
              <ModerationLog />
            </div>



            {/* Moderation */}
            <div className="col-span-12 md:col-span-8 bento-card p-6 flex flex-col gap-6">
              <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md">Moderation Rules</h3>
                <span className="font-label-sm text-label-sm bg-surface-container px-2 py-1 rounded text-secondary">Active</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">Profanity Filter Level</label>
                  <select className="bg-glass-surface border border-glass-border rounded p-3 font-body-md w-full focus:ring-primary focus:border-primary">
                    <option>Strict</option>
                    <option>Moderate</option>
                    <option>Lenient</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">Auto-Ban Threshold (Flags)</label>
                    <input
                    type="number"
                    defaultValue={5}
                    className="bg-glass-surface border border-glass-border rounded p-3 font-body-md w-full focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <label className="font-label-sm text-label-sm text-on-surface-variant">Restricted Keywords (Comma separated)</label>
                  <textarea
                  defaultValue="spam, inappropriate, scam"
                  className="bg-glass-surface border border-glass-border rounded p-3 font-body-md w-full h-24 resize-none focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            {/* Regional */}
            <div className="col-span-12 md:col-span-4 bento-card p-6 flex flex-col gap-6">
              <div className="pb-4 border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md">Regional Access</h3>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { l: "North America", c: true },
                  { l: "Europe", c: true },
                  { l: "Asia Pacific", c: false },
                  { l: "Rest of World", c: false },
                ].map((r) => (
                  <label key={r.l} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={r.c}
                      className="w-4 h-4 text-primary focus:ring-primary border-outline-variant rounded"
                    />
                    <span className="font-body-md">{r.l}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* API */}
            <div className="col-span-12 bento-card p-6 flex flex-col gap-6">
              <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md">API Integrations</h3>
                <button className="flex items-center gap-2 text-primary font-label-sm text-label-sm hover:underline">
                  <Icon name="add" style={{ fontSize: 18 }} /> Add Key
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant">
                      {["Service Name", "API Key", "Status", "Actions"].map((h, i) => (
                        <th
                          key={h}
                          className={`py-3 px-4 font-label-sm text-label-sm text-on-surface-variant font-medium ${i === 3 ? "text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { s: "OpenAI", k: "sk-*******************", active: true },
                      { s: "SendGrid", k: "sg.*******************", active: false },
                    ].map((row) => (
                      <tr key={row.s} className="border-b border-outline-variant/50 hover:bg-surface/40 transition-colors">
                        <td className="py-4 px-4 font-body-md">{row.s}</td>
                        <td className="py-4 px-4 font-mono-code text-mono-code text-secondary">{row.k}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`font-label-sm text-label-sm px-2 py-1 rounded ${
                              row.active ? "bg-primary text-on-primary" : "bg-surface-container text-secondary"
                            }`}
                          >
                            {row.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button className="text-secondary hover:text-primary transition-colors">
                            <Icon name="edit" style={{ fontSize: 20 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReportsQueue() {
  const fetchReports = useServerFn(listReports);
  const dismiss = useServerFn(dismissReport);
  const setStatus = useServerFn(setMaterialStatus);
  const del = useServerFn(adminDeleteMaterial);
  const qc = useQueryClient();

  const reportsQ = useQuery({ queryKey: ["admin", "reports"], queryFn: () => fetchReports() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    qc.invalidateQueries({ queryKey: ["library", "materials"] });
  };

  const dismissM = useMutation({
    mutationFn: (input: { reportId: string; reason?: string }) => dismiss({ data: input }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["admin", "modlog"] }); toast.success("Report dismissed"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });
  const hideM = useMutation({
    mutationFn: (input: { materialId: string; reason?: string }) =>
      setStatus({ data: { materialId: input.materialId, status: "flagged", reason: input.reason } }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["admin", "modlog"] }); toast.success("Material hidden (flagged)"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });
  const deleteM = useMutation({
    mutationFn: (input: { materialId: string; reason?: string }) => del({ data: input }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["admin", "modlog"] }); toast.success("Material deleted"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });

  const askReason = (label: string) => {
    const r = window.prompt(`Reason for ${label} (optional, shown in the moderation log):`, "");
    // Returns null when the admin cancels — that means abort the action.
    return r;
  };


  const rows = reportsQ.data ?? [];

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <h3 className="font-headline-md text-headline-md">Moderation Queue</h3>
        <span className="font-label-sm text-label-sm bg-surface-container px-2 py-1 rounded text-secondary">
          {reportsQ.isLoading ? "…" : `${rows.length} open`}
        </span>
      </div>
      {reportsQ.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : reportsQ.isError ? (
        <p className="text-error font-body-md">Couldn't load reports.</p>
      ) : rows.length === 0 ? (
        <p className="text-secondary font-body-md py-4">Nothing flagged. All clear.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/50">
                {["Material", "Reason", "Reporter", "Status", "When", "Actions"].map((h) => (
                  <th key={h} className="py-2 px-3 font-label-sm text-label-sm text-secondary uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/40 hover:bg-surface/40">
                  <td className="py-3 px-3">
                    {r.material_id ? (
                      <Link to="/material/$id" params={{ id: r.material_id }} className="text-primary hover:underline font-body-md">
                        {r.material_title}
                      </Link>
                    ) : <span className="text-secondary">{r.material_title}</span>}
                  </td>
                  <td className="py-3 px-3 font-body-md text-on-surface-variant max-w-[280px] truncate" title={r.reason}>{r.reason}</td>
                  <td className="py-3 px-3 font-body-md text-on-surface-variant">{r.reporter_name}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded border border-outline-variant text-[10px] uppercase tracking-wider text-secondary">
                      {r.material_status ?? "—"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-secondary font-body-md text-sm">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          const reason = askReason("dismissing this report");
                          if (reason === null) return;
                          dismissM.mutate({ reportId: r.id, reason: reason || undefined });
                        }}
                        disabled={dismissM.isPending}
                        className="px-2 py-1 rounded border border-glass-border text-secondary hover:text-on-background text-xs disabled:opacity-40"
                      >Dismiss</button>
                      {r.material_id && (
                        <>
                          <button
                            onClick={() => {
                              const reason = askReason(`hiding "${r.material_title}"`);
                              if (reason === null) return;
                              hideM.mutate({ materialId: r.material_id, reason: reason || undefined });
                            }}
                            disabled={hideM.isPending}
                            className="px-2 py-1 rounded border border-glass-border text-secondary hover:text-on-background text-xs disabled:opacity-40"
                          >Hide</button>
                          <button
                            onClick={() => {
                              const reason = askReason(`deleting "${r.material_title}"`);
                              if (reason === null) return;
                              if (!confirm(`Permanently delete "${r.material_title}"?`)) return;
                              deleteM.mutate({ materialId: r.material_id, reason: reason || undefined });
                            }}
                            disabled={deleteM.isPending}
                            className="px-2 py-1 rounded bg-error/20 text-error border border-error/30 hover:bg-error/30 text-xs disabled:opacity-40"
                          >Delete</button>
                        </>
                      )}
                    </div>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type ModLogEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: "material_status_change" | "material_delete" | "user_delete" | "report_dismiss";
  target_type: "material" | "user" | "report";
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<ModLogEntry["action"], { label: string; icon: string; tone: string }> = {
  material_status_change: { label: "Status changed", icon: "flag", tone: "text-amber-300" },
  material_delete: { label: "Material deleted", icon: "delete_forever", tone: "text-error" },
  user_delete: { label: "User deleted", icon: "person_remove", tone: "text-error" },
  report_dismiss: { label: "Report dismissed", icon: "task_alt", tone: "text-primary" },
};

function ModerationLog() {
  const fetchLog = useServerFn(listModerationLog);
  const logQ = useQuery({ queryKey: ["admin", "modlog"], queryFn: () => fetchLog() });
  const entries = (logQ.data ?? []) as ModLogEntry[];

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <div>
          <h3 className="font-headline-md text-headline-md">Moderation Log</h3>
          <p className="text-secondary font-body-sm text-[12px] mt-1">
            Audit trail of who hid, deleted, or dismissed items — and why.
          </p>
        </div>
        <span className="font-label-sm text-label-sm bg-surface-container px-2 py-1 rounded text-secondary">
          {logQ.isLoading ? "…" : `${entries.length} entries`}
        </span>
      </div>
      {logQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : logQ.isError ? (
        <p className="text-error font-body-md">Couldn't load moderation log.</p>
      ) : entries.length === 0 ? (
        <p className="text-secondary font-body-md py-4">No moderation activity yet.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/40">
          {entries.map((e) => {
            const meta = ACTION_LABELS[e.action];
            const from = (e.metadata as any)?.from as string | undefined;
            const to = (e.metadata as any)?.to as string | undefined;
            return (
              <li key={e.id} className="py-3 flex items-start gap-3">
                <Icon name={meta.icon} className={meta.tone} style={{ fontSize: 20 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-label-sm text-label-sm text-on-surface">{meta.label}</span>
                    <span className="text-secondary font-body-sm text-[12px]">by</span>
                    <span className="font-body-md text-[13px] text-on-surface-variant">
                      {e.actor_name || e.actor_id?.slice(0, 8) || "unknown"}
                    </span>
                    <span className="text-secondary font-body-sm text-[11px]">
                      · {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 font-body-md text-[13px] text-on-surface-variant break-words">
                    {e.action === "material_status_change" ? (
                      <>
                        <span className="text-on-surface">{e.target_label || "(deleted)"}</span>
                        {from && to && (
                          <span className="text-secondary"> — <span className="uppercase text-[11px] tracking-wider">{from}</span> → <span className="uppercase text-[11px] tracking-wider text-on-surface">{to}</span></span>
                        )}
                      </>
                    ) : e.target_label ? (
                      <span className="text-on-surface">{e.target_label}</span>
                    ) : (
                      <span className="text-secondary">
                        {e.target_type} {e.target_id?.slice(0, 8) ?? ""}
                      </span>
                    )}
                  </div>
                  {e.reason ? (
                    <blockquote className="mt-1 border-l-2 border-primary/50 pl-3 text-on-surface-variant font-body-md text-[13px] italic">
                      {e.reason}
                    </blockquote>
                  ) : (
                    <p className="mt-1 text-secondary font-body-sm text-[12px] italic">No reason provided.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function AutoFlagQueue() {
  const fetchQueue = useServerFn(listAutoFlagQueue);
  const setStatus = useServerFn(setMaterialStatus);
  const del = useServerFn(adminDeleteMaterial);
  const qc = useQueryClient();

  const queueQ = useQuery({ queryKey: ["admin", "autoflag"], queryFn: () => fetchQueue() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "autoflag"] });
    qc.invalidateQueries({ queryKey: ["admin", "modlog"] });
    qc.invalidateQueries({ queryKey: ["library", "materials"] });
  };

  const approveM = useMutation({
    mutationFn: (input: { materialId: string; reason?: string }) =>
      setStatus({ data: { materialId: input.materialId, status: "live", reason: input.reason } }),
    onSuccess: () => { invalidate(); toast.success("Approved and published"); },
    onError: (e) => toast.error("Approve failed", { description: e instanceof Error ? e.message : "" }),
  });
  const rejectM = useMutation({
    mutationFn: (input: { materialId: string; reason?: string }) =>
      setStatus({ data: { materialId: input.materialId, status: "rejected", reason: input.reason } }),
    onSuccess: () => { invalidate(); toast.success("Rejected"); },
    onError: (e) => toast.error("Reject failed", { description: e instanceof Error ? e.message : "" }),
  });
  const deleteM = useMutation({
    mutationFn: (input: { materialId: string; reason?: string }) => del({ data: input }),
    onSuccess: () => { invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error("Delete failed", { description: e instanceof Error ? e.message : "" }),
  });

  const rows = queueQ.data ?? [];

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Icon name="rule" className="text-amber-300" />
          <h3 className="font-headline-md text-headline-md">Auto-flag Review Queue</h3>
        </div>
        <span className="font-label-sm text-label-sm bg-surface-container px-2 py-1 rounded text-secondary">
          {queueQ.isLoading ? "…" : `${rows.length} awaiting review`}
        </span>
      </div>
      <p className="text-secondary font-body-sm text-[12px] -mt-2">
        Uploads auto-flagged for broken links, low resolution, duplicate text, or banned content, plus items pending manual review.
      </p>
      {queueQ.isLoading ? (
        <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : queueQ.isError ? (
        <p className="text-error font-body-md">Couldn't load the queue.</p>
      ) : rows.length === 0 ? (
        <p className="text-secondary font-body-md py-4">Nothing waiting. Auto-flags are clear.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id} className="border border-outline-variant/50 rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                    r.status === "flagged" ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" : "bg-surface-container text-secondary border border-outline-variant"
                  }`}>{r.status}</span>
                  <Link to="/material/$id" params={{ id: r.id }} className="text-primary hover:underline font-body-md truncate">
                    {r.title}
                  </Link>
                  <span className="text-secondary text-xs">· {r.contributor_name}</span>
                  <span className="text-secondary text-xs">· {new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.flag_reasons.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {r.flag_reasons.map((reason, i) => (
                      <li key={i} className="text-[11px] px-2 py-0.5 rounded bg-error/15 text-error border border-error/30 inline-flex items-center gap-1">
                        <Icon name="flag" style={{ fontSize: 12 }} />{reason}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-secondary text-xs">No auto-flags — awaiting standard review.</p>
                )}
                {r.external_url && (
                  <a href={r.external_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-secondary hover:text-primary text-xs">
                    <Icon name="link" style={{ fontSize: 12 }} />{r.external_url}
                  </a>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    const reason = window.prompt("Approval note (optional):", "");
                    if (reason === null) return;
                    approveM.mutate({ materialId: r.id, reason: reason || undefined });
                  }}
                  disabled={approveM.isPending}
                  className="px-3 py-1.5 rounded bg-primary text-on-primary text-xs font-label-sm disabled:opacity-40"
                >Approve</button>
                <button
                  onClick={() => {
                    const reason = window.prompt("Reason for rejection:", "");
                    if (reason === null) return;
                    rejectM.mutate({ materialId: r.id, reason: reason || undefined });
                  }}
                  disabled={rejectM.isPending}
                  className="px-3 py-1.5 rounded border border-glass-border text-secondary hover:text-on-background text-xs disabled:opacity-40"
                >Reject</button>
                <button
                  onClick={() => {
                    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
                    const reason = window.prompt("Reason for deletion:", "");
                    if (reason === null) return;
                    deleteM.mutate({ materialId: r.id, reason: reason || undefined });
                  }}
                  disabled={deleteM.isPending}
                  className="px-3 py-1.5 rounded border border-error/40 text-error hover:bg-error/10 text-xs disabled:opacity-40"
                >Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AutoFlagSettings() {
  const qc = useQueryClient();
  const cfgQ = useQuery<AutoFlagConfig>({
    queryKey: ["admin", "auto_flag_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_flag_config")
        .select("banned_keywords, min_image_dim, link_timeout_ms")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return {
        banned_keywords: (data?.banned_keywords ?? DEFAULT_AUTO_FLAG_CONFIG.banned_keywords) as string[],
        min_image_dim: data?.min_image_dim ?? DEFAULT_AUTO_FLAG_CONFIG.min_image_dim,
        link_timeout_ms: data?.link_timeout_ms ?? DEFAULT_AUTO_FLAG_CONFIG.link_timeout_ms,
      };
    },
  });

  const [keywordsText, setKeywordsText] = useState("");
  const [minDim, setMinDim] = useState<number>(DEFAULT_AUTO_FLAG_CONFIG.min_image_dim);
  const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_AUTO_FLAG_CONFIG.link_timeout_ms);

  useEffect(() => {
    if (cfgQ.data) {
      setKeywordsText(cfgQ.data.banned_keywords.join(", "));
      setMinDim(cfgQ.data.min_image_dim);
      setTimeoutMs(cfgQ.data.link_timeout_ms);
    }
  }, [cfgQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      const keywords = keywordsText
        .split(/[,\n]/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      const dim = Math.max(0, Math.min(8000, Math.floor(Number(minDim) || 0)));
      const ms = Math.max(500, Math.min(60000, Math.floor(Number(timeoutMs) || 0)));
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("auto_flag_config")
        .update({
          banned_keywords: keywords,
          min_image_dim: dim,
          link_timeout_ms: ms,
          updated_at: new Date().toISOString(),
          updated_by: u.user?.id ?? null,
        })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "auto_flag_config"] });
      toast.success("Auto-flag settings saved");
    },
    onError: (e) => toast.error("Save failed", { description: e instanceof Error ? e.message : "" }),
  });

  const resetToDefaults = () => {
    setKeywordsText(DEFAULT_AUTO_FLAG_CONFIG.banned_keywords.join(", "));
    setMinDim(DEFAULT_AUTO_FLAG_CONFIG.min_image_dim);
    setTimeoutMs(DEFAULT_AUTO_FLAG_CONFIG.link_timeout_ms);
  };

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Icon name="tune" className="text-primary" />
          <h3 className="font-headline-md text-headline-md">Auto-flag Settings</h3>
        </div>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs text-secondary hover:text-on-background underline"
        >
          Reset to defaults
        </button>
      </div>
      <p className="text-secondary font-body-sm text-[12px] -mt-2">
        Applies to every new upload. Changes take effect immediately.
      </p>
      {cfgQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="font-label-sm text-label-sm text-secondary">
              Banned keywords <span className="text-secondary/70">(comma or newline separated)</span>
            </span>
            <textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              rows={3}
              className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background font-body-md focus:outline-none"
              placeholder="spam, scam, phishing"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-secondary">
              Minimum image dimension (px, short edge)
            </span>
            <input
              type="number"
              min={0}
              max={8000}
              value={minDim}
              onChange={(e) => setMinDim(Number(e.target.value))}
              className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background font-body-md focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-label-sm text-label-sm text-secondary">
              Link-check timeout (ms, 500–60000)
            </span>
            <input
              type="number"
              min={500}
              max={60000}
              step={500}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background font-body-md focus:outline-none"
            />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => saveM.mutate()}
              disabled={saveM.isPending}
              className="px-4 py-2 rounded bg-primary text-on-primary font-label-sm disabled:opacity-40"
            >
              {saveM.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function reasonLabel(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function AutoFlagStats() {
  const fetchStats = useServerFn(listAutoFlagStats);
  const q = useQuery({
    queryKey: ["admin", "auto_flag_stats"],
    queryFn: () => fetchStats(),
  });

  const totals = q.data?.totals;
  const reasons = q.data?.reasons ?? [];
  const maxTotal = reasons.reduce((m, r) => Math.max(m, r.total), 0) || 1;

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Icon name="analytics" className="text-primary" />
          <h3 className="font-headline-md text-headline-md">False-positive Tracking</h3>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="text-xs text-secondary hover:text-on-background underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-secondary font-body-sm text-[12px] -mt-2">
        Ratio of auto-flagged uploads that admins later approved (false positives) vs. hidden or removed (true positives). Use recurring high-FP reasons to tune thresholds above.
      </p>

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <p className="text-error font-body-sm">Failed to load stats.</p>
      ) : !totals || totals.flagged === 0 ? (
        <p className="text-secondary font-body-sm">No auto-flagged uploads yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile label="Flagged" value={totals.flagged} />
            <StatTile label="Approved (FP)" value={totals.approved} tone="warn" />
            <StatTile label="Hidden/Removed" value={totals.hidden} tone="ok" />
            <StatTile label="Pending" value={totals.pending} />
            <StatTile label="Overall FP rate" value={pct(totals.false_positive_rate)} tone={totals.false_positive_rate > 0.5 ? "warn" : "ok"} />
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-secondary font-label-sm text-left">
                <tr className="border-b border-outline-variant">
                  <th className="py-2 pr-3 font-normal">Reason</th>
                  <th className="py-2 pr-3 font-normal text-right">Total</th>
                  <th className="py-2 pr-3 font-normal text-right">Approved</th>
                  <th className="py-2 pr-3 font-normal text-right">Hidden</th>
                  <th className="py-2 pr-3 font-normal text-right">Pending</th>
                  <th className="py-2 pr-3 font-normal text-right">FP rate</th>
                  <th className="py-2 pl-3 font-normal">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map((r) => {
                  const decided = r.approved + r.hidden;
                  const highFP = decided >= 3 && r.false_positive_rate >= 0.6;
                  return (
                    <tr key={r.reason} className="border-b border-outline-variant/40 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-on-background">{reasonLabel(r.reason)}</span>
                          {highFP && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-warning/20 text-warning">
                              Tune threshold
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.total}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-warning">{r.approved}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.hidden}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-secondary">{r.pending}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {decided > 0 ? pct(r.false_positive_rate) : <span className="text-secondary">—</span>}
                      </td>
                      <td className="py-2 pl-3 min-w-[160px]">
                        <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden flex">
                          <div
                            className="h-full bg-warning/70"
                            style={{ width: `${(r.approved / maxTotal) * 100}%` }}
                            title={`Approved: ${r.approved}`}
                          />
                          <div
                            className="h-full bg-primary/70"
                            style={{ width: `${(r.hidden / maxTotal) * 100}%` }}
                            title={`Hidden: ${r.hidden}`}
                          />
                          <div
                            className="h-full bg-secondary/40"
                            style={{ width: `${(r.pending / maxTotal) * 100}%` }}
                            title={`Pending: ${r.pending}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : tone === "ok" ? "text-primary" : "text-on-background";
  return (
    <div className="rounded-lg bg-surface-container p-3 border border-outline-variant">
      <div className="text-[11px] text-secondary uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-headline-md ${color}`}>{value}</div>
    </div>
  );
}

function AppealsQueue() {
  const qc = useQueryClient();
  const fetchAppeals = useServerFn(listAppeals);
  const resolveFn = useServerFn(resolveAppeal);
  const q = useQuery({ queryKey: ["admin", "appeals"], queryFn: () => fetchAppeals() });

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const decide = async (id: string, decision: "approved" | "rejected", restore: boolean) => {
    setBusyId(id);
    try {
      await resolveFn({ data: { appeal_id: id, decision, admin_note: notes[id] || undefined, restore_material: restore } });
      toast.success(`Appeal ${decision}`);
      qc.invalidateQueries({ queryKey: ["admin", "appeals"] });
      qc.invalidateQueries({ queryKey: ["admin", "auto_flag_queue"] });
      qc.invalidateQueries({ queryKey: ["admin", "auto_flag_stats"] });
    } catch (e) {
      toast.error("Action failed", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusyId(null);
    }
  };

  const rows = q.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <>
      <div className="pb-4 flex justify-between items-center border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <Icon name="campaign" className="text-warning" />
          <h3 className="font-headline-md text-headline-md">Contributor Appeals</h3>
          {pending.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs">
              {pending.length} pending
            </span>
          )}
        </div>
        <button type="button" onClick={() => q.refetch()} className="text-xs text-secondary hover:text-on-background underline">
          Refresh
        </button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-secondary font-body-sm">No appeals submitted yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((a) => (
            <div key={a.id} className="rounded-lg border border-outline-variant p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link to="/material/$id" params={{ id: a.material_id }} className="font-medium text-on-background hover:underline">
                    {a.material_title}
                  </Link>
                  <div className="text-xs text-secondary mt-0.5">
                    by {a.contributor_name} · material status <span className="text-on-background">{a.material_status}</span>
                    {a.material_flag_reasons.length > 0 && (
                      <> · flags {a.material_flag_reasons.join(", ")}</>
                    )}
                  </div>
                </div>
                <span className="text-xs text-secondary shrink-0">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded bg-surface-container text-sm whitespace-pre-wrap">
                {a.reason}
              </div>
              {a.evidence && a.evidence.length > 0 && (
                <div className="p-3 rounded bg-surface-container text-sm">
                  <div className="text-xs text-secondary mb-2">Evidence ({a.evidence.length})</div>
                  <ul className="space-y-1">
                    {a.evidence.map((e: any, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <Icon name={e.kind === "link" ? "link" : "attach_file"} style={{ fontSize: 14 }} />
                        {e.kind === "link" ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                            {e.name || e.url}
                          </a>
                        ) : e.url ? (
                          <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                            {e.name}{e.size ? ` · ${Math.round(e.size / 1024)} KB` : ""}
                          </a>
                        ) : (
                          <span className="text-secondary truncate">{e.name} (unavailable)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                rows={2}
                maxLength={2000}
                placeholder="Note to contributor (optional)"
                className="px-3 py-2 rounded bg-surface-container border border-outline-variant text-on-background text-sm focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => decide(a.id, "approved", true)}
                  className="px-3 py-1.5 rounded bg-primary text-on-primary text-sm disabled:opacity-40"
                >
                  Approve & restore
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => decide(a.id, "approved", false)}
                  className="px-3 py-1.5 rounded bg-glass-surface text-on-background text-sm disabled:opacity-40"
                >
                  Approve only
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => decide(a.id, "rejected", false)}
                  className="px-3 py-1.5 rounded bg-error/20 text-error text-sm disabled:opacity-40"
                >
                  Reject appeal
                </button>
              </div>
            </div>
          ))}

          {resolved.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-secondary cursor-pointer">Resolved ({resolved.length})</summary>
              <ul className="mt-2 space-y-2">
                {resolved.map((a) => (
                  <li key={a.id} className="text-sm border-b border-outline-variant/40 pb-2 last:border-0">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link to="/material/$id" params={{ id: a.material_id }} className="text-on-background hover:underline">
                          {a.material_title}
                        </Link>
                        <span className="ml-2 text-xs">
                          <span className={a.status === "approved" ? "text-primary" : "text-error"}>
                            {a.status}
                          </span>
                          <span className="text-secondary"> · {a.contributor_name}</span>
                        </span>
                      </div>
                      <span className="text-xs text-secondary shrink-0">
                        {a.resolved_at ? new Date(a.resolved_at).toLocaleString() : ""}
                      </span>
                    </div>
                    {a.admin_note && <div className="text-xs text-secondary mt-1">Note: {a.admin_note}</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}

