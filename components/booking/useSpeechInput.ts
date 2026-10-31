"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Patients don't have Wispr Flow on their phones, so the public booking page uses the browser's
// own speech recognition (Chrome/Edge/Safari; Indian English by default). If unsupported, the UI
// falls back to the keyboard's own mic button. Staff screens keep using Wispr.

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function useSpeechInput(onText: (finalText: string) => void, lang = "en-IN") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Rec | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(!!(W.SpeechRecognition ?? W.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission was denied." : e.error === "no-speech" ? "Didn't catch that. Try again." : "Voice input stopped.");
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}
