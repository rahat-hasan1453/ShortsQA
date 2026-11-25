"use client";
import { useId, useState } from "react";

/** A panel section with an uppercase heading and a triangle that folds it away (the editor design's QUIZ / VOICE / STYLE sections). */
export default function Collapsible({ title, hint, defaultOpen = true, children }: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="studio-section">
      <button type="button" className="studio-sectionhead" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="studio-h">{title}{hint && <span className="studio-hint"> {hint}</span>}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true" style={{ transform: open ? "none" : "rotate(180deg)", flex: "none" }}><path d="M0 8 6 0l6 8z" fill="currentColor" /></svg>
      </button>
      <div id={id} hidden={!open} className="studio-sectionbody">{children}</div>
    </section>
  );
}
