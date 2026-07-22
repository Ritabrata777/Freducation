import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { usePageViewTracker } from "@/hooks/use-page-view-tracker";


function NotFoundComponent() {
  return (
      <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display-xl text-display-xl text-primary">404</h1>
        <h2 className="mt-4 font-headline-md text-headline-md text-on-surface">Page not found</h2>
        <p className="mt-2 font-body-md text-on-surface-variant">
          The record you're looking for isn't in the ledger.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-label-sm text-label-sm uppercase tracking-wider text-on-primary transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-headline-md text-headline-md text-on-surface">This page didn't load</h1>
        <p className="mt-2 font-body-md text-on-surface-variant">
          Something went wrong on our end. Try again or return to the overview.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded bg-primary px-4 py-2 font-label-sm text-label-sm uppercase tracking-wider text-on-primary transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded border border-outline-variant bg-surface px-4 py-2 font-label-sm text-label-sm uppercase tracking-wider text-on-surface transition-colors hover:bg-surface-container"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Freducation — Academic Engineering Platform" },
      {
        name: "description",
        content:
          "Freducation is a structured knowledge platform for academic engineering — upload, index, moderate, and retrieve high-signal learning materials.",
      },
      { property: "og:title", content: "Freducation — Academic Engineering Platform" },
      {
        property: "og:description",
        content:
          "Structured knowledge platform for academic engineering: upload, index, moderate, and retrieve high-signal learning materials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Apply saved UI preferences before first paint to avoid visual flash.
            Mirrors the logic in use-motion-pref and use-ui-prefs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var h=document.documentElement;var v=localStorage.getItem('freducation:motion-pref');if(v==='on'||v==='off'){h.setAttribute('data-motion',v);}var raw=localStorage.getItem('settings.prefs.v1');if(raw){var p=JSON.parse(raw);if(p&&p.compact===true){h.setAttribute('data-density','compact');}if(p&&p.highContrast===true){h.setAttribute('data-contrast','high');}}}catch(e){}`,
          }}
        />
      </head>
      <body>

        <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <filter id="btn-glass" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
              <feDisplacementMap in="SourceGraphic" in2="blurred" scale="70" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        {children}
        <Toaster richColors position="top-right" closeButton theme="dark" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  usePageViewTracker();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
