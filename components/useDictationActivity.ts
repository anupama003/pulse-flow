"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wispr Flow dictates at the OS level, so the browser never sees the hotkey.
 * What it does see: text landing in the focused field in bursts. We treat
 * "value changed within the last `quietMs`" as "receiving dictation".
 */
export function useDictationActivity(value: string, quietMs = 1400) {
  const [receiving, setReceiving] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const grew = value.length > prev.current.length;
    prev.current = value;
    if (!grew) return;
    setReceiving(true);
    const t = setTimeout(() => setReceiving(false), quietMs);
    return () => clearTimeout(t);
  }, [value, quietMs]);

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return { receiving, words };
}
