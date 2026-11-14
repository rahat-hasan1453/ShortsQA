"use client";
import { themes } from "@/data";
import { fontFamilies } from "@/engine/assetPaths";

const FAMILIES = fontFamilies(themes);

export interface Settings { format: "flags" | "capitals" | "math" | "missing-letters" | "real-vs-fake-flag"; themeId: string; seed: string; part: number; twist: boolean; font: string; answerStyle: "open" | "options" | "list" }

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function Controls({ value, onChange, disabled, hasBackground, onBackground }: {
  value: Settings; onChange: (s: Settings) => void; disabled: boolean; hasBackground: boolean; onBackground: (f: File | null) => void;
}) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 12, border: "none", padding: 0, margin: 0 }}>
      <label style={LABEL}>Answer style <small style={HINT}>viewer kibhabe uttor dekhbe</small>
        <select value={value.answerStyle} onChange={(e) => set({ answerStyle: e.target.value as Settings["answerStyle"] })} style={FIELD}>
          <option value="list">List 1-10 (recommended)</option>
          <option value="options">Options A-D</option>
          <option value="open">Open (just the name)</option>
        </select>
      </label>
      <label style={LABEL}>Template <small style={HINT}>rong, background ar timer er dhoron</small>
        <select value={value.themeId} onChange={(e) => set({ themeId: e.target.value })} style={FIELD}>
          <option value="random">Random (recommended)</option>
          {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label style={LABEL}>Font <small style={HINT}>shob text er font</small>
        <select value={value.font} onChange={(e) => set({ font: e.target.value })} style={FIELD}>
          <option value="theme">Template default</option>
          {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <label style={LABEL}>Background image <small style={HINT}>nijer pochonder chobi (optional)</small>
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBackground(f); e.target.value = ""; }} />
      </label>
      {hasBackground && <button type="button" onClick={() => onBackground(null)}>Clear background</button>}
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
