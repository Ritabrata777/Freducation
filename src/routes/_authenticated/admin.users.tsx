import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/TopNav";
import { Icon } from "@/components/Icon";
import { RequireAdmin } from "@/components/RequireAdmin";
import { Skeleton } from "@/components/Skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsersAdmin, setUserRole, adminDeleteUser } from "@/lib/admin.functions";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "User Monitoring — Freducation" },
      { name: "description", content: "User directory with roles and contribution activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <UsersPage />
    </RequireAdmin>
  ),
});

const ROLES = ["admin", "moderator", "contributor", "learner"] as const;
type Role = (typeof ROLES)[number];

function UsersPage() {
  const { user: me } = useAuth();
  const fetchUsers = useServerFn(listUsersAdmin);
  const updateRole = useServerFn(setUserRole);
  const deleteUser = useServerFn(adminDeleteUser);
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; role: Role; grant: boolean }) => updateRole({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Role updated");
    },
    onError: (e) => toast.error("Update failed", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setPendingDelete(null);
      setConfirmText("");
      toast.success("Account deleted", {
        description: `${report.totalDeleted} record${report.totalDeleted === 1 ? "" : "s"} removed${report.authUserRemoved ? "" : " (auth user remains)"}.`,
      });
    },
    onError: (e) => toast.error("Delete failed", { description: e instanceof Error ? e.message : "" }),
  });

  const users = usersQ.data ?? [];

  return (
    <div className="text-on-background font-body-md min-h-screen">
      <TopNav />
      <main className="pt-28 min-h-screen w-full">
        <div className="p-margin max-w-container-max mx-auto">

          <div className="mb-gutter">
            <h1 className="font-headline-lg text-headline-lg text-on-background">User Directory</h1>
            <p className="font-body-md text-secondary mt-1">
              {usersQ.isLoading ? "Loading users…" : `${users.length} account${users.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/50 bg-surface/40 backdrop-blur-sm">
                    {["User", "Email", "Region", "Contributions", "Roles", "Joined", ""].map((h) => (
                      <th key={h} className="py-3 px-6 font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono-code text-mono-code text-on-surface-variant">
                  {usersQ.isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-outline-variant/50 bg-surface/40">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="py-4 px-6"><Skeleton className="h-4 w-full max-w-[140px]" /></td>
                        ))}
                      </tr>
                    ))
                  ) : usersQ.isError ? (
                    <tr><td colSpan={7} className="py-10 text-center text-error font-body-md">Couldn't load users. {usersQ.error instanceof Error ? usersQ.error.message : ""}</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-secondary font-body-md">No users yet.</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-outline-variant/50 hover:bg-surface-container-low/60 bg-surface/40">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-label-sm">
                              {(u.display_name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="font-body-md text-on-background font-medium">{u.display_name}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6">{u.email || "—"}</td>
                        <td className="py-4 px-6">{u.region || "—"}</td>
                        <td className="py-4 px-6">{u.contributions}</td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1">
                            {ROLES.map((r) => {
                              const has = u.roles.includes(r);
                              const isMe = me?.id === u.id && r === "admin";
                              return (
                                <button
                                  key={r}
                                  disabled={roleMutation.isPending || isMe}
                                  onClick={() =>
                                    roleMutation.mutate({ userId: u.id, role: r, grant: !has })
                                  }
                                  title={isMe ? "You can't revoke your own admin role here." : has ? `Revoke ${r}` : `Grant ${r}`}
                                  className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider font-label-sm transition-colors ${
                                    has
                                      ? "bg-primary text-on-primary border-primary"
                                      : "bg-surface/60 text-secondary border-outline-variant hover:border-primary"
                                  } ${isMe ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                  {r}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-6">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => { setPendingDelete({ id: u.id, name: u.display_name }); setConfirmText(""); }}
                            disabled={me?.id === u.id}
                            title={me?.id === u.id ? "Use Settings to delete your own account" : "Delete this account"}
                            className="text-secondary hover:text-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Icon name="delete" style={{ fontSize: 18 }} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-secondary font-body-md text-sm">
            <Icon name="info" style={{ fontSize: 16 }} />
            Click a role chip to grant/revoke. The trash icon permanently deletes the account and all their content.
          </div>
        </div>
      </main>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !deleteMutation.isPending && setPendingDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bento-card p-6 max-w-md w-full">
            <h3 className="font-headline-md text-headline-md text-on-background mb-2">Delete {pendingDelete.name}?</h3>
            <p className="text-secondary font-body-md mb-4">
              This removes the account, their profile, roles, votes, reports, collections, and all uploaded materials. This cannot be undone.
            </p>
            <label className="block text-label-sm text-secondary mb-2">Type <span className="font-mono-code text-error">DELETE</span> to confirm</label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-black/40 border border-glass-border rounded p-3 font-mono-code text-on-background mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-full border border-glass-border text-on-background hover:bg-surface/60 disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(pendingDelete.id)}
                disabled={confirmText !== "DELETE" || deleteMutation.isPending}
                className="px-4 py-2 rounded-full bg-error text-on-primary font-label-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >{deleteMutation.isPending ? "Deleting…" : "Permanently delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
