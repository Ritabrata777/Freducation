import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

type Item = { label: string; icon: string; to: string; adminOnly?: boolean; authOnly?: boolean };

const items: Item[] = [
  { label: "System Overview", icon: "dashboard", to: "/home", adminOnly: true },
  { label: "Library", icon: "menu_book", to: "/library" },
  { label: "Ingest", icon: "cloud_upload", to: "/ingest", authOnly: true },
  { label: "User Monitoring", icon: "monitoring", to: "/admin/users", adminOnly: true },
  { label: "Policies", icon: "shield", to: "/admin/policies", adminOnly: true },
  { label: "Settings", icon: "settings", to: "/settings", authOnly: true },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const visibleItems = items.filter((i) => {
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
    <nav className="w-64 h-screen fixed left-0 top-0 border-r border-outline-variant bg-surface-container-low flex flex-col py-margin gap-unit z-50">
      <div className="px-6 pb-6 border-b border-outline-variant">
        <div>
          <h1 className="font-headline-md text-[20px] text-primary font-bold leading-tight">Freducation</h1>
          <p className="font-label-sm text-label-sm text-secondary mt-1">Academic Engineering</p>
        </div>
      </div>
      <div className="flex-1 px-4 mt-6 flex flex-col gap-2">
        {visibleItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                active
                  ? "text-primary font-bold border-r-2 border-primary bg-surface-container"
                  : "text-secondary hover:bg-surface-container"
              }`}
            >
              <Icon name={item.icon} filled={active} />
              <span className="font-label-sm text-label-sm">{item.label}</span>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col gap-2">
          {loading ? null : user ? (
            <>
              <div className="px-4 py-3 rounded-lg bg-surface-container border border-outline-variant">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="account_circle" style={{ fontSize: 18 }} className="text-secondary" />
                  <span className="font-label-sm text-label-sm text-on-surface truncate" title={user.email ?? ""}>
                    {user.email}
                  </span>
                </div>
                {isAdmin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 font-mono-code text-[10px] uppercase text-primary">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container transition-colors duration-200 text-left"
              >
                <Icon name="logout" />
                <span className="font-label-sm text-label-sm">Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              to="/auth/login"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-surface-container transition-colors duration-200"
            >
              <Icon name="login" />
              <span className="font-label-sm text-label-sm">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
