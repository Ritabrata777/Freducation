import { useEffect, useState } from "react";

const STORAGE_KEY = "settings.prefs.v1";

export type UiPrefs = {
  language: string;
  dataRegion: string;
  compact: boolean;
  highContrast: boolean;
};

export const DEFAULT_UI_PREFS: UiPrefs = {
  language: "English (US - Technical)",
  dataRegion: "North America (US-East-1)",
  compact: true,
  highContrast: false,
};

export function readUiPrefs(): Partial<UiPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<UiPrefs>) : {};
  } catch {
    return {};
  }
}

function applyUiPrefs(prefs: Partial<UiPrefs>) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (prefs.compact) html.setAttribute("data-density", "compact");
  else html.removeAttribute("data-density");

  if (prefs.highContrast) html.setAttribute("data-contrast", "high");
  else html.removeAttribute("data-contrast");
}

if (typeof window !== "undefined") {
  applyUiPrefs(readUiPrefs());
}

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefs>({
    ...DEFAULT_UI_PREFS,
    ...readUiPrefs(),
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULT_UI_PREFS, ...readUiPrefs() };
    setPrefs(next);
    applyUiPrefs(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyUiPrefs(prefs);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage failures.
    }
  }, [hydrated, prefs]);

  return { prefs, setPrefs, hydrated };
}
