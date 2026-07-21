import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/signup")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      throw redirect({ to: "/home" });
    }
  },
  head: () => ({
    meta: [
      { title: "Create Account — Freducation" },
      { name: "description", content: "Create a Freducation account and join the academic engineering community." },
      { property: "og:title", content: "Create Account — Freducation" },
      { property: "og:description", content: "Create a Freducation account and join the academic engineering community." },
    ],
  }),
  component: SignupPage,
});

const inputBase =
  "w-full bg-glass-surface border-b px-4 py-3 font-body-md text-white focus:outline-none focus:bg-glass-surface-strong transition-colors rounded-t placeholder:text-text-secondary";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = { name: string; email: string; role: string; school: string; region: string; password: string };
type Errors = Partial<Record<keyof Form, string>>;

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({ name: "", email: "", role: "", school: "", region: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const cls = (k: keyof Form) =>
    `${inputBase} ${errors[k] ? "border-error focus:border-error" : "border-glass-border-strong focus:border-primary"}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Full name is required.";
    if (!form.email) next.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email)) next.email = "Enter a valid email address.";
    if (!form.role) next.role = "Please select a role.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Check the highlighted fields", { description: "A few details still need attention." });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/login",
        data: {
          display_name: form.name,
          region: form.region,
          full_name: form.name,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Signup failed", { description: error.message });
      return;
    }
    if (data.session) {
      toast.success("Account created", { description: "Welcome to Freducation." });
      navigate({ to: "/home" });
    } else {
      toast.success("Check your email", { description: "Confirm your address to finish signing up." });
      navigate({ to: "/auth/login" });
    }
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
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
    <div className="min-h-screen flex items-center justify-center p-4 antialiased text-white font-body-md selection:bg-primary-container selection:text-white">
      <div className="w-full max-w-md bento-card p-8 relative">
        <div className="flex flex-col items-center mb-8">
          <h1 className="font-headline-md text-headline-md text-white tracking-tight mb-2">Create an account</h1>
          <p className="font-body-md text-text-secondary text-center">Join the community and start learning</p>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={googleLoading}
          className="w-full border-outline-variant font-label-sm text-label-sm py-3 px-4 rounded flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70"
        >
          {googleLoading ? (
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
              <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.79 15.72 17.57V20.34H19.29C21.38 18.41 22.56 15.6 22.56 12.25Z" fill="#4285F4" />
              <path d="M12 23C14.97 23 17.46 22.02 19.29 20.34L15.72 17.57C14.73 18.23 13.48 18.63 12 18.63C9.13999 18.63 6.70999 16.7 5.83999 14.11H2.15999V16.96C3.96999 20.57 7.70999 23 12 23Z" fill="#34A853" />
              <path d="M5.83999 14.11C5.60999 13.45 5.48001 12.74 5.48001 12C5.48001 11.26 5.61001 10.55 5.84001 9.89V7.04H2.15999C1.41999 8.52 1 10.21 1 12C1 13.79 1.41999 15.48 2.15999 16.96L5.83999 14.11Z" fill="#FBBC05" />
              <path d="M12 5.38C13.62 5.38 15.06 5.94 16.2 7.03L19.37 3.86C17.45 2.07 14.97 1 12 1C7.70999 1 3.96999 3.43 2.15999 7.04L5.83999 9.89C6.70999 7.3 9.13999 5.38 12 5.38Z" fill="#EA4335" />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-glass-border" />
          <span className="px-4 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">Or register with email</span>
          <div className="flex-grow border-t border-glass-border" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field label="Full Name" error={errors.name}>
            <input className={cls("name")} type="text" placeholder="John Doe" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input className={cls("email")} type="email" placeholder="john@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Role" error={errors.role}>
            <SelectWrap>
              <select className={`${cls("role")} appearance-none w-full cursor-pointer`} value={form.role} onChange={(e) => set("role", e.target.value)}>
                <option disabled value="">Select a role...</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="creator">Independent Creator</option>
              </select>
            </SelectWrap>
          </Field>
          <Field label="School / College / Institute">
            <input className={cls("school")} type="text" placeholder="e.g., Heritage Institute of Technology" value={form.school} onChange={(e) => set("school", e.target.value)} />
          </Field>
          <Field label="Region / State">
            <SelectWrap>
              <select className={`${cls("region")} appearance-none w-full cursor-pointer`} value={form.region} onChange={(e) => set("region", e.target.value)}>
                <option disabled value="">Select a region...</option>
                <option value="ny">New York</option>
                <option value="ca">California</option>
                <option value="tx">Texas</option>
              </select>
            </SelectWrap>
          </Field>
          <Field label="Password" hint="Must be at least 8 characters" error={errors.password}>
            <input className={cls("password")} type="password" placeholder="••••••••" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full bg-primary text-on-primary font-label-sm text-label-sm py-3 px-4 rounded flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                Creating account…
              </>
            ) : (
              <>
                Create Account
                <Icon name="arrow_forward" style={{ fontSize: 18 }} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            to="/auth/login"
            className="font-label-sm text-label-sm text-text-secondary hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-sm text-label-sm text-white">{label}</label>
      {children}
      {error ? (
        <span className="font-label-sm text-[11px] text-error mt-1">{error}</span>
      ) : hint ? (
        <span className="font-label-sm text-[11px] text-text-secondary mt-1">{hint}</span>
      ) : null}
    </div>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span
        className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary"
        style={{ fontSize: 20 }}
      >
        expand_more
      </span>
    </div>
  );
}
