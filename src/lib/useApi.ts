"use client";

import { useEffect, useState } from "react";

/**
 * Fetches JSON from `url` on mount and whenever `url` changes. `reload()`
 * refetches the same URL; `replace(json)` swaps in data the caller already has
 * (e.g. the response of a "refresh" request) without another round trip.
 */
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? `request failed (${res.status})`);
        } else {
          setData(json as T);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  return {
    data,
    error,
    loading,
    reload: () => setTick((t) => t + 1),
    replace: (json: T) => {
      setData(json);
      setError(null);
    },
  };
}
