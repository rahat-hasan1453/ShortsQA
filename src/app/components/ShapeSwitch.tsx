"use client";

type Shape = "short" | "long";

/** Video shape above the preview: vertical Shorts (9:16) or a horizontal long video (16:9). */
export default function ShapeSwitch({ value, onChange, disabled }: { value: Shape; onChange: (s: Shape) => void; disabled: boolean }) {
  const opt = (shape: Shape, label: string, ratio: string, w: number, h: number) => {
    const on = value === shape;
    return (
      <button type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled}
        className={`studio-shape${on ? " is-on" : ""}`} onClick={() => { if (!on) onChange(shape); }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") onChange(shape === "short" ? "long" : "short"); }}>
        <span aria-hidden className="studio-shape-icon" style={{ width: w, height: h }} />
        <span>{label}</span>
        <span className="studio-muted">{ratio}</span>
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label="Video shape" className="studio-shapes">
      {opt("short", "Shorts", "9:16", 10, 16)}
      {opt("long", "Long", "16:9", 18, 10)}
    </div>
  );
}
