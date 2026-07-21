import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "freducation:motion-pref";
type MotionPref = "on" | "off" | "system";

function readStored(): MotionPref {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "on" || v === "off" ? v : "system";
}

function apply(pref: MotionPref) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (pref === "system") html.removeAttribute("data-motion");
  else html.setAttribute("data-motion", pref);
}

// Initialize as early as possible on the client so aurora state matches saved pref.
if (typeof window !== "undefined") {
  apply(readStored());
}

export function useMotionPref() {
  const [pref, setPrefState] = useState<MotionPref>(() => readStored());

  useEffect(() => { apply(pref); }, [pref]);

  const setPref = useCallback((next: MotionPref) => {
    if (typeof window !== "undefined") {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    }
    setPrefState(next);
  }, []);

  // Resolved boolean: is motion currently enabled? "system" defers to prefers-reduced-motion.
  const systemReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motionEnabled = pref === "on" || (pref === "system" && !systemReduced);

  return { pref, setPref, motionEnabled };
}
