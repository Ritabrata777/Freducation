import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/Skeleton";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  head: () => ({
    meta: [
      { title: "Contributor — Freducation" },
      { name: "description", content: "View a Freducation contributor's profile, uploads, and badges." },
      { property: "og:title", content: "Contributor — Freducation" },
      { property: "og:description", content: "View a Freducation contributor's profile, uploads, and badges." },
    ],
  }),
  component: ProfilePage,
});

type Badge = {
  key: string;
  label: string;
  icon: string;
  desc: string;
  earned: boolean;
};

function computeBadges(stats: {
  liveUploads: number;
  pending: number;
  helpfulVotes: number;
  reportsAgainst: number;
}): Badge[] {
  const { liveUploads, helpfulVotes, reportsAgainst } = stats;
  return [
    { key: "novice", label: "Novice Contributor", icon: "eco", desc: "1+ approved upload", earned: liveUploads >= 1 },
    { key: "contributor", label: "Contributor", icon: "workspace_premium", desc: "5+ approved uploads", earned: liveUploads >= 5 },
    { key: "curator", label: "Curator", icon: "auto_awesome", desc: "20+ approved uploads", earned: liveUploads >= 20 },
    { key: "scholar", label: "Scholar", icon: "school", desc: "50+ approved uploads", earned: liveUploads >= 50 },
    { key: "helpful", label: "Helpful", icon: "thumb_up", desc: "10+ helpful votes received", earned: helpfulVotes >= 10 },
    { key: "trusted", label: "Trusted", icon: "verified", desc: "50+ helpful votes received", earned: helpfulVotes >= 50 },
    { key: "reliable", label: "Reliable", icon: "shield", desc: "5+ uploads with zero reports", earned: liveUploads >= 5 && reportsAgainst === 0 },
  ];
}

function ProfilePage() {
  const { userId } = Route.useParams();

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, region, board, language, created_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const materialsQ = useQuery({
    queryKey: ["profile", userId, "materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, description, material_type, status, subject, region, language, tags, created_at")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statsQ = useQuery({
    queryKey: ["profile", userId, "stats"],
    queryFn: async () => {
      const materialIds = (materialsQ.data ?? []).map((m) => m.id);
      let helpfulVotes = 0;
      let reportsAgainst = 0;
      if (materialIds.length) {
        const { data: votes } = await supabase
          .from("material_votes")
          .select("value")
          .in("material_id", materialIds);
        helpfulVotes = (votes ?? []).reduce((s, v: { value: number }) => s + (v.value > 0 ? 1 : 0), 0);
        const { count } = await supabase
          .from("reports")
          .select("id", { count: "exact", head: true })
          .in("material_id", materialIds);
        reportsAgainst = count ?? 0;
      }
      const liveUploads = (materialsQ.data ?? []).filter((m) => m.status === "live").length;
      const pending = (materialsQ.data ?? []).filter((m) => m.status !== "live").length;
      return { liveUploads, pending, helpfulVotes, reportsAgainst };
    },
    enabled: !!materialsQ.data,
  });

  const loading = profileQ.isLoading || materialsQ.isLoading;
  const profile = profileQ.data;
  const materials = materialsQ.data ?? [];
  const stats = statsQ.data ?? { liveUploads: 0, pending: 0, helpfulVotes: 0, reportsAgainst: 0 };
  const badges = computeBadges(stats);
  const earned = badges.filter((b) => b.earned);
  const monogram = (profile?.display_name ?? "?").trim().split(/\s+/)[0]?.slice(0, 2).toUpperCase() || "?";

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen">
      <TopNav />
      <main className="pt-28 pb-margin">
        <div className="max-w-container-max mx-auto px-margin">
          <Link to="/library" className="inline-flex items-center gap-1 text-sm text-secondary hover:text-on-background mb-4">
            <Icon name="arrow_back" className="text-base" /> Back to Library
          </Link>

          {loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : !profile ? (
            <div className="glass-card p-8 rounded-2xl text-center">
              <Icon name="person_off" className="text-4xl text-secondary" />
              <p className="mt-2 text-secondary">Contributor not found.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <section className="glass-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-semibold shrink-0">
                  {monogram}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-headline-lg text-headline-lg truncate">{profile.display_name ?? "Anonymous"}</h1>
                  <p className="text-secondary text-sm mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {profile.region && <span className="inline-flex items-center gap-1"><Icon name="public" className="text-sm" />{profile.region}</span>}
                    {profile.board && <span className="inline-flex items-center gap-1"><Icon name="school" className="text-sm" />{profile.board}</span>}
                    {profile.language && <span className="inline-flex items-center gap-1"><Icon name="translate" className="text-sm" />{profile.language}</span>}
                    <span className="inline-flex items-center gap-1"><Icon name="calendar_today" className="text-sm" />Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 md:gap-4 shrink-0">
                  <Stat label="Live" value={stats.liveUploads} />
                  <Stat label="Helpful" value={stats.helpfulVotes} />
                  <Stat label="Badges" value={earned.length} />
                </div>
              </section>

              {/* Badges */}
              <section className="mt-6">
                <h2 className="font-title-lg text-title-lg mb-3">Badges</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {badges.map((b) => (
                    <div
                      key={b.key}
                      className={`glass-card rounded-xl p-4 flex items-start gap-3 transition ${b.earned ? "" : "opacity-40"}`}
                      title={b.desc}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${b.earned ? "bg-white/15" : "bg-white/5"}`}>
                        <Icon name={b.icon} className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.label}</p>
                        <p className="text-xs text-secondary">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Uploads */}
              <section className="mt-6">
                <h2 className="font-title-lg text-title-lg mb-3">
                  Uploads <span className="text-secondary text-sm font-normal">({materials.length})</span>
                </h2>
                {materials.length === 0 ? (
                  <div className="glass-card p-6 rounded-xl text-center text-secondary">No uploads yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materials.map((m) => (
                      <Link
                        key={m.id}
                        to="/material/$id"
                        params={{ id: m.id }}
                        className="glass-card rounded-xl p-4 hover:bg-white/5 transition block"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs uppercase tracking-wide text-secondary">{m.material_type}</span>
                          {m.status !== "live" && (
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                              {m.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-medium line-clamp-2">{m.title}</p>
                        {m.subject && <p className="text-xs text-secondary mt-1">{m.subject}</p>}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-center min-w-[64px]">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="text-[10px] uppercase text-secondary tracking-wide mt-1">{label}</div>
    </div>
  );
}
