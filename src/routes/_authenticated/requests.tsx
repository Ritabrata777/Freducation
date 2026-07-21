import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { TopNav } from "@/components/TopNav";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Request Board — Freducation" },
      { name: "description", content: "Ask for missing study materials and help other learners by fulfilling their requests." },
      { property: "og:title", content: "Request Board — Freducation" },
      { property: "og:description", content: "Ask for missing study materials and help other learners by fulfilling their requests." },
    ],
  }),
  component: RequestsPage,
});

type RequestRow = {
  id: string;
  requester_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  region: string | null;
  board: string | null;
  status: "open" | "fulfilled" | "closed";
  fulfilled_material_id: string | null;
  created_at: string;
};

type Tab = "open" | "fulfilled" | "mine";

const requestSchema = z.object({
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  subject: z.string().trim().max(80).optional().or(z.literal("")),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  board: z.string().trim().max(80).optional().or(z.literal("")),
});

function RequestsPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [showForm, setShowForm] = useState(false);

  const requestsQ = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select("id, requester_id, title, description, subject, region, board, status, fulfilled_material_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RequestRow[];
    },
  });

  const votesQ = useQuery({
    queryKey: ["request-votes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("material_request_votes").select("request_id, user_id");
      if (error) throw error;
      return data as { request_id: string; user_id: string }[];
    },
  });

  const profilesQ = useQuery({
    queryKey: ["requests", "profiles", (requestsQ.data ?? []).map((r) => r.requester_id).join(",")],
    enabled: !!requestsQ.data && requestsQ.data.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((requestsQ.data ?? []).map((r) => r.requester_id)));
      if (ids.length === 0) return [] as { id: string; display_name: string | null }[];
      const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      if (error) throw error;
      return data as { id: string; display_name: string | null }[];
    },
  });

  const nameFor = (uid: string) =>
    profilesQ.data?.find((p) => p.id === uid)?.display_name?.split(" ")[0] ?? "Someone";

  const voteCounts = useMemo(() => {
    const c = new Map<string, number>();
    (votesQ.data ?? []).forEach((v) => c.set(v.request_id, (c.get(v.request_id) ?? 0) + 1));
    return c;
  }, [votesQ.data]);

  const myVotes = useMemo(() => {
    const s = new Set<string>();
    (votesQ.data ?? []).forEach((v) => { if (user && v.user_id === user.id) s.add(v.request_id); });
    return s;
  }, [votesQ.data, user]);

  const rows = (requestsQ.data ?? [])
    .filter((r) => {
      if (tab === "open") return r.status === "open";
      if (tab === "fulfilled") return r.status === "fulfilled";
      return user && r.requester_id === user.id;
    })
    .sort((a, b) => (voteCounts.get(b.id) ?? 0) - (voteCounts.get(a.id) ?? 0));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["request-votes"] });
  };

  const vote = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (!user) throw new Error("Sign in to vote.");
      if (on) {
        const { error } = await supabase.from("material_request_votes").insert({ request_id: id, user_id: user.id });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("material_request_votes").delete().eq("request_id", id).eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["request-votes"] }),
    onError: (e) => toast.error("Vote failed", { description: e instanceof Error ? e.message : "" }),
  });

  const closeReq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("material_requests").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Request closed"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });

  const removeReq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("material_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Request deleted"); },
    onError: (e) => toast.error("Failed", { description: e instanceof Error ? e.message : "" }),
  });

  const counts = {
    open: (requestsQ.data ?? []).filter((r) => r.status === "open").length,
    fulfilled: (requestsQ.data ?? []).filter((r) => r.status === "fulfilled").length,
    mine: user ? (requestsQ.data ?? []).filter((r) => r.requester_id === user.id).length : 0,
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "open", label: "Open", icon: "campaign" },
    { key: "fulfilled", label: "Fulfilled", icon: "task_alt" },
    { key: "mine", label: "My requests", icon: "person" },
  ];

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-margin">
          <div className="mb-gutter flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-background">Request Board</h1>
              <p className="font-body-md text-secondary mt-1 max-w-xl">
                Missing a topic, chapter, or regional syllabus? Ask the community. Upload something that answers a request to fulfill it.
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm"
            >
              <Icon name={showForm ? "close" : "add"} style={{ fontSize: 18 }} />
              {showForm ? "Cancel" : "New request"}
            </button>
          </div>

          {showForm && (
            <RequestForm
              onDone={() => { setShowForm(false); invalidate(); }}
            />
          )}

          <div className="flex flex-wrap gap-2 mb-gutter">
            {tabs.map((t) => {
              const active = tab === t.key;
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
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {requestsQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bento-card p-4">
                  <Skeleton className="h-6 w-2/3 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : requestsQ.isError ? (
            <div className="bento-card p-10 text-center">
              <Icon name="cloud_off" className="text-error mx-auto mb-3" style={{ fontSize: 32 }} />
              <p className="font-body-md text-error">Couldn't load requests. Please try again.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bento-card p-10 text-center">
              <Icon name="forum" className="text-secondary mx-auto mb-3" style={{ fontSize: 32 }} />
              <h3 className="font-headline-md text-headline-md text-on-background mb-1">Nothing here yet</h3>
              <p className="font-body-md text-secondary mb-4">
                {tab === "mine" ? "You haven't posted any requests." : "Be the first to ask for what you need."}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm"
              >
                <Icon name="add" style={{ fontSize: 18 }} />
                New request
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {rows.map((r) => (
                <RequestCard
                  key={r.id}
                  r={r}
                  count={voteCounts.get(r.id) ?? 0}
                  voted={myVotes.has(r.id)}
                  requesterName={nameFor(r.requester_id)}
                  isMine={!!user && user.id === r.requester_id}
                  isAdmin={isAdmin}
                  onVote={(on) => vote.mutate({ id: r.id, on })}
                  onClose={() => closeReq.mutate(r.id)}
                  onDelete={() => { if (confirm(`Delete "${r.title}"?`)) removeReq.mutate(r.id); }}
                  onFulfilled={invalidate}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [state, setState] = useState({ title: "", description: "", subject: "", region: "", board: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = requestSchema.safeParse(state);
    if (!parsed.success) {
      toast.error("Please fix the form", { description: parsed.error.issues[0]?.message });
      return;
    }
    setSaving(true);
    const payload = parsed.data;
    const { error } = await supabase.from("material_requests").insert({
      requester_id: user.id,
      title: payload.title,
      description: payload.description || null,
      subject: payload.subject || null,
      region: payload.region || null,
      board: payload.board || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't create request", { description: error.message });
      return;
    }
    toast.success("Request posted");
    setState({ title: "", description: "", subject: "", region: "", board: "" });
    onDone();
  };

  const input = "w-full bg-glass-input border border-glass-border-strong rounded-lg px-3 py-2 font-body-md text-[14px] text-white placeholder:text-text-secondary focus:outline-none";

  return (
    <form onSubmit={submit} className="bento-card p-5 mb-gutter">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Title *</span>
          <input
            className={input}
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            placeholder="e.g. Class 10 ICSE Physics chapter-wise MCQs"
            maxLength={200}
            required
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Description</span>
          <textarea
            className={`${input} min-h-[80px] resize-y`}
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
            placeholder="Add context — grade, syllabus, language, what already exists that doesn't fit."
            maxLength={2000}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Subject</span>
          <input className={input} value={state.subject} onChange={(e) => setState({ ...state, subject: e.target.value })} placeholder="e.g. Physics" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Board</span>
          <input className={input} value={state.board} onChange={(e) => setState({ ...state, board: e.target.value })} placeholder="e.g. ICSE" />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Region</span>
          <input className={input} value={state.region} onChange={(e) => setState({ ...state, region: e.target.value })} placeholder="e.g. West Bengal, India" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-60"
        >
          <Icon name={saving ? "progress_activity" : "send"} className={saving ? "animate-spin" : ""} style={{ fontSize: 18 }} />
          {saving ? "Posting…" : "Post request"}
        </button>
      </div>
    </form>
  );
}

function RequestCard(props: {
  r: RequestRow;
  count: number;
  voted: boolean;
  requesterName: string;
  isMine: boolean;
  isAdmin: boolean;
  onVote: (on: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
  onFulfilled: () => void;
}) {
  const { r, count, voted, requesterName, isMine, isAdmin, onVote, onClose, onDelete, onFulfilled } = props;
  const chips = [r.subject, r.board, r.region].filter((x): x is string => !!x);
  const statusStyle =
    r.status === "open"
      ? "bg-primary/20 text-primary border-primary/40"
      : r.status === "fulfilled"
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : "bg-surface/60 text-secondary border-glass-border";

  return (
    <div className="bento-card p-4 flex gap-4">
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          onClick={() => onVote(!voted)}
          disabled={r.status !== "open"}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
            voted
              ? "bg-primary text-on-primary border-primary"
              : "bg-glass-surface border-glass-border text-secondary hover:text-on-background"
          } ${r.status !== "open" ? "opacity-60 cursor-not-allowed" : ""}`}
          title={voted ? "Remove vote" : "Upvote"}
        >
          <Icon name="arrow_upward" style={{ fontSize: 18 }} />
        </button>
        <span className="font-mono-code text-[13px] text-on-surface">{count}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-headline-md text-headline-md text-on-surface text-[17px] leading-tight line-clamp-2">
            {r.title}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-label-sm text-[10px] uppercase tracking-wider shrink-0 ${statusStyle}`}>
            {r.status}
          </span>
        </div>
        <p className="font-label-sm text-label-sm text-secondary mb-2">
          by {isMine ? "you" : requesterName} · {new Date(r.created_at).toLocaleDateString()}
        </p>
        {r.description && (
          <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mb-3">{r.description}</p>
        )}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {chips.map((c, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-surface/60 border border-glass-border-subtle text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider rounded-sm">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-outline-variant/50">
          {r.status === "fulfilled" && r.fulfilled_material_id ? (
            <Link
              to="/material/$id"
              params={{ id: r.fulfilled_material_id }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-label-sm text-label-sm"
            >
              <Icon name="menu_book" style={{ fontSize: 16 }} />
              Open material
            </Link>
          ) : r.status === "open" ? (
            <FulfillPicker requestId={r.id} onDone={onFulfilled} />
          ) : null}
          {(isMine || isAdmin) && r.status === "open" && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant text-secondary hover:text-on-background font-label-sm text-label-sm"
            >
              <Icon name="lock" style={{ fontSize: 16 }} />
              Close
            </button>
          )}
          {(isMine || isAdmin) && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/20 font-label-sm text-label-sm ml-auto"
            >
              <Icon name="delete" style={{ fontSize: 16 }} />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FulfillPicker({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const myMaterialsQ = useQuery({
    queryKey: ["my-materials", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, status")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as { id: string; title: string; status: string }[];
    },
  });

  const fulfill = useMutation({
    mutationFn: async (materialId: string) => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase
        .from("material_requests")
        .update({
          status: "fulfilled",
          fulfilled_material_id: materialId,
          fulfilled_by: user.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); onDone(); toast.success("Request fulfilled — thank you!"); },
    onError: (e) => toast.error("Couldn't fulfill", { description: e instanceof Error ? e.message : "" }),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-label-sm text-label-sm"
      >
        <Icon name="volunteer_activism" style={{ fontSize: 16 }} />
        Fulfill this
      </button>
    );
  }

  return (
    <div className="w-full bg-black/40 border border-glass-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-label-sm text-label-sm text-on-surface">Link one of your uploads</p>
        <button onClick={() => setOpen(false)} className="text-secondary hover:text-on-background">
          <Icon name="close" style={{ fontSize: 16 }} />
        </button>
      </div>
      {myMaterialsQ.isLoading ? (
        <p className="font-body-sm text-secondary">Loading your uploads…</p>
      ) : (myMaterialsQ.data ?? []).length === 0 ? (
        <div className="text-center py-2">
          <p className="font-body-sm text-secondary mb-2">You haven't uploaded anything yet.</p>
          <Link to="/ingest" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">
            <Icon name="cloud_upload" style={{ fontSize: 16 }} />
            Upload now
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-1 max-h-56 overflow-auto">
          {myMaterialsQ.data!.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => fulfill.mutate(m.id)}
                disabled={fulfill.isPending}
                className="w-full text-left px-3 py-2 rounded-md border border-glass-border hover:bg-glass-surface flex items-center justify-between gap-2"
              >
                <span className="truncate font-body-md text-[13px] text-on-surface">{m.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-secondary shrink-0">{m.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
