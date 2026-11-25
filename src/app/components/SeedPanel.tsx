"use client";
import { randomSeed, type Settings } from "./Controls";

/** Seed, part number and region twist (the "Seed" card). The round button rolls a new seed, which is a new quiz. */
export default function SeedPanel({ value, onChange, disabled, firstAnswer }: { value: Settings; onChange: (s: Settings) => void; disabled: boolean; firstAnswer: string }) {
  const set = (p: Partial<Settings>) => onChange({ ...value, ...p });
  return (
    <fieldset className="studio-card2" disabled={disabled} aria-label="Quiz variation">
      <div className="studio-seedgroup">
      <h2 className="studio-h studio-h14">Seed</h2>
      <div className="studio-seedbox">
        <div className="studio-seedtext">
          <input value={value.seed} onChange={(e) => set({ seed: e.target.value })} aria-label="Seed (same seed = same quiz)" />
          <span className="studio-first">First answer: <strong data-testid="first-country">{firstAnswer}</strong></span>
        </div>
        <button type="button" className="studio-round" aria-label="New seed" title="New seed (a new quiz)" onClick={() => set({ seed: randomSeed() })}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a static design icon */}
          <img src="/figma/refresh.svg" alt="" width={12} height={12} />
        </button>
      </div>
      </div>
      <label className="studio-field">
        <span className="studio-label"><b>Part number</b> <small>(series number, shown in the title)</small></span>
        <span className={`studio-select studio-partbox${value.partOn ? "" : " is-off"}`}>
          <button type="button" role="switch" aria-checked={value.partOn} aria-label="Use a part number" className="studio-switch" onClick={() => set({ partOn: !value.partOn })}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static design icon */}
            <img src="/figma/toggle.svg" alt="" width={34} height={20} />
          </button>
          <input type="number" min={1} max={99} disabled={!value.partOn} value={value.part} aria-label="Part number" onChange={(e) => set({ part: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} />
          {/* eslint-disable-next-line @next/next/no-img-element -- a static design icon */}
          <img src="/figma/chevron.svg" alt="" width={24} height={24} style={{ transform: "rotate(180deg)" }} />
        </span>
      </label>
      <label className="studio-check">
        <input type="checkbox" className="studio-cb" checked={value.twist} onChange={(e) => set({ twist: e.target.checked })} />
        <span><b>Region twist</b> <small>(all flags from one continent)</small></span>
      </label>
    </fieldset>
  );
}
