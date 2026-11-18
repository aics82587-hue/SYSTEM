"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "system" | "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    async function loadPreference() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const storageKey = user ? `mentalks-theme-${user.id}` : "mentalks-theme";
      const stored = localStorage.getItem(storageKey) as Theme | null;
      if (stored === "system" || stored === "light" || stored === "dark") {
        setTheme(stored);
        document.documentElement.dataset.theme = stored;
      }
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        if (!stored) console.error("Could not load theme preference:", error.message);
        return;
      }
      const preference = data?.theme_preference as Theme | undefined;
      if (preference === "system" || preference === "light" || preference === "dark") {
        setTheme(preference);
        document.documentElement.dataset.theme = preference;
        localStorage.setItem(storageKey, preference);
      }
    }
    void loadPreference();
  }, []);

  async function changeTheme(value: Theme) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    localStorage.setItem(user ? `mentalks-theme-${user.id}` : "mentalks-theme", value);
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ theme_preference: value })
      .eq("id", user.id);
    if (error) console.error("Could not save theme preference:", error.message);
  }

  return (
    <label className="theme-toggle">
      <span className="sr-only">Color theme</span>
      <select
        aria-label="Color theme"
        className="theme-select"
        value={theme}
        onChange={(event) => void changeTheme(event.target.value as Theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
