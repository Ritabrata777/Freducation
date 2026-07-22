import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "@/lib/toast";
import { useServerFn } from "@tanstack/react-start";
import { Icon } from "@/components/Icon";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import { useMotionPref } from "@/hooks/use-motion-pref";
import { DEFAULT_UI_PREFS, useUiPrefs } from "@/hooks/use-ui-prefs";
import { supabase } from "@/integrations/supabase/client";
import { deleteOwnAccount, type DeletionReport } from "@/lib/admin.functions";



export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configuration — Freducation" },
      { name: "description", content: "Manage your Freducation identity profile, localization, and account security." },
      { property: "og:title", content: "Configuration — Freducation" },
      { property: "og:description", content: "Manage your Freducation identity profile, localization, and account security." },
    ],
  }),
  component: SettingsPage,
});

type MotionPref = "on" | "system" | "off";
const MOTION_OPTIONS: ReadonlyArray<{ v: MotionPref; l: string }> = [
  { v: "on", l: "On" },
  { v: "system", l: "System" },
  { v: "off", l: "Off" },
];

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const deleteAccountFn = useServerFn(deleteOwnAccount);
  const [deleting, setDeleting] = useState(false);
  const deleteInFlightRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const CONFIRM_WORD = "DELETE";
  const [report, setReport] = useState<DeletionReport | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { pref: motionPref, setPref: setMotionPref } = useMotionPref();
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState("");
  const [board, setBoard] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Localization + display defaults. Keep first option as the system default.
  const LANGUAGE_OPTIONS = ["English (US - Technical)", "English (UK)", "German (DE)"] as const;
  const DATA_REGION_OPTIONS = ["North America (US-East-1)", "Europe (EU-Central)", "Asia Pacific (AP-South)"] as const;
  const DEFAULTS = {
    ...DEFAULT_UI_PREFS,
    motion: "system" as const,
  };

  const { prefs, setPrefs } = useUiPrefs();
  const language = prefs.language;
  const dataRegion = prefs.dataRegion;
  const compact = prefs.compact;
  const highContrast = prefs.highContrast;

  const updateLanguage = (v: string) => {
    setPrefs((prev) => ({ ...prev, language: v }));
    toast.success("System language updated", { description: v });
  };
  const updateDataRegion = (v: string) => {
    setPrefs((prev) => ({ ...prev, dataRegion: v }));
    toast.success("Data region updated", { description: v });
  };
  const updateCompact = (v: boolean) => {
    setPrefs((prev) => ({ ...prev, compact: v }));
    toast.success(v ? "Compact ledger view enabled" : "Compact ledger view disabled");
  };
  const updateHighContrast = (v: boolean) => {
    setPrefs((prev) => ({ ...prev, highContrast: v }));
    toast.success(v ? "High contrast typography enabled" : "High contrast typography disabled");
  };

  const resetPreferences = () => {
    setPrefs({
      language: DEFAULTS.language,
      dataRegion: DEFAULTS.dataRegion,
      compact: DEFAULTS.compact,
      highContrast: DEFAULTS.highContrast,
    });
    setMotionPref(DEFAULTS.motion);
    toast.success("Preferences reset to defaults", {
      description: "Motion, localization, and access preferences restored.",
    });
  };

  // Stable ids so <label htmlFor> and aria-describedby resolve correctly.
  const ids = {
    identity: useId(),
    displayName: useId(),
    displayNameHelp: useId(),
    board: useId(),
    email: useId(),
    emailHelp: useId(),
    region: useId(),
    localization: useId(),
    language: useId(),
    dataRegion: useId(),
    compact: useId(),
    compactHelp: useId(),
    hiContrast: useId(),
    hiContrastHelp: useId(),
    motionLabel: useId(),
    motionHelp: useId(),
    access: useId(),
    authProto: useId(),
    authProtoHelp: useId(),
    mfa: useId(),
    mfaHelp: useId(),
    danger: useId(),
    dangerHelp: useId(),
  };

  const motionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("display_name, region, board").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setDisplayName(data?.display_name ?? "");
      setRegion(data?.region ?? "");
      setBoard(data?.board ?? "");
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user]);

  const saveIdentity = async () => {
    if (!user) return;
    setSavingIdentity(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName, region, board }, { onConflict: "id" });
    setSavingIdentity(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Profile saved");
  };

  const selectMotion = (v: MotionPref) => {
    setMotionPref(v);
    toast.success(
      v === "on"
        ? "Background motion enabled"
        : v === "off"
        ? "Background motion disabled"
        : "Following system preference",
    );
  };

  // Roving tabindex + arrow-key navigation for the motion radiogroup.
  const onMotionKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = MOTION_OPTIONS.length - 1;
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    const target = MOTION_OPTIONS[next];
    selectMotion(target.v);
    motionButtonRefs.current[next]?.focus();
  };

  const monogram = (displayName || user?.email || "?").trim().split(/\s+/)[0];

  const inputClass =
    "bg-glass-surface border-b border-glass-border focus:border-primary rounded-none px-3 py-2 font-body-md text-on-surface outline-none transition-colors w-full";
  const labelClass = "font-mono-code text-mono-code text-secondary text-xs uppercase";

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-28 pb-margin px-4 sm:px-margin max-w-container-max mx-auto flex flex-col gap-gutter">

          <div className="mb-4 min-w-0">
            <h2 className="font-headline-lg text-2xl sm:text-headline-lg text-on-surface break-words">Configuration</h2>
            <p className="font-body-md text-body-md text-secondary mt-2">
              Manage your academic engineering environment and security parameters.
            </p>
          </div>

          <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
            {/* Identity */}
            <section aria-labelledby={ids.identity} className="bento-card p-4 sm:p-8 flex flex-col gap-6 relative">
              <div className="pb-4 border-b border-outline-variant">
                <h3 id={ids.identity} className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Identity Profile</h3>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                <div
                  role="img"
                  aria-label={`Profile avatar for ${monogram}`}
                  className="w-24 h-24 rounded-full border-2 border-outline-variant bg-glass-surface flex items-center justify-center shrink-0 overflow-hidden"
                >
                  <span aria-hidden="true" className="font-headline-md text-on-surface font-bold uppercase truncate px-2 max-w-full">
                    {monogram}
                  </span>
                </div>
                <div className="flex flex-col gap-4 w-full min-w-0">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <label htmlFor={ids.displayName} className={labelClass}>Display Name</label>
                      <input
                        id={ids.displayName}
                        aria-describedby={ids.displayNameHelp}
                        className={inputClass}
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={loaded ? "Add a display name" : "Loading…"}
                      />
                      <p id={ids.displayNameHelp} className="sr-only">
                        Shown on your public profile and used for your avatar monogram.
                      </p>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <label htmlFor={ids.board} className={labelClass}>Board</label>
                      <input
                        id={ids.board}
                        className={inputClass}
                        type="text"
                        value={board}
                        onChange={(e) => setBoard(e.target.value)}
                        placeholder="CBSE, AQA, …"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.email} className={labelClass}>Account Email</label>
                    <input
                      id={ids.email}
                      aria-describedby={ids.emailHelp}
                      aria-readonly="true"
                      className="bg-glass-surface border-b border-glass-border rounded-none px-3 py-2 font-body-md text-on-surface-variant outline-none w-full"
                      type="email"
                      value={user?.email ?? ""}
                      readOnly
                    />
                    <p id={ids.emailHelp} className="sr-only">
                      Email is managed by your authentication provider and cannot be edited here.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.region} className={labelClass}>Region</label>
                    <input
                      id={ids.region}
                      className={inputClass}
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="India — WB"
                    />
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={saveIdentity}
                      disabled={savingIdentity || !loaded}
                      className="bg-primary text-on-primary font-label-sm text-label-sm py-2 px-6 rounded-[4px] uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {savingIdentity && (
                        <span aria-hidden="true" className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>
                          progress_activity
                        </span>
                      )}
                      {savingIdentity ? "Saving…" : "Save Profile"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Localization */}
            <section aria-labelledby={ids.localization} className="bento-card p-4 sm:p-8 flex flex-col gap-6 relative">
              <div className="pb-4 border-b border-outline-variant">
                <h3 id={ids.localization} className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Localization &amp; Display</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {[
                  { id: ids.language, l: "System Language", opts: LANGUAGE_OPTIONS as readonly string[], value: language, set: updateLanguage },
                  { id: ids.dataRegion, l: "Data Region", opts: DATA_REGION_OPTIONS as readonly string[], value: dataRegion, set: updateDataRegion },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col gap-2">
                    <label htmlFor={s.id} className={labelClass}>{s.l}</label>
                    <div className="relative">
                      <select
                        id={s.id}
                        value={s.value}
                        onChange={(e) => s.set(e.target.value)}
                        style={{ colorScheme: "dark" }}
                        className="appearance-none bg-glass-surface border border-glass-border rounded px-4 py-3 font-body-md text-on-surface w-full focus:border-primary outline-none cursor-pointer"
                      >
                        {s.opts.map((o) => (
                          <option key={o} style={{ backgroundColor: "#1a1a1a", color: "#ffffff", padding: "10px 16px" }}>{o}</option>
                        ))}
                      </select>
                      <Icon
                        name="expand_more"
                        aria-hidden="true"
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-4 border-t border-outline-variant pt-6">
                {[
                  { id: ids.compact, helpId: ids.compactHelp, t: "Compact Ledger View", d: "Reduce padding in data tables to display more telemetry.", on: compact, set: updateCompact },
                  { id: ids.hiContrast, helpId: ids.hiContrastHelp, t: "High Contrast Typography", d: "Force maximum contrast for all structural labels.", on: highContrast, set: updateHighContrast },
                ].map((tog) => (
                  <div key={tog.t} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h4 id={tog.id} className="font-label-sm text-label-sm text-on-surface">{tog.t}</h4>
                      <p id={tog.helpId} className="font-body-md text-sm text-secondary">{tog.d}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tog.on}
                      aria-labelledby={tog.id}
                      aria-describedby={tog.helpId}
                      onClick={() => tog.set(!tog.on)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 9999,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 2px",
                        cursor: "pointer",
                        border: tog.on ? "1px solid #ffffff" : "1px solid rgba(255,255,255,0.20)",
                        backgroundColor: tog.on ? "#ffffff" : "rgba(255,255,255,0.08)",
                        transition: "background-color 0.25s ease, border-color 0.25s ease",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9999,
                          backgroundColor: tog.on ? "#111111" : "#a7a7a7",
                          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background-color 0.25s ease",
                          transform: tog.on ? "translateX(20px)" : "translateX(0)",
                        }}
                      />
                    </button>
                  </div>
                ))}

                {/* Background motion — tri-state segmented control */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-outline-variant">
                  <div className="min-w-0">
                    <h4 id={ids.motionLabel} className="font-label-sm text-label-sm text-on-surface">Background Motion</h4>
                    <p id={ids.motionHelp} className="font-body-md text-sm text-secondary">
                      Toggle the drifting aurora behind the app. Overrides your system's reduced-motion setting.
                    </p>
                  </div>
                  <div
                    role="radiogroup"
                    aria-labelledby={ids.motionLabel}
                    aria-describedby={ids.motionHelp}
                    className="inline-flex flex-wrap self-start rounded-full bg-glass-input border border-glass-border p-0.5 max-w-full"
                  >
                    {MOTION_OPTIONS.map((opt, index) => {
                      const active = motionPref === opt.v;
                      return (
                        <button
                          key={opt.v}
                          ref={(el) => { motionButtonRefs.current[index] = el; }}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          tabIndex={active ? 0 : -1}
                          onClick={() => selectMotion(opt.v)}
                          onKeyDown={(e) => onMotionKeyDown(e, index)}
                          style={{
                            padding: "4px 12px",
                            borderRadius: 9999,
                            fontSize: 13,
                            fontWeight: 500,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase" as const,
                            transition: "background-color 0.2s ease, color 0.2s ease",
                            backgroundColor: active ? "#ffffff" : "transparent",
                            color: active ? "#111111" : "rgba(255,255,255,0.60)",
                            cursor: "pointer",
                            border: "none",
                          }}
                        >
                          {opt.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>


            {/* Access */}
            <section aria-labelledby={ids.access} className="bento-card p-4 sm:p-8 flex flex-col gap-6 relative">
              <div className="pb-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-2">
                <h3 id={ids.access} className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Access &amp; Security</h3>
                <span className="font-mono-code text-xs text-primary px-2 py-1 rounded-sm border border-glass-border bg-transparent">
                  SECURE
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { titleId: ids.authProto, helpId: ids.authProtoHelp, icon: "key", title: "Authentication Protocol", desc: "Last rotated 42 days ago.", cta: "Update Key" },
                  { titleId: ids.mfa, helpId: ids.mfaHelp, icon: "shield_locked", title: "Multi-Factor Authenticator", desc: "Hardware token mandated for high-level clearance.", cta: "Configure" },
                ].map((row) => (
                  <div key={row.title} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-glass-border-subtle bg-surface/40 rounded backdrop-blur-sm">
                    <div className="flex items-start gap-4 min-w-0">
                      <Icon name={row.icon} aria-hidden="true" className="text-secondary shrink-0" />
                      <div className="min-w-0">
                        <h4 id={row.titleId} className="font-label-sm text-label-sm text-on-surface">{row.title}</h4>
                        <p id={row.helpId} className="font-body-md text-sm text-secondary mt-1">{row.desc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${row.cta} — ${row.title}`}
                      aria-describedby={row.helpId}
                      className="border-outline-variant font-label-sm text-label-sm py-2 px-4 rounded-[4px] uppercase tracking-wide self-start sm:self-auto"
                    >
                      {row.cta}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Reset preferences */}
            <section
              aria-label="Reset preferences"
              className="bento-card p-4 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="min-w-0">
                <h4 className="font-label-sm text-label-sm text-on-surface uppercase tracking-widest">Reset to defaults</h4>
                <p className="font-body-md text-sm text-secondary mt-1">
                  Restore motion, localization, and access preferences to their system defaults. Your account, uploads, and identity are not affected.
                </p>
              </div>
              <button
                type="button"
                onClick={resetPreferences}
                className="border border-glass-border font-label-sm text-label-sm py-2 px-4 rounded-[4px] uppercase self-start sm:self-auto hover:bg-surface/60 transition-colors shrink-0"
              >
                Reset to defaults
              </button>
            </section>


            {/* Danger */}
            <section
              aria-labelledby={ids.danger}
              className="mt-4 border border-error/30 bg-error-container/20 rounded-[12px] p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 backdrop-blur-sm"
            >
              <div className="min-w-0">
                <h4 id={ids.danger} className="font-label-sm text-label-sm text-error uppercase tracking-widest">Terminate Account</h4>
                <p id={ids.dangerHelp} className="font-body-md text-sm text-on-surface-variant mt-1">
                  Permanently erase all academic records and configurations from the ledger.
                </p>
              </div>
              <button
                type="button"
                aria-describedby={ids.dangerHelp}
                disabled={deleting}
                aria-busy={deleting}
                onClick={() => {
                  if (deleteInFlightRef.current) return;
                  setConfirmText("");
                  setConfirmOpen(true);
                  setTimeout(() => confirmInputRef.current?.focus(), 50);
                }}
                className="bg-error text-white font-label-sm text-label-sm py-2 px-6 rounded-[4px] hover:bg-error/80 transition-colors uppercase tracking-wider self-start sm:self-auto shrink-0 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Initiate Deletion"}
              </button>
            </section>

            {confirmOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-delete-title"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onKeyDown={(e) => {
                  if (e.key === "Escape" && !deleting) setConfirmOpen(false);
                }}
              >
                <div className="glass-card w-full max-w-md rounded-[16px] p-6 border border-error/40">
                  <h3 id="confirm-delete-title" className="font-label-sm text-label-sm text-error uppercase tracking-widest">
                    Confirm account deletion
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mt-2">
                    This will permanently erase your account and all associated data. This action cannot be undone.
                  </p>
                  <p className="font-body-md text-sm text-on-surface mt-4">
                    Type <span className="font-mono font-bold text-error">{CONFIRM_WORD}</span> to confirm.
                  </p>
                  <input
                    ref={confirmInputRef}
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={deleting}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`Type ${CONFIRM_WORD} to confirm`}
                    className="w-full mt-3 bg-black/40 border border-white/25 rounded-[6px] px-3 py-2 font-mono text-white placeholder:text-white/40 focus:outline-none"
                    placeholder={CONFIRM_WORD}
                  />
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmOpen(false)}
                      className="border border-glass-border font-label-sm text-label-sm py-2 px-4 rounded-[4px] uppercase hover:bg-surface/60 transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting || confirmText !== CONFIRM_WORD}
                      aria-busy={deleting}
                      onClick={async () => {
                        if (deleteInFlightRef.current) return;
                        if (confirmText !== CONFIRM_WORD) return;
                        deleteInFlightRef.current = true;
                        setDeleting(true);
                        try {
                          const result = (await deleteAccountFn()) as DeletionReport;
                          setReport(result);
                          setConfirmOpen(false);
                          if (result.totalRemaining === 0 && result.authUserRemoved) {
                            toast.success("Account deleted — review the report before signing out");
                          } else {
                            toast.warning("Deletion completed with remaining records — see report");
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error(err instanceof Error ? err.message : "Failed to delete account");
                          setConfirmOpen(false);
                        } finally {
                          deleteInFlightRef.current = false;
                          setDeleting(false);
                        }
                      }}
                      className="bg-error text-white font-label-sm text-label-sm py-2 px-6 rounded-[4px] hover:bg-error/80 transition-colors uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Deleting…" : "Permanently delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {report && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="deletion-report-title"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              >
                <div className="glass-card w-full max-w-2xl rounded-[16px] p-6 border border-glass-border max-h-[90vh] overflow-y-auto">
                  <h3 id="deletion-report-title" className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface">
                    Deletion verification report
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mt-2">
                    Re-queried the ledger after deletion. Review results before signing out.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="bento-card rounded-[8px] p-3">
                      <div className="text-xs uppercase text-on-surface-variant">Deleted</div>
                      <div className="text-2xl font-semibold text-on-surface mt-1">{report.totalDeleted}</div>
                    </div>
                    <div className="bento-card rounded-[8px] p-3">
                      <div className="text-xs uppercase text-on-surface-variant">Remaining</div>
                      <div className={`text-2xl font-semibold mt-1 ${report.totalRemaining === 0 ? "text-on-surface" : "text-error"}`}>
                        {report.totalRemaining}
                      </div>
                    </div>
                    <div className="bento-card rounded-[8px] p-3 col-span-2">
                      <div className="text-xs uppercase text-on-surface-variant">Auth user</div>
                      <div className={`text-sm font-semibold mt-1 ${report.authUserRemoved ? "text-on-surface" : "text-error"}`}>
                        {report.authUserRemoved ? "Removed ✓" : "Still present ✗"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border border-glass-border rounded-[8px] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-black/30">
                        <tr className="text-left text-xs uppercase text-on-surface-variant">
                          <th className="px-3 py-2">Table</th>
                          <th className="px-3 py-2 text-right">Before</th>
                          <th className="px-3 py-2 text-right">Deleted</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((r) => (
                          <tr key={r.table} className="border-t border-glass-border/60">
                            <td className="px-3 py-2 font-mono text-on-surface">{r.table}</td>
                            <td className="px-3 py-2 text-right text-on-surface-variant">{r.before}</td>
                            <td className="px-3 py-2 text-right text-on-surface">{r.deleted}</td>
                            <td className={`px-3 py-2 text-right ${r.remaining === 0 ? "text-on-surface-variant" : "text-error font-semibold"}`}>
                              {r.remaining < 0 ? "?" : r.remaining}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.ok ? (
                                <span className="text-on-surface" title="Cleared">✓</span>
                              ) : (
                                <span className="text-error" title={r.error ?? "Records remain"}>✗</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {report.rows.some((r) => r.error) && (
                    <ul className="mt-3 text-xs text-error space-y-1">
                      {report.rows.filter((r) => r.error).map((r) => (
                        <li key={r.table}><span className="font-mono">{r.table}</span>: {r.error}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={async () => {
                        setSigningOut(true);
                        try {
                          await supabase.auth.signOut();
                          navigate({ to: "/auth/login", replace: true });
                        } catch (err) {
                          console.error(err);
                          toast.error("Failed to sign out");
                          setSigningOut(false);
                        }
                      }}
                      className="bg-error text-white font-label-sm text-label-sm py-2 px-6 rounded-[4px] hover:bg-error/80 transition-colors uppercase tracking-wider disabled:opacity-60"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
      </main>
    </div>
  );
}
