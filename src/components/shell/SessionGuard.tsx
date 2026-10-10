"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * If a request to this site's own API comes back "not signed in" (the sign-in expired, or was
 * signed out from another tab), send the browser to the sign-in page and come back here after,
 * instead of leaving a page full of error text.
 */
export default function SessionGuard() {
  const router = useRouter();
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await original(...args);
      if (response.status === 401) {
        const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]), window.location.href);
        const ours = url.origin === window.location.origin && url.pathname.startsWith("/api/");
        // The sign-in calls themselves answer 401 for a wrong password; those are handled where they're made.
        if (ours && !url.pathname.startsWith("/api/auth/") && window.location.pathname !== "/unlock") {
          const here = window.location.pathname + window.location.search;
          router.replace(`/unlock?next=${encodeURIComponent(here)}`);
        }
      }
      return response;
    };
    return () => {
      window.fetch = original;
    };
  }, [router]);
  return null;
}
