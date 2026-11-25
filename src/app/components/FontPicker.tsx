"use client";
import { useEffect, useRef, useState } from "react";
import { fontStack } from "@/engine/theme";
import { ensureFont } from "@/engine/render/assets";
import { FONT_GROUP, FONT_GROUPS, fontMatches } from "../fonts";

const FAMILIES = Object.keys(FONT_GROUP).sort();
const SAMPLE = "Which planet is known as the Red Planet?";

/** A font row that loads its own face when it scrolls into view. */
function Row({ family, selected, onPick, onHover }: { family: string; selected: boolean; onPick: () => void; onHover: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { ensureFont(family); io.disconnect(); } });
    io.observe(el);
    return () => io.disconnect();
  }, [family]);
  return (
    <li ref={ref} role="option" aria-selected={selected} onClick={onPick} onMouseEnter={onHover}
      style={{ listStyle: "none", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: fontStack(family), fontSize: 18, background: selected ? "#2563eb22" : "transparent" }}>
      {family}
    </li>
  );
}

export default function FontPicker({ value, onChange, disabled }: { value: string; onChange: (family: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const current = value === "theme" ? null : value;

  useEffect(() => { if (current) ensureFont(current); }, [current]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const pick = (f: string) => { onChange(f); setOpen(false); setQuery(""); setHover(null); };
  const preview = hover ?? current;
  const matches = FAMILIES.filter((f) => fontMatches(f, query));

  return (
    <div ref={root} style={{ position: "relative", display: "grid", gap: 4 }}>
      <span style={{ fontWeight: 600 }}>Font <small style={{ fontWeight: 400, color: "#777" }}>font for all text</small></span>
      <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        style={{ textAlign: "left", padding: "8px 10px", fontSize: 16, borderRadius: 8, border: "1px solid #8886", background: "transparent", color: "inherit", cursor: "pointer" }}>
        Font: <span style={{ fontFamily: current ? fontStack(current) : "inherit" }}>{current ?? "Template default"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, padding: 8, borderRadius: 12, border: "1px solid #8886", background: "Canvas", color: "CanvasText", boxShadow: "0 12px 32px #0004", display: "grid", gap: 8 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#8881", fontFamily: preview ? fontStack(preview) : "inherit", fontSize: 20, lineHeight: 1.25 }}>{SAMPLE}</div>
          <input autoFocus aria-label="Search fonts" placeholder="Search fonts or a style (serif, hand…)" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ padding: "8px 10px", fontSize: 15, borderRadius: 8, border: "1px solid #8886" }} />
          <ul role="listbox" aria-label="Fonts" style={{ margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" }}>
            {!query.trim() && <li role="option" aria-selected={!current} onClick={() => pick("theme")} onMouseEnter={() => setHover(null)}
              style={{ listStyle: "none", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontWeight: 600, background: !current ? "#2563eb22" : "transparent" }}>Template default</li>}
            {FONT_GROUPS.map((g) => {
              const fams = matches.filter((f) => FONT_GROUP[f] === g);
              if (!fams.length) return null;
              return (
                <li key={g} style={{ listStyle: "none" }}>
                  <ul role="group" aria-label={g} style={{ margin: 0, padding: 0 }}>
                    <li aria-hidden style={{ listStyle: "none", padding: "8px 10px 2px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#888" }}>{g}</li>
                    {fams.map((f) => <Row key={f} family={f} selected={f === current} onPick={() => pick(f)} onHover={() => setHover(f)} />)}
                  </ul>
                </li>
              );
            })}
            {!matches.length && <li style={{ listStyle: "none", padding: 10, color: "#888" }}>No font matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
