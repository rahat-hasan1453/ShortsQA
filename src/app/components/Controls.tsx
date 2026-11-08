"use client";
import { themes } from "@/data";
import { fontFamilies } from "@/engine/assetPaths";

const FAMILIES = fontFamilies(themes);

export interface Settings { themeId: string; seed: string; part: number; twist: boolean; font: string }

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function Controls({ value, onChange, disabled, hasBackground, onBackground }: {
  value: Settings; onChange: (s: Settings) => void; disabled: boolean; hasBackground: boolean; onBackground: (f: File | null) => void;
}) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  return (
    <fieldset disabled={disabled} style={{ display: "grid", gap: 10, border: "1px solid #8884", padding: 12, borderRadius: 8 }}>
      <label>Theme{" "}
        <select value={value.themeId} onChange={(e) => set({ themeId: e.target.value })}>
          <option value="random">Random</option>
          {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Seed{" "}
        <input value={value.seed} onChange={(e) => set({ seed: e.target.value })} />{" "}
        <button type="button" onClick={() => set({ seed: randomSeed() })}>New seed</button>
      </label>
      <label>Part{" "}
        <input type="number" min={1} max={99} value={value.part} onChange={(e) => set({ part: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <label>Font{" "}
        <select value={value.font} onChange={(e) => set({ font: e.target.value })}>
          <option value="theme">Theme default</option>
          {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      <label>Background image{" "}
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBackground(f); e.target.value = ""; }} />
      </label>
      {hasBackground && <button type="button" onClick={() => onBackground(null)}>Clear background</button>}
      <label><input type="checkbox" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} /> Region twist</label>
    </fieldset>
  );
}
