import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; label: string; adminOnly?: boolean; authOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/home", label: "Dashboard" },
  { to: "/library", label: "Library" },
  { to: "/my-list", label: "My List", authOnly: true },
  { to: "/requests", label: "Requests", authOnly: true },
  { to: "/ingest", label: "Upload", authOnly: true },
  { to: "/admin/users", label: "Users", adminOnly: true },
  { to: "/admin/policies", label: "Policies", adminOnly: true },
  { to: "/settings", label: "Settings", authOnly: true },
];

export type TopNavProps = {
  query?: string;
  setQuery?: (v: string) => void;
  searchPlaceholder?: string;
};

export function TopNav({ query, setQuery, searchPlaceholder = "Search…" }: TopNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const items = NAV.filter((i) => {
    if (i.adminOnly) return isAdmin;
    if (i.authOnly) return !!user;
    return true;
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth/login" });
  };

  return (
    <>
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="lg-dist" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
            <feDisplacementMap in="SourceGraphic" in2="blurred" scale="70" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <header className="lg-header fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-container-max h-16">
        <div className="lg-filter" />
        <div className="lg-overlay" />
        <div className="lg-specular" />
        <div className="lg-content">
          <Link to="/home" className="flex items-center gap-2 shrink-0">
            <span className="font-headline-md text-[20px] text-primary font-bold drop-shadow-sm">Freducation</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {items.map((it) => {
              const active = pathname === it.to;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`px-4 py-2 rounded-full font-label-sm text-label-sm uppercase tracking-widest transition-colors ${
                    active
                      ? "text-white font-bold bg-glass-input-strong shadow-inner"
                      : "text-text-secondary hover:text-white hover:bg-glass-surface"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {setQuery && (
              <div className="relative w-64 hidden xl:block">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                  style={{ fontSize: 16 }}
                />
                <input
                  value={query ?? ""}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-glass-input border border-glass-border-strong rounded-full py-1.5 pl-9 pr-4 font-body-md text-[14px] text-white placeholder:text-text-secondary focus:outline-none focus:border-glass-border-strong"
                />
              </div>
            )}
            {user ? (
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-text-secondary hover:text-white hover:bg-glass-surface font-label-sm text-label-sm uppercase tracking-widest transition-colors"
                title={user.email ?? "Sign out"}
              >
                <Icon name="logout" style={{ fontSize: 16 }} />
                <span className="hidden md:inline">Sign out</span>
              </button>
            ) : (
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-widest"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

