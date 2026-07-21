import { useEffect, useState } from "react";

/** Shows a brief loading state on mount. Used for skeleton demos where a real fetch isn't in place yet. */
export function useFakeLoad(ms = 700): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}
