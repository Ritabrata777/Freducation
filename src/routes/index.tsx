import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Icon } from "@/components/Icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Freducation — Regional learning, indexed and shared" },
      {
        name: "description",
        content:
          "Freducation is a regional knowledge hub for engineering learners. Upload, moderate, and discover high-signal course materials in one place.",
      },
      { property: "og:title", content: "Freducation — Regional learning, indexed and shared" },
      {
        property: "og:description",
        content:
          "Upload, moderate, and discover high-signal course materials from your region. Built for students, contributors, and moderators.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: "menu_book", title: "A living library", body: "PDFs, videos, notes, and past papers — indexed by subject, region, board, and language so you find the right thing fast." },
  { icon: "diversity_3", title: "Built by contributors", body: "Upload your own materials. Trusted contributors publish instantly; new contributors flow through review to keep quality high." },
  { icon: "campaign", title: "Request what's missing", body: "Post a request, upvote what matters, and get notified when a contributor fulfills it." },
  { icon: "verified", title: "Moderated, transparently", body: "Auto-flagging catches broken links, low-res scans, duplicates, and banned content. Every moderation action is logged." },
  { icon: "forum", title: "Discuss & Q&A", body: "Ask questions on any material, post answers, and mark helpful replies. Study together, not alone." },
  { icon: "bookmark", title: "Track your progress", body: "Save for later, mark reading, complete. Get a personalized feed of what to study next." },
];

const STATS = [
  { label: "Regions covered", value: "12+" },
  { label: "Subjects", value: "40+" },
  { label: "Contributors", value: "growing" },
  { label: "Moderation actions logged", value: "100%" },
];

const REGIONS = ["West Bengal", "Maharashtra", "Karnataka", "Tamil Nadu", "Delhi NCR", "Kerala", "Gujarat", "Punjab", "Rajasthan", "Odisha"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Computer Science", "Electronics", "Mechanical", "Civil", "Economics"];

function Landing() {
  return (
    <div className="min-h-screen text-white antialiased">
      {/* Nav */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-container-max">
        <div className="lg-header h-14">
          <div className="lg-filter" />
          <div className="lg-overlay" />
          <div className="lg-specular" />
          <div className="lg-content flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-headline-md text-[20px] text-primary font-bold">
              <span className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <Icon name="school" style={{ fontSize: 18 }} />
              </span>
              Freducation
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <a href="#about" className="px-3 py-2 rounded-full text-text-secondary hover:text-white hover:bg-glass-surface font-label-sm text-label-sm uppercase tracking-widest">About</a>
              <a href="#features" className="px-3 py-2 rounded-full text-text-secondary hover:text-white hover:bg-glass-surface font-label-sm text-label-sm uppercase tracking-widest">Features</a>
              <a href="#how" className="px-3 py-2 rounded-full text-text-secondary hover:text-white hover:bg-glass-surface font-label-sm text-label-sm uppercase tracking-widest">How it works</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110"
              >
                <Icon name="login" style={{ fontSize: 16 }} />
                Login
              </Link>
              <Link
                to="/auth/signup"
                className="hidden sm:inline-flex px-4 py-1.5 rounded-full bg-glass-surface border border-glass-border text-white font-label-sm text-label-sm uppercase tracking-widest hover:bg-white/10"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-16 px-gutter relative overflow-hidden">
        <div className="max-w-container-max mx-auto text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-glass-surface border border-glass-border text-text-secondary font-label-sm text-label-sm uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open · Community-moderated · Free
          </span>
          <h1 className="mt-6 font-headline-md text-[44px] md:text-[68px] leading-[1.03] tracking-tight text-white">
            A shared library for the way<br className="hidden md:block" />
            <span className="text-primary">your region actually studies.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto font-body-md text-body-md text-text-secondary text-[17px] leading-relaxed">
            Freducation is where students, contributors, and moderators gather the notes, papers, and lectures that matter — organized by subject, region, board, and language, and kept trustworthy through open moderation.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:brightness-110"
            >
              <Icon name="login" style={{ fontSize: 18 }} />
              Login to continue
            </Link>
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-glass-surface border border-glass-border text-white font-label-sm text-label-sm uppercase tracking-widest hover:bg-white/10"
            >
              Create account
              <Icon name="arrow_forward" style={{ fontSize: 18 }} />
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-gutter max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="bento-card p-5">
                <div className="font-headline-md text-headline-md text-white">{s.value}</div>
                <div className="mt-1 font-label-sm text-label-sm uppercase tracking-widest text-text-secondary">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regions marquee */}
      <section className="py-8 px-gutter">
        <div className="max-w-container-max mx-auto">
          <div className="text-center font-label-sm text-label-sm uppercase tracking-widest text-text-secondary mb-4">
            Materials from learners across
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {REGIONS.map((r) => (
              <span key={r} className="px-3 py-1.5 rounded-full bg-glass-surface border border-glass-border text-white/80 font-label-sm text-label-sm">
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 px-gutter">
        <div className="max-w-container-max mx-auto grid md:grid-cols-2 gap-gutter items-start">
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">About Freducation</span>
            <h2 className="mt-3 font-headline-md text-[32px] leading-tight text-white">
              Wikipedia's openness. Notion's structure. A hub for regional coursework.
            </h2>
          </div>
          <div className="space-y-4 font-body-md text-body-md text-text-secondary text-[16px] leading-relaxed">
            <p>Study materials are scattered across chats, drives, and hard drives — and the good ones stay locked in the notebooks of a few seniors. Freducation gathers them in one place, structured so anyone in your region can find, verify, and build on them.</p>
            <p>Contributors keep the library alive. Moderators keep it honest. Learners get a feed that adapts to what they study — with progress tracking, saved lists, and Q&A on every material.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-gutter">
        <div className="max-w-container-max mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">What you get</span>
            <h2 className="mt-3 font-headline-md text-[32px] leading-tight text-white">
              Everything a study community needs, without the chaos.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {FEATURES.map((f) => (
              <div key={f.title} className="bento-card p-6 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Icon name={f.icon} style={{ fontSize: 20 }} />
                </div>
                <h3 className="font-headline-md text-[18px] text-white">{f.title}</h3>
                <p className="font-body-md text-body-md text-text-secondary text-[14px] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="py-12 px-gutter">
        <div className="max-w-container-max mx-auto bento-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="font-label-sm text-label-sm uppercase tracking-widest text-primary">Browse by subject</div>
              <h3 className="mt-2 font-headline-md text-[24px] text-white">Every core stream, one shelf.</h3>
            </div>
            <Link to="/auth/login" className="text-primary font-label-sm text-label-sm uppercase tracking-widest hover:underline">
              Open library →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <span key={s} className="px-4 py-2 rounded-lg bg-glass-surface border border-glass-border text-white/90 font-label-sm text-label-sm">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-gutter">
        <div className="max-w-container-max mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary">How it works</span>
            <h2 className="mt-3 font-headline-md text-[32px] leading-tight text-white">
              Three steps from empty tab to next study session.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-gutter">
            {[
              { n: "01", t: "Log in or sign up", b: "Continue with Google or email. Pick your region, board, and subjects in seconds." },
              { n: "02", t: "Browse or contribute", b: "Filter the library by subject, region, and language. Upload your own notes — trusted contributors publish instantly." },
              { n: "03", t: "Study, track, discuss", b: "Save for later, mark completed, ask questions on any material, and follow a feed personalized to your progress." },
            ].map((s) => (
              <div key={s.n} className="bento-card p-6">
                <div className="font-headline-md text-headline-md text-primary">{s.n}</div>
                <h3 className="mt-3 font-headline-md text-[18px] text-white">{s.t}</h3>
                <p className="mt-2 font-body-md text-body-md text-text-secondary text-[14px] leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-gutter">
        <div className="max-w-3xl mx-auto bento-card p-10 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative">
            <h2 className="font-headline-md text-[32px] leading-tight text-white">Ready to jump in?</h2>
            <p className="mt-3 font-body-md text-body-md text-text-secondary text-[16px]">
              Log in to open the library, or create a free account in seconds.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary font-label-sm text-label-sm uppercase tracking-widest shadow-xl shadow-primary/30 hover:brightness-110"
              >
                <Icon name="login" style={{ fontSize: 18 }} />
                Login
              </Link>
              <Link
                to="/auth/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-glass-surface border border-glass-border text-white font-label-sm text-label-sm uppercase tracking-widest hover:bg-white/10"
              >
                Sign up free
                <Icon name="arrow_forward" style={{ fontSize: 18 }} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 px-gutter border-t border-glass-border">
        <div className="max-w-container-max mx-auto flex flex-wrap items-center justify-between gap-3">
          <span className="font-label-sm text-label-sm text-text-secondary">© {new Date().getFullYear()} Freducation</span>
          <div className="flex items-center gap-4 text-text-secondary font-label-sm text-label-sm uppercase tracking-widest">
            <a href="#about" className="hover:text-white">About</a>
            <a href="#features" className="hover:text-white">Features</a>
            <Link to="/auth/login" className="hover:text-white">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
