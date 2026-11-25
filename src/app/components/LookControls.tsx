"use client";
import { FLAG_SHAPES, FLAG_SIZES, TIMER_KINDS, type Look } from "@/engine/look";

/** A row of buttons where exactly one is on. */
function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="studio-field2">
      <span className="studio-label2">{label} <small>{hint}</small></span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}
            className="studio-choice2" style={{ border: o.id === value ? "2px solid #2563eb" : undefined, background: o.id === value ? "rgba(37,99,235,0.13)" : undefined }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Flag size, flag shape and timer: shown in the Style panel; preview and export use the same values. */
export default function LookControls({ value, onChange }: { value: Look; onChange: (l: Look) => void }) {
  return (
    <div className="studio-lookgroup">
      <Choice label="Flag size" hint="how big the card is" value={value.flagSize} options={FLAG_SIZES} onChange={(flagSize) => onChange({ ...value, flagSize })} />
      <Choice label="Flag shape" hint="shape of the card" value={value.flagShape} options={FLAG_SHAPES} onChange={(flagShape) => onChange({ ...value, flagShape })} />
      <Choice label="Timer" hint="countdown style" value={value.timer} options={TIMER_KINDS} onChange={(timer) => onChange({ ...value, timer })} />
      <label className="studio-check2">
        <input type="checkbox" className="studio-cb" checked={value.flagBorder} onChange={(e) => onChange({ ...value, flagBorder: e.target.checked })} />
        <span>Border around the flag <small>(the frame / card)</small></span>
      </label>
      <label className="studio-check2">
        <input type="checkbox" className="studio-cb" checked={value.textOutline} onChange={(e) => onChange({ ...value, textOutline: e.target.checked })} />
        <span>Text outline <small>(dark edge around the letters)</small></span>
      </label>
    </div>
  );
}
