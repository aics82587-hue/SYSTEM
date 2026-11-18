"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./ToastProvider";

interface Props { timeoutMinutes?: number; }

export function SessionTimeout({ timeoutMinutes = 15 }: Props) {
  const { showToast } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMs = timeoutMinutes * 60 * 1000;

  function resetTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      showToast("You've been signed out due to inactivity.", "info");
      window.location.href = "/login";
    }, timeoutMs);
  }

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
