"use client";
import VoicePicker from "./VoicePicker";
import Collapsible from "./Collapsible";
import TemplateGallery from "./TemplateGallery";
import FontPicker from "./FontPicker";
import LookControls from "./LookControls";
import type { FlagShape, FlagSize, Look, TimerKind } from "@/engine/look";
import type { Prepared } from "../prepare";

export interface Settings { format: "flags" | "capitals" | "math" | "missing-letters" | "real-vs-fake-flag" | "landmarks" | "what-is-it" | "country-shape"; themeId: string; seed: string; part: number; partOn: boolean; twist: boolean; font: string; answerStyle: "open" | "options" | "list"; voice: string; shape: "short" | "long"; flagSize: FlagSize; flagShape: FlagShape; timer: TimerKind; flagBorder: boolean; textOutline: boolean }

/** The look part of the settings. */
export const lookOf = (s: Settings): Look => ({ flagSize: s.flagSize, flagShape: s.flagShape, timer: s.timer, flagBorder: s.flagBorder, textOutline: s.textOutline });

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** "content" = what the quiz says (left panel); "style" = how it looks (right panel). */
export default function Controls({ section, value, onChange, disabled, hasBackground, onBackground, prepared }: {
  section: "content" | "style"; value: Settings; onChange: (s: Settings) => void; disabled: boolean; hasBackground: boolean; onBackground: (f: File | null) => void; prepared: Prepared | null;
}) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  if (section === "style") return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 20, border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      <Collapsible card title="Style">
        <TemplateGallery prepared={prepared} value={value.themeId} onChange={(themeId) => set({ themeId })} disabled={disabled} />
      </Collapsible>
      <FontPicker value={value.font} onChange={(font) => set({ font })} disabled={disabled} />
      <div className="studio-field2">
        <span className="studio-label2">Background Image <small>your own picture (optional)</small></span>
        <label className="studio-upload">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static design icon */}
          <img src="/figma/upload.svg" alt="" width={21.988} height={20.0153} />
          <span>{hasBackground ? "Replace image/ Video" : "Upload image/ Video"}</span>
          <input type="file" accept="image/*" className="studio-sr" aria-label="Background image" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBackground(f); e.target.value = ""; }} />
        </label>
        {hasBackground && <button type="button" className="studio-choice2" onClick={() => onBackground(null)}>Clear background</button>}
      </div>
      <LookControls value={lookOf(value)} onChange={(l) => set(l)} />
    </fieldset>
  );
  return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 20, border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      {value.shape === "long"
        ? <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Long videos always use A–D options.</p>
        : <div role="group" aria-label="Answer style" className="studio-section">
          <h2 className="studio-h">Answer style</h2>
          <div className="studio-answerstyles">
            {([["list", "List 1-10 (recommended)", true], ["options", "Option A-D", false], ["open", "Open (Just answer)", false]] as const).map(([id, label, big]) => (
              <button key={id} type="button" aria-pressed={value.answerStyle === id} className={`studio-choice${big ? " is-big" : ""}`} onClick={() => set({ answerStyle: id })}>{label}</button>
            ))}
          </div>
        </div>}
      <VoicePicker value={value.voice} onChange={(voice) => set({ voice })} disabled={disabled} />
    </fieldset>
  );
}
