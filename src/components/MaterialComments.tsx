import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { toast } from "@/lib/toast";

type Kind = "comment" | "question" | "answer";

type CommentRow = {
  id: string;
  material_id: string;
  user_id: string;
  parent_id: string | null;
  kind: Kind;
  body: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = { id: string; display_name: string | null };

type Enriched = CommentRow & { author: string };

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string | null | undefined) {
  const n = (name || "?").trim();
  return (n[0] || "?").toUpperCase();
}

export function MaterialComments({ materialId }: { materialId: string }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"discussion" | "questions">("discussion");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; kind: Kind } | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const q = useQuery({
    queryKey: ["material-comments", materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_comments")
        .select("id, material_id, user_id, parent_id, kind, body, created_at, updated_at")
        .eq("material_id", materialId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CommentRow[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      let profiles: ProfileRow[] = [];
      if (ids.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        profiles = (p ?? []) as ProfileRow[];
      }
      const nameById = new Map(profiles.map((p) => [p.id, p.display_name || "Learner"]));
      return rows.map<Enriched>((r) => ({ ...r, author: nameById.get(r.user_id) || "Learner" }));
    },
  });

  const votesQ = useQuery({
    queryKey: ["material-comment-votes", materialId, user?.id ?? "anon"],
    enabled: !!(q.data && q.data.length),
    queryFn: async () => {
      const ids = (q.data ?? []).map((c) => c.id);
      if (!ids.length) return { counts: {} as Record<string, number>, mine: new Set<string>() };
      const { data, error } = await supabase
        .from("material_comment_votes")
        .select("comment_id, user_id")
        .in("comment_id", ids);
      if (error) throw error;
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      for (const v of data ?? []) {
        counts[v.comment_id] = (counts[v.comment_id] ?? 0) + 1;
        if (user && v.user_id === user.id) mine.add(v.comment_id);
      }
      return { counts, mine };
    },
  });

  const helpfulCount = (id: string) => votesQ.data?.counts[id] ?? 0;
  const iVoted = (id: string) => votesQ.data?.mine.has(id) ?? false;

  const comments = q.data ?? [];

  const { discussion, questions } = useMemo(() => {
    const discussion = comments.filter((c) => c.kind === "comment");
    const questions = comments.filter((c) => c.kind === "question" || c.kind === "answer");
    return { discussion, questions };
  }, [comments]);

  const questionThreads = useMemo(() => {
    const roots = questions.filter((c) => c.kind === "question" && !c.parent_id);
    return roots.map((r) => ({
      root: r,
      answers: questions
        .filter((a) => a.parent_id === r.id)
        .sort((a, b) => {
          const diff = (helpfulCount(b.id)) - (helpfulCount(a.id));
          if (diff !== 0) return diff;
          return +new Date(a.created_at) - +new Date(b.created_at);
        }),
    }));
  }, [questions, votesQ.data]);

  const toggleHelpful = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("Sign in to vote helpful.");
      if (iVoted(commentId)) {
        const { error } = await supabase
          .from("material_comment_votes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("material_comment_votes")
          .insert({ comment_id: commentId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-comment-votes", materialId] });
    },
    onError: (e: Error) => toast.error("Couldn't update vote", { description: e.message }),
  });


  const post = useMutation({
    mutationFn: async (input: { kind: Kind; body: string; parent_id: string | null }) => {
      if (!user) throw new Error("Sign in to post.");
      const trimmed = input.body.trim();
      if (!trimmed) throw new Error("Please write something first.");
      if (trimmed.length > 4000) throw new Error("Keep it under 4000 characters.");
      const { error } = await supabase.from("material_comments").insert({
        material_id: materialId,
        user_id: user.id,
        parent_id: input.parent_id,
        kind: input.kind,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["material-comments", materialId] });
      toast.success("Posted");
    },
    onError: (e: Error) => toast.error("Couldn't post", { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; body: string }) => {
      const trimmed = input.body.trim();
      if (!trimmed) throw new Error("Comment can't be empty.");
      const { error } = await supabase
        .from("material_comments")
        .update({ body: trimmed })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["material-comments", materialId] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error("Couldn't update", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("material_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-comments", materialId] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  const submitMain = () => {
    if (tab === "discussion") {
      post.mutate({ kind: "comment", body, parent_id: null });
    } else {
      post.mutate({ kind: "question", body, parent_id: null });
    }
  };

  const canEdit = (c: Enriched) => user?.id === c.user_id;
  const canDelete = (c: Enriched) => user?.id === c.user_id || isAdmin;

  const CommentItem = ({ c, indent = false }: { c: Enriched; indent?: boolean }) => (
    <li className={`flex gap-3 ${indent ? "ml-10 pl-4 border-l border-outline-variant/60" : ""}`}>
      <div className="w-9 h-9 shrink-0 rounded-full bg-primary/20 text-on-primary flex items-center justify-center font-headline-md text-[14px] border border-glass-border-subtle">
        {initials(c.author)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-label-sm text-label-sm text-on-surface">{c.author}</span>
          {c.kind === "answer" && (
            <span className="px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-label-sm text-[10px] uppercase tracking-wider">
              Answer
            </span>
          )}
          <span className="text-secondary font-body-sm text-[11px]">
            {timeAgo(c.created_at)}
            {c.updated_at !== c.created_at ? " · edited" : ""}
          </span>
        </div>
        {editing?.id === c.id ? (
          <div className="mt-2">
            <textarea
              value={editing.body}
              onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-glass-border-subtle text-on-surface font-body-md text-[13px] resize-y"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => update.mutate({ id: c.id, body: editing.body })}
                disabled={update.isPending}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 rounded-lg border-outline-variant font-label-sm text-label-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 font-body-md text-[13px] text-on-surface-variant whitespace-pre-wrap break-words">
            {c.body}
          </p>
        )}
        {editing?.id !== c.id && (
          <div className="flex items-center gap-3 mt-1.5 text-secondary font-label-sm text-[11px]">
            {(c.kind === "answer" || c.kind === "comment") && (
              <button
                onClick={() => toggleHelpful.mutate(c.id)}
                disabled={!user || toggleHelpful.isPending}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border transition-colors ${
                  iVoted(c.id)
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "border-glass-border-subtle hover:text-primary"
                } disabled:opacity-60`}
                title={user ? (iVoted(c.id) ? "Remove helpful vote" : "Mark as helpful") : "Sign in to vote"}
              >
                <Icon name="thumb_up" style={{ fontSize: 13 }} />
                Helpful{helpfulCount(c.id) > 0 ? ` · ${helpfulCount(c.id)}` : ""}
              </button>
            )}
            {c.kind === "question" && !c.parent_id && (
              <button
                onClick={() => {
                  setReplyTo({ id: c.id, kind: "answer" });
                  setBody("");
                }}
                className="hover:text-primary inline-flex items-center gap-1"
              >
                <Icon name="reply" style={{ fontSize: 14 }} />
                Answer
              </button>
            )}
            {canEdit(c) && (
              <button
                onClick={() => setEditing({ id: c.id, body: c.body })}
                className="hover:text-primary inline-flex items-center gap-1"
              >
                <Icon name="edit" style={{ fontSize: 14 }} />
                Edit
              </button>
            )}
            {canDelete(c) && (
              <button
                onClick={() => {
                  if (confirm("Delete this comment?")) remove.mutate(c.id);
                }}
                className="hover:text-error inline-flex items-center gap-1"
              >
                <Icon name="delete" style={{ fontSize: 14 }} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );

  const composerPlaceholder =
    replyTo?.kind === "answer"
      ? "Write your answer…"
      : tab === "questions"
      ? "Ask a question about this material…"
      : "Share a comment or clarification…";

  return (
    <section className="bento-card p-6" id="discussion">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h2 className="font-headline-md text-[16px] text-on-background inline-flex items-center gap-2">
          <Icon name="forum" style={{ fontSize: 20 }} className="text-primary" />
          Discussion
        </h2>
        <div className="inline-flex rounded-lg border border-glass-border-subtle bg-black/30 p-0.5">
          {(
            [
              { k: "discussion", label: `Comments (${discussion.length})`, icon: "chat_bubble" },
              { k: "questions", label: `Q&A (${questionThreads.length})`, icon: "help" },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => {
                setTab(t.k);
                setReplyTo(null);
              }}
              className={`px-3 py-1.5 rounded-md font-label-sm text-label-sm inline-flex items-center gap-1.5 transition-colors ${
                tab === t.k ? "bg-primary text-on-primary" : "text-secondary hover:text-on-surface"
              }`}
            >
              <Icon name={t.icon} style={{ fontSize: 14 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {user ? (
        <div className="mb-6">
          {replyTo && (
            <div className="mb-2 text-secondary font-label-sm text-[12px] inline-flex items-center gap-2">
              <Icon name="reply" style={{ fontSize: 14 }} />
              Answering a question
              <button
                onClick={() => setReplyTo(null)}
                className="text-primary hover:underline"
              >
                cancel
              </button>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={composerPlaceholder}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-glass-border-subtle text-on-surface font-body-md text-[13px] resize-y focus-visible:outline-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-secondary font-body-sm text-[11px]">
              {body.length}/4000
            </span>
            <button
              onClick={() => (replyTo ? post.mutate({ kind: "answer", body, parent_id: replyTo.id }) : submitMain())}
              disabled={post.isPending || !body.trim()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Icon name={post.isPending ? "progress_activity" : "send"} className={post.isPending ? "animate-spin" : ""} style={{ fontSize: 16 }} />
              {replyTo ? "Post answer" : tab === "questions" ? "Ask question" : "Post comment"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-3 rounded-lg bg-black/30 border border-glass-border-subtle text-secondary font-body-md text-[13px]">
          Sign in to join the discussion.
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : q.isError ? (
        <p className="text-error font-body-md text-[13px]">Couldn't load comments.</p>
      ) : tab === "discussion" ? (
        discussion.length === 0 ? (
          <p className="text-secondary font-body-md text-[13px]">
            No comments yet. Be the first to share your thoughts.
          </p>
        ) : (
          <ul className="space-y-5">
            {discussion.map((c) => (
              <CommentItem key={c.id} c={c} />
            ))}
          </ul>
        )
      ) : questionThreads.length === 0 ? (
        <p className="text-secondary font-body-md text-[13px]">
          No questions yet. Ask one to help others understand this material.
        </p>
      ) : (
        <ul className="space-y-6">
          {questionThreads.map(({ root, answers }) => (
            <li key={root.id} className="space-y-3">
              <CommentItem c={root} />
              {answers.length > 0 && (
                <ul className="space-y-3">
                  {answers.map((a) => (
                    <CommentItem key={a.id} c={a} indent />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
