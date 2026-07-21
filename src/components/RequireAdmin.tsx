import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Icon } from "./Icon";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-secondary">
          <Icon name="progress_activity" className="animate-spin" />
          <span className="font-label-sm text-label-sm">Checking permissions…</span>
        </div>
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6">
      <div className="max-w-md text-center bento-card p-10">
        <div className="w-14 h-14 rounded-full bg-error-container mx-auto flex items-center justify-center mb-6">
          <Icon name="lock" className="text-error" style={{ fontSize: 28 }} />
        </div>
        <h1 className="font-headline-md text-headline-md text-on-background mb-2">Access denied</h1>
        <p className="font-body-md text-body-md text-secondary mb-6">
          This area is restricted to administrators. Ask an admin to grant you the{" "}
          <span className="font-mono-code text-mono-code">admin</span> role in the user directory.
        </p>
        <Link
          to="/home"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm"
        >
          <Icon name="arrow_back" style={{ fontSize: 18 }} />
          Back to overview
        </Link>
      </div>
    </div>
  );
}
