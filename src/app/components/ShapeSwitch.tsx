"use client";

/** Video shape above the preview. Only vertical Shorts render today; long 16:9 videos are phase 3 of the design. */
export default function ShapeSwitch() {
  const opt = (label: string, ratio: string, w: number, h: number, on: boolean, ready: boolean) => (
    <button type="button" role="radio" aria-checked={on} aria-disabled={!ready} tabIndex={on ? 0 : -1}
      title={ready ? undefined : "Long videos (6–8 min, 1920×1080) come in the next phase"}
      className={`studio-shape${on ? " is-on" : ""}`} onClick={(e) => { if (!ready) e.preventDefault(); }}>
      <span aria-hidden className="studio-shape-icon" style={{ width: w, height: h }} />
      <span>{label}</span>
      <span className="studio-muted">{ratio}</span>
      {!ready && <span className="studio-badge">Soon</span>}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Video shape" className="studio-shapes">
      {opt("Shorts", "9:16", 10, 16, true, true)}
      {opt("Long", "16:9", 18, 10, false, false)}
    </div>
  );
}
