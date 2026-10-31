"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-runs the page's server component every `ms` while the tab is visible (live queues). */
export function useAutoRefresh(ms: number) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), ms);
    return () => clearInterval(t);
  }, [ms, router]);
}
