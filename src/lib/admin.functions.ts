import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "moderator", "contributor", "learner"]);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

type LogInput = {
  actorId: string;
  action: "material_status_change" | "material_delete" | "user_delete" | "report_dismiss";
  target_type: "material" | "user" | "report";
  target_id: string | null;
  target_label?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

async function logModeration(admin: any, input: LogInput) {
  // Derive actor display name from profiles; falls back gracefully.
  let actorName: string | null = null;
  try {
    const { data } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", input.actorId)
      .maybeSingle();
    actorName = data?.display_name ?? null;
  } catch {
    /* ignore */
  }
  try {
    await admin.from("moderation_log").insert({
      actor_id: input.actorId,
      actor_name: actorName,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      target_label: input.target_label ?? null,
      reason: input.reason?.trim() ? input.reason.trim() : null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.error("moderation_log insert failed", e);
  }
}

export const listAutoFlagQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("materials")
      .select("id, title, status, flag_reasons, created_at, created_by, external_url, material_type")
      .or("status.eq.flagged,status.eq.pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
    let names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      names = new Map((profs ?? []).map((p: any) => [p.id, p.display_name || "Contributor"]));
    }
    return rows.map((r: any) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as string,
      flag_reasons: (r.flag_reasons ?? []) as string[],
      created_at: r.created_at as string,
      contributor_name: r.created_by ? names.get(r.created_by) ?? "Contributor" : "Unknown",
      external_url: r.external_url as string | null,
      material_type: r.material_type as string,
    }));
  });

export type FlagReasonStat = {
  reason: string;
  total: number;
  approved: number; // false positives — flagged but now live
  hidden: number; // true positives — flagged and hidden/removed
  pending: number; // still awaiting review
  false_positive_rate: number; // approved / (approved + hidden), 0 if none decided
};

export const listAutoFlagStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ reasons: FlagReasonStat[]; totals: { flagged: number; approved: number; hidden: number; pending: number; false_positive_rate: number } }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("materials")
      .select("status, flag_reasons")
      .not("flag_reasons", "is", null);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((r: any) => Array.isArray(r.flag_reasons) && r.flag_reasons.length > 0);

    const map = new Map<string, FlagReasonStat>();
    let flagged = 0, approved = 0, hidden = 0, pending = 0;
    for (const r of rows as any[]) {
      flagged++;
      const isApproved = r.status === "live";
      const isHidden = r.status === "hidden" || r.status === "removed";
      const isPending = r.status === "pending" || r.status === "flagged";
      if (isApproved) approved++;
      if (isHidden) hidden++;
      if (isPending) pending++;
      for (const raw of r.flag_reasons as string[]) {
        const reason = String(raw).trim();
        if (!reason) continue;
        const s = map.get(reason) ?? { reason, total: 0, approved: 0, hidden: 0, pending: 0, false_positive_rate: 0 };
        s.total++;
        if (isApproved) s.approved++;
        else if (isHidden) s.hidden++;
        else if (isPending) s.pending++;
        map.set(reason, s);
      }
    }
    const reasons = Array.from(map.values()).map((s) => {
      const decided = s.approved + s.hidden;
      s.false_positive_rate = decided > 0 ? s.approved / decided : 0;
      return s;
    }).sort((a, b) => b.approved - a.approved || b.total - a.total);

    const decidedTotal = approved + hidden;
    return {
      reasons,
      totals: {
        flagged,
        approved,
        hidden,
        pending,
        false_positive_rate: decidedTotal > 0 ? approved / decidedTotal : 0,
      },
    };
  });

// ============= Appeals =============

export const listAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("material_appeals")
      .select("id, material_id, user_id, reason, status, admin_note, evidence, resolved_at, created_at, updated_at")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const matIds = Array.from(new Set(rows.map((r: any) => r.material_id)));
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
    const [{ data: mats }, { data: profs }] = await Promise.all([
      matIds.length
        ? supabaseAdmin.from("materials").select("id, title, status, flag_reasons").in("id", matIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const matMap = new Map((mats ?? []).map((m: any) => [m.id, m]));
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));

    // Attach signed URLs for file-type evidence so admins can open uploads.
    const withEvidence = await Promise.all(
      rows.map(async (r: any) => {
        const raw = Array.isArray(r.evidence) ? r.evidence : [];
        const evidence = await Promise.all(
          raw.map(async (e: any) => {
            if (e?.kind === "file" && typeof e.path === "string") {
              const { data: signed } = await supabaseAdmin.storage
                .from("materials")
                .createSignedUrl(e.path, 60 * 60);
              return { ...e, url: signed?.signedUrl ?? null };
            }
            return e;
          }),
        );
        return { ...r, evidence };
      }),
    );

    return withEvidence.map((r: any) => {
      const m = matMap.get(r.material_id);
      return {
        id: r.id as string,
        material_id: r.material_id as string,
        user_id: r.user_id as string,
        reason: r.reason as string,
        status: r.status as "pending" | "approved" | "rejected",
        admin_note: (r.admin_note ?? null) as string | null,
        evidence: r.evidence as AppealEvidence[],
        resolved_at: r.resolved_at as string | null,
        created_at: r.created_at as string,
        material_title: m?.title ?? "Untitled",
        material_status: m?.status ?? "unknown",
        material_flag_reasons: (m?.flag_reasons ?? []) as string[],
        contributor_name: profMap.get(r.user_id) ?? "Contributor",
      };
    });
  });

const ResolveAppealInput = z.object({
  appeal_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  admin_note: z.string().max(2000).optional(),
  restore_material: z.boolean().optional(),
});

export const resolveAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResolveAppealInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: appeal, error: aErr } = await supabaseAdmin
      .from("material_appeals")
      .select("id, material_id, status, evidence")
      .eq("id", data.appeal_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!appeal) throw new Error("Appeal not found");
    if (appeal.status !== "pending") throw new Error("Appeal already resolved");

    const { error: uErr } = await supabaseAdmin
      .from("material_appeals")
      .update({
        status: data.decision,
        admin_note: data.admin_note?.trim() || null,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.appeal_id);
    if (uErr) throw new Error(uErr.message);

    if (data.decision === "approved" && data.restore_material !== false) {
      const { error: mErr } = await supabaseAdmin
        .from("materials")
        .update({ status: "live", flag_reasons: [] })
        .eq("id", appeal.material_id);
      if (mErr) throw new Error(mErr.message);
    }

    await logModeration(supabaseAdmin, {
      actorId: context.userId,
      action: "material_status_change",
      target_type: "material",
      target_id: appeal.material_id,
      reason: `Appeal ${data.decision}${data.admin_note ? `: ${data.admin_note.trim()}` : ""}`,
      metadata: { appeal_id: appeal.id, decision: data.decision, evidence: (appeal as any).evidence ?? [] },
    });

    return { ok: true as const };
  });

const EvidenceItem = z.union([
  z.object({
    kind: z.literal("link"),
    url: z.string().url().max(2000),
    name: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal("file"),
    path: z.string().min(1).max(500),
    name: z.string().max(200),
    size: z.number().int().nonnegative().optional(),
    content_type: z.string().max(200).optional(),
  }),
]);
export type AppealEvidence = z.infer<typeof EvidenceItem>;

const SubmitAppealInput = z.object({
  material_id: z.string().uuid(),
  reason: z.string().min(10).max(2000),
  evidence: z.array(EvidenceItem).max(10).optional().default([]),
});

export const submitAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitAppealInput.parse(input))
  .handler(async ({ data, context }) => {
    // Contributor-scoped; RLS enforces ownership + one-pending-per-material.
    // File-kind evidence paths MUST live under the caller's folder so storage RLS applies.
    for (const e of data.evidence) {
      if (e.kind === "file" && !e.path.startsWith(`${context.userId}/`)) {
        throw new Error("Evidence file must be uploaded under your own user folder.");
      }
    }
    const { error } = await context.supabase
      .from("material_appeals")
      .insert({
        material_id: data.material_id,
        user_id: context.userId,
        reason: data.reason.trim(),
        evidence: data.evidence,
      });
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        throw new Error("You already have a pending appeal for this material.");
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });




export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: authUsers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, region, board, language, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    // Materials contribution count
    const { data: matCounts } = await supabaseAdmin
      .from("materials")
      .select("created_by");
    const countBy = new Map<string, number>();
    (matCounts ?? []).forEach((m) => {
      countBy.set(m.created_by, (countBy.get(m.created_by) ?? 0) + 1);
    });

    return (profiles ?? []).map((p) => {
      const authUser = authUsers?.users.find((u) => u.id === p.id);
      return {
        id: p.id,
        display_name: p.display_name || (authUser?.email ?? "").split("@")[0] || "—",
        email: authUser?.email ?? "",
        region: p.region ?? "",
        board: p.board ?? "",
        roles: rolesByUser.get(p.id) ?? ["learner"],
        contributions: countBy.get(p.id) ?? 0,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        created_at: p.created_at,
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), role: roleEnum, grant: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Admin moderation powers ----------

const statusEnum = z.enum(["pending", "live", "flagged", "rejected"]);

/** Change a material's moderation status (approve/hide/flag/reject). */
export const setMaterialStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        materialId: z.string().uuid(),
        status: statusEnum,
        reason: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mat } = await supabaseAdmin
      .from("materials")
      .select("id, title, status")
      .eq("id", data.materialId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("materials")
      .update({ status: data.status })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    await logModeration(supabaseAdmin, {
      actorId: context.userId,
      action: "material_status_change",
      target_type: "material",
      target_id: data.materialId,
      target_label: mat?.title ?? null,
      reason: data.reason ?? null,
      metadata: { from: mat?.status ?? null, to: data.status },
    });
    return { ok: true };
  });

/** Permanently delete any material and any dependent votes/reports. Also removes the storage object if present. */
export const adminDeleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ materialId: z.string().uuid(), reason: z.string().max(1000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mat } = await supabaseAdmin
      .from("materials")
      .select("id, title, file_url, created_by")
      .eq("id", data.materialId)
      .maybeSingle();

    await supabaseAdmin.from("material_votes").delete().eq("material_id", data.materialId);
    await supabaseAdmin.from("reports").delete().eq("material_id", data.materialId);
    const { error } = await supabaseAdmin.from("materials").delete().eq("id", data.materialId);
    if (error) throw new Error(error.message);

    // Best-effort storage cleanup — file_url is the storage path within the "materials" bucket.
    if (mat?.file_url) {
      try {
        await supabaseAdmin.storage.from("materials").remove([mat.file_url]);
      } catch {
        /* ignore */
      }
    }
    await logModeration(supabaseAdmin, {
      actorId: context.userId,
      action: "material_delete",
      target_type: "material",
      target_id: data.materialId,
      target_label: mat?.title ?? null,
      reason: data.reason ?? null,
      metadata: { created_by: mat?.created_by ?? null },
    });
    return { ok: true };
  });

/** Admin-initiated hard delete of any user (reuses the verified deletion pipeline). */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), reason: z.string().max(1000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Use the account settings page to delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Capture a display label BEFORE the profile row is purged.
    let targetLabel: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("id", data.userId)
        .maybeSingle();
      targetLabel = prof?.display_name ?? null;
    } catch {
      /* ignore */
    }

    const existing = deletionsInFlight.get(data.userId);
    if (existing) return existing;
    const run = performAccountDeletion(data.userId)
      .then(async (report) => {
        await logModeration(supabaseAdmin, {
          actorId: context.userId,
          action: "user_delete",
          target_type: "user",
          target_id: data.userId,
          target_label: targetLabel,
          reason: data.reason ?? null,
          metadata: {
            totalDeleted: report.totalDeleted,
            totalRemaining: report.totalRemaining,
            authUserRemoved: report.authUserRemoved,
          },
        });
        return report;
      })
      .finally(() => {
        deletionsInFlight.delete(data.userId);
      });
    deletionsInFlight.set(data.userId, run);
    return run;
  });

/** List open reports joined with material + reporter for the moderation queue. */
export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reports, error } = await supabaseAdmin
      .from("reports")
      .select("id, material_id, reporter_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const matIds = Array.from(new Set((reports ?? []).map((r) => r.material_id).filter(Boolean)));
    const userIds = Array.from(new Set((reports ?? []).map((r) => r.reporter_id).filter(Boolean)));
    const [{ data: mats }, { data: profs }] = await Promise.all([
      matIds.length
        ? supabaseAdmin.from("materials").select("id, title, status, created_by").in("id", matIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const matBy = new Map((mats ?? []).map((m) => [m.id, m]));
    const profBy = new Map((profs ?? []).map((p) => [p.id, p]));

    return (reports ?? []).map((r) => ({
      id: r.id,
      material_id: r.material_id,
      reporter_id: r.reporter_id,
      reason: r.reason,
      created_at: r.created_at,
      material_title: matBy.get(r.material_id)?.title ?? "(deleted)",
      material_status: matBy.get(r.material_id)?.status ?? null,
      reporter_name: profBy.get(r.reporter_id)?.display_name ?? "—",
    }));
  });

/** Dismiss a single report without acting on the material. */
export const dismissReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ reportId: z.string().uuid(), reason: z.string().max(1000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rep } = await supabaseAdmin
      .from("reports")
      .select("id, material_id, reason")
      .eq("id", data.reportId)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await logModeration(supabaseAdmin, {
      actorId: context.userId,
      action: "report_dismiss",
      target_type: "report",
      target_id: data.reportId,
      target_label: rep?.reason ?? null,
      reason: data.reason ?? null,
      metadata: { material_id: rep?.material_id ?? null },
    });
    return { ok: true };
  });

/** List recent moderation log entries for the admin audit view. */
export const listModerationLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("moderation_log")
      .select("id, actor_id, actor_name, action, target_type, target_id, target_label, reason, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type DeletionReportRow = {
  table: string;
  before: number;
  after: number;
  deleted: number;
  remaining: number;
  ok: boolean;
  error?: string;
};

export type DeletionReport = {
  ok: true;
  alreadyDeleted?: boolean;
  authUserRemoved: boolean;
  rows: DeletionReportRow[];
  totalDeleted: number;
  totalRemaining: number;
};

// In-flight guard so concurrent requests for the same user collapse to one deletion.
const deletionsInFlight = new Map<string, Promise<DeletionReport>>();

const OWNED_TABLES: { table: string; column: string }[] = [
  { table: "material_votes", column: "user_id" },
  { table: "reports", column: "reporter_id" },
  { table: "materials", column: "created_by" },
  { table: "collections", column: "created_by" },
  { table: "user_roles", column: "user_id" },
  { table: "profiles", column: "id" },
];

async function countRows(admin: any, table: string, column: string, userId: string): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, userId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function performAccountDeletion(userId: string): Promise<DeletionReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotency: if the auth user is already gone, treat as success.
  const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getErr && !/not\s*found/i.test(getErr.message)) {
    throw new Error(getErr.message);
  }
  if (!existing?.user) {
    const rows: DeletionReportRow[] = [];
    for (const { table, column } of OWNED_TABLES) {
      try {
        const remaining = await countRows(supabaseAdmin, table, column, userId);
        rows.push({ table, before: 0, after: remaining, deleted: 0, remaining, ok: remaining === 0 });
      } catch (e) {
        rows.push({ table, before: 0, after: 0, deleted: 0, remaining: 0, ok: false, error: (e as Error).message });
      }
    }
    return {
      ok: true,
      alreadyDeleted: true,
      authUserRemoved: true,
      rows,
      totalDeleted: 0,
      totalRemaining: rows.reduce((s, r) => s + r.remaining, 0),
    };
  }

  // Snapshot before counts.
  const before: Record<string, number> = {};
  for (const { table, column } of OWNED_TABLES) {
    try {
      before[table] = await countRows(supabaseAdmin, table, column, userId);
    } catch {
      before[table] = 0;
    }
  }

  // Best-effort cleanup of user data. All deletes are naturally idempotent (no-op on empty).
  const deleteErrors: Record<string, string> = {};
  for (const { table, column } of OWNED_TABLES) {
    const { error } = await (supabaseAdmin as any).from(table).delete().eq(column, userId);
    if (error) deleteErrors[table] = error.message;
  }

  // Re-query after deletion to verify.
  const rows: DeletionReportRow[] = [];
  for (const { table, column } of OWNED_TABLES) {
    try {
      const remaining = await countRows(supabaseAdmin, table, column, userId);
      const beforeCount = before[table] ?? 0;
      const deleted = Math.max(0, beforeCount - remaining);
      rows.push({
        table,
        before: beforeCount,
        after: remaining,
        deleted,
        remaining,
        ok: remaining === 0 && !deleteErrors[table],
        error: deleteErrors[table],
      });
    } catch (e) {
      rows.push({
        table,
        before: before[table] ?? 0,
        after: -1,
        deleted: 0,
        remaining: -1,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  const { error: delUserErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  let authUserRemoved = true;
  if (delUserErr && !/not\s*found/i.test(delUserErr.message)) {
    authUserRemoved = false;
  }
  if (authUserRemoved) {
    const { data: check } = await supabaseAdmin.auth.admin.getUserById(userId);
    authUserRemoved = !check?.user;
  }

  return {
    ok: true,
    authUserRemoved,
    rows,
    totalDeleted: rows.reduce((s, r) => s + r.deleted, 0),
    totalRemaining: rows.reduce((s, r) => s + Math.max(0, r.remaining), 0),
  };
}

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const existing = deletionsInFlight.get(userId);
    if (existing) return existing;
    const run = performAccountDeletion(userId).finally(() => {
      deletionsInFlight.delete(userId);
    });
    deletionsInFlight.set(userId, run);
    return run;
  });

/** Export all page_views as CSV (admin only). */
export const exportPageViewsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows: Array<{ id: number; created_at: string; path: string; user_id: string | null }> = [];
    const pageSize = 1000;
    let from = 0;
    // Paginate to bypass PostgREST 1k default cap.
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("page_views")
        .select("id, created_at, path, user_id")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
      if (rows.length >= 100000) break; // safety cap
    }

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));
    const nameBy = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      (profs ?? []).forEach((p) => nameBy.set(p.id, p.display_name ?? ""));
    }

    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["id", "created_at", "path", "user_id", "display_name"].join(",");
    const body = rows
      .map((r) => [r.id, r.created_at, r.path, r.user_id ?? "", nameBy.get(r.user_id ?? "") ?? ""].map(esc).join(","))
      .join("\n");

    return { csv: header + "\n" + body, count: rows.length };
  });
