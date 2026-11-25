"use client";
import { FLAG_SHAPES, FLAG_SIZES, TIMER_KINDS, type Look } from "@/engine/look";

/** A row of buttons where exactly one is on. */
function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label} <small style={{ fontWeight: 400, color: "#777" }}>{hint}</small></span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}
            style={{ padding: "6px 10px", fontSize: 14, borderRadius: 8, border: o.id === value ? "2px solid #2563eb" : "1px solid #8886", background: o.id === value ? "#2563eb22" : "transparent", color: "inherit", cursor: "pointer" }}>
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
    <>
      <Choice label="Flag size" hint="how big the card is" value={value.flagSize} options={FLAG_SIZES} onChange={(flagSize) => onChange({ ...value, flagSize })} />
      <Choice label="Flag shape" hint="shape of the card" value={value.flagShape} options={FLAG_SHAPES} onChange={(flagShape) => onChange({ ...value, flagShape })} />
      <Choice label="Timer" hint="countdown style" value={value.timer} options={TIMER_KINDS} onChange={(timer) => onChange({ ...value, timer })} />
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={value.flagBorder} onChange={(e) => onChange({ ...value, flagBorder: e.target.checked })} />
        <span>Border around the flag <small style={{ color: "#777" }}>(the frame / card)</small></span>
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={value.textOutline} onChange={(e) => onChange({ ...value, textOutline: e.target.checked })} />
        <span>Text outline <small style={{ color: "#777" }}>(dark edge around the letters)</small></span>
      </label>
    </>
  );
}
