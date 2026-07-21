import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  redirect: fallback(z.string(), "/home").default("/home"),
});

export const Route = createFileRoute("/auth/login")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ search }) => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      throw redirect({ to: search.redirect ?? "/home" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign In — Freducation" },
      { name: "description", content: "Sign in to your Freducation account." },
      { property: "og:title", content: "Sign In — Freducation" },
      { property: "og:description", content: "Sign in to your Freducation account." },
    ],
  }),
  component: LoginPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safePath(p: string): string {
  return p.startsWith("/") && !p.startsWith("//") ? p : "/home";
}

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Sign in failed", { description: error.message });
      return;
    }
    toast.success("Signed in", { description: "Welcome back to Freducation." });
    navigate({ to: safePath(redirect) });
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("freducation:post-auth-redirect", safePath(redirect));
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/login`,
        },
      });
      if (error) {
        toast.error("Google sign in failed", { description: error.message ?? "Please try again." });
      }
    } catch (err) {
      toast.error("Google sign in failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-gutter text-white antialiased font-body-md">
      <div className="w-full max-w-md bento-card p-8 flex flex-col relative overflow-hidden">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="font-headline-md text-headline-md text-white tracking-tight">Welcome back</h1>
          <p className="font-body-md text-body-md text-text-secondary mt-2">Enter your email to sign in to your account</p>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2 h-10 px-4 border-outline-variant rounded-lg font-label-sm text-label-sm text-white active:scale-95 disabled:opacity-70"
        >
          {googleLoading ? (
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="relative flex items-center py-6">
          <div className="flex-grow border-t border-glass-border" />
          <span className="flex-shrink-0 mx-4 font-label-sm text-label-sm text-text-secondary uppercase tracking-widest text-[10px]">Or continue with</span>
          <div className="flex-grow border-t border-glass-border" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-white" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              placeholder="name@example.com"
              className={`w-full h-10 px-3 bg-glass-surface border rounded-lg font-mono-code text-mono-code text-white placeholder:text-text-secondary transition-all duration-200 focus:outline-none focus:bg-glass-surface-strong ${
                errors.email ? "border-error border-b-2 focus:border-error" : "border-glass-border border-b-2 focus:border-primary"
              }`}
            />
            {errors.email && <span className="font-label-sm text-[11px] text-error">{errors.email}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label-sm text-label-sm text-white" htmlFor="password">Password</label>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              className={`w-full h-10 px-3 bg-glass-surface border rounded-lg font-mono-code text-mono-code text-white placeholder:text-text-secondary transition-all duration-200 focus:outline-none focus:bg-glass-surface-strong ${
                errors.password ? "border-error border-b-2 focus:border-error" : "border-glass-border border-b-2 focus:border-primary"
              }`}
            />
            {errors.password && <span className="font-label-sm text-[11px] text-error">{errors.password}</span>}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 mt-2 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>}
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="font-body-md text-body-md text-text-secondary text-sm">
            Don't have an account?{" "}
            <Link to="/auth/signup" className="text-white font-semibold hover:text-primary transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
