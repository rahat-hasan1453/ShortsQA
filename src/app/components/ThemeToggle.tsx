"use client";
import { useEffect, useState } from "react";

type Mode = "light" | "dark";
const KEY = "sqa-theme";

/** The mode in effect now: the saved choice on <html data-theme>, else the system setting. */
function currentMode(): Mode {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => { setMode(currentMode()); }, []); // eslint-disable-line react-hooks/set-state-in-effect -- reads the DOM after hydration
  if (!mode) return <span className="studio-btn studio-icon" aria-hidden />;
  const next: Mode = mode === "dark" ? "light" : "dark";
  return (
    <button type="button" className="studio-btn studio-icon" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice lasts for this page only */ }
        setMode(next);
      }}>{mode === "dark" ? "☀" : "☾"}</button>
  );
}
