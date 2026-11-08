"use client";
import { themes } from "@/data";

export interface Settings { themeId: string; seed: string; part: number; twist: boolean }

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function Controls({ value, onChange, disabled }: { value: Settings; onChange: (s: Settings) => void; disabled: boolean }) {
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
      <label><input type="checkbox" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} /> Region twist</label>
    </fieldset>
  );
}
