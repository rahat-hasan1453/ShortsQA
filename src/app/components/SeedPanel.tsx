"use client";
import { randomSeed, type Settings } from "./Controls";

/** Seed, part number and region twist (the "Seed" card). The round button rolls a new seed, which is a new quiz. */
export default function SeedPanel({ value, onChange, disabled, firstAnswer }: { value: Settings; onChange: (s: Settings) => void; disabled: boolean; firstAnswer: string }) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  return (
    <fieldset className="studio-card2" disabled={disabled} aria-label="Quiz variation">
      <h2 className="studio-h">Seed</h2>
      <div className="studio-seedbox">
        <div className="studio-seedtext">
          <input value={value.seed} onChange={(e) => set({ seed: e.target.value })} aria-label="Seed (same seed = same quiz)" />
          <span className="studio-first">First answer: <strong data-testid="first-country">{firstAnswer}</strong></span>
        </div>
        <button type="button" className="studio-round" aria-label="New seed" title="New seed (a new quiz)" onClick={() => set({ seed: randomSeed() })}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" />
          </svg>
        </button>
      </div>
      <label className="studio-field">
        <span className="studio-label">Part number <small>(series number, shown in the title)</small></span>
        <input type="number" min={1} max={99} value={value.part} aria-label="Part number" onChange={(e) => set({ part: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <label className="studio-check">
        <input type="checkbox" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} />
        <span>Region twist <small>(all flags from one continent)</small></span>
      </label>
    </fieldset>
  );
}
