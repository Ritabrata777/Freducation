import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Records a page view row each time the pathname changes. Fire-and-forget. */
export function usePageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!pathname) return;
    // best-effort; ignore errors so tracking never breaks navigation
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        await supabase
          .from("page_views")
          .insert({ path: pathname, user_id: data.user?.id ?? null });
      } catch {
        /* ignore */
      }
    })();
  }, [pathname]);
}
