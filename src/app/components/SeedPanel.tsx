"use client";
import { randomSeed, type Settings } from "./Controls";

/** Seed, part number and region twist, always visible under the preview. The round button rolls a new seed (a new quiz). */
export default function SeedPanel({ value, onChange, disabled }: { value: Settings; onChange: (s: Settings) => void; disabled: boolean }) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  return (
    <fieldset className="studio-seedbar" disabled={disabled} aria-label="Quiz variation">
      <label className="studio-seedfield">
        <span className="studio-muted">Seed</span>
        <span className="studio-seedrow">
          <input value={value.seed} onChange={(e) => set({ seed: e.target.value })} />
          <button type="button" className="studio-round" aria-label="New seed" title="New seed (a new quiz)" onClick={() => set({ seed: randomSeed() })}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
            </svg>
          </button>
        </span>
      </label>
      <label className="studio-seedfield">
        <span className="studio-muted">Part number <small>(series number, shown in the title)</small></span>
        <input type="number" min={1} max={99} value={value.part} onChange={(e) => set({ part: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <label className="studio-seedcheck">
        <input type="checkbox" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} />
        <span>Region twist <small className="studio-muted">(all flags from one continent)</small></span>
      </label>
    </fieldset>
  );
}
