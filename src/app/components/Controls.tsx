"use client";
import VoicePicker from "./VoicePicker";
import TemplateGallery from "./TemplateGallery";
import FontPicker from "./FontPicker";
import LookControls from "./LookControls";
import type { FlagShape, FlagSize, TimerKind } from "@/engine/look";
import type { Prepared } from "../prepare";

export interface Settings { format: "flags" | "capitals" | "math" | "missing-letters" | "real-vs-fake-flag" | "landmarks" | "what-is-it" | "country-shape"; themeId: string; seed: string; part: number; twist: boolean; font: string; answerStyle: "open" | "options" | "list"; voice: string; shape: "short" | "long"; flagSize: FlagSize; flagShape: FlagShape; timer: TimerKind }

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** "content" = what the quiz says (left panel); "style" = how it looks (right panel). */
export default function Controls({ section, value, onChange, disabled, hasBackground, onBackground, prepared }: {
  section: "content" | "style"; value: Settings; onChange: (s: Settings) => void; disabled: boolean; hasBackground: boolean; onBackground: (f: File | null) => void; prepared: Prepared | null;
}) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  if (section === "style") return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 16, border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      <TemplateGallery prepared={prepared} value={value.themeId} onChange={(themeId) => set({ themeId })} disabled={disabled} />
      <FontPicker value={value.font} onChange={(font) => set({ font })} disabled={disabled} />
      <LookControls value={{ flagSize: value.flagSize, flagShape: value.flagShape, timer: value.timer }} onChange={(l) => set(l)} />
      <label style={LABEL}>Background image <small style={HINT}>nijer pochonder chobi (optional)</small>
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBackground(f); e.target.value = ""; }} />
      </label>
      {hasBackground && <button type="button" onClick={() => onBackground(null)}>Clear background</button>}
    </fieldset>
  );
  return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 16, border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      {value.shape === "long"
        ? <p style={{ margin: 0, fontSize: 13, color: "#888" }}>Long videos always use A–D options.</p>
        : <label style={LABEL}>Answer style <small style={HINT}>viewer kibhabe uttor dekhbe</small>
          <select value={value.answerStyle} onChange={(e) => set({ answerStyle: e.target.value as Settings["answerStyle"] })} style={FIELD}>
            <option value="list">List 1-10 (recommended)</option>
            <option value="options">Options A-D</option>
            <option value="open">Open (just the name)</option>
          </select>
        </label>}
      <VoicePicker value={value.voice} onChange={(voice) => set({ voice })} disabled={disabled} />
      <details style={{ borderTop: "1px solid #8883", paddingTop: 8 }}>
        <summary style={{ cursor: "pointer" }}>Advanced</summary>
        <div style={{ display: "grid", gap: 10, paddingTop: 10 }}>
          <label style={LABEL}>Seed <small style={HINT}>ekoi seed = ekoi quiz</small>
            <span><input value={value.seed} onChange={(e) => set({ seed: e.target.value })} style={FIELD} />{" "}
              <button type="button" onClick={() => set({ seed: randomSeed() })}>New seed</button></span>
          </label>
          <label style={LABEL}>Part number <small style={HINT}>series er number, title e boshe</small>
            <input type="number" min={1} max={99} value={value.part} style={FIELD} onChange={(e) => set({ part: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
          </label>
          <label><input type="checkbox" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} /> Region twist <small style={HINT}>ekoi mahadesh er flag</small></label>
        </div>
      </details>
    </fieldset>
  );
}

const LABEL: React.CSSProperties = { display: "grid", gap: 4, fontWeight: 600 };
const FIELD: React.CSSProperties = { padding: "6px 8px", fontSize: 15 };
const HINT: React.CSSProperties = { fontWeight: 400, color: "#777" };
