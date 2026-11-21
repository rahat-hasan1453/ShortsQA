"use client";
import { useEffect, useRef, useState } from "react";
import { exportVideo } from "@/engine/export/encoder";
import { fileBase, metadataText, mixFor, prepare, type Prepared } from "../prepare";
import { randomSeed, type Settings } from "./Controls";

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function ExportPanel({ prepared, settings, supported, busy, setBusy, background }: {
  prepared: Prepared | null; settings: Settings; supported: boolean; busy: boolean; setBusy: (b: boolean) => void; background?: ImageBitmap;
}) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [batch, setBatch] = useState(3);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [menu]);
  const abort = useRef<AbortController | null>(null);

  async function exportOne(p: Prepared, signal: AbortSignal, label: string) {
    const audio = await mixFor(p);
    const blob = await exportVideo({ timeline: p.timeline, theme: p.theme, assets: p.assets, audio, signal, onProgress: (x) => setProgress(x) });
    download(`${fileBase(p)}.mp4`, blob);
    download(`${fileBase(p)}.txt`, new Blob([metadataText(p.metadata, p.spec)], { type: "text/plain" }));
    setMessage(`${label} done`);
  }

  async function run(job: (signal: AbortSignal) => Promise<void>) {
    const ac = new AbortController(); abort.current = ac;
    setBusy(true); setProgress(0); setMessage("Exporting…");
    try { await job(ac.signal); }
    catch (e) { setMessage(e instanceof DOMException && e.name === "AbortError" ? "Cancelled" : `Export failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); abort.current = null; }
  }

  const ready = supported && !!prepared && !busy;
  return (
    <div className="studio-export" ref={box}>
      <div role="status" className="studio-status">{message}</div>
      {busy && <progress value={progress} max={1} className="studio-progress" />}
      {busy && <button type="button" className="studio-btn" onClick={() => abort.current?.abort()}>Cancel</button>}
      <div className="studio-split">
        <button type="button" className="studio-btn studio-primary" disabled={!ready} onClick={() => run((s) => exportOne(prepared!, s, "Export"))}>Export MP4</button>
        <button type="button" className="studio-btn studio-primary studio-caret" aria-label="More export options" aria-expanded={menu} disabled={busy} onClick={() => setMenu((m) => !m)}>▾</button>
      </div>
      {menu && (
        <div className="studio-menu" role="dialog" aria-label="Export options">
          <small className="studio-muted">Ekta .mp4 video ar ekta .txt (title, description, hashtag) download hobe.</small>
          <strong style={{ fontSize: 14 }}>Make several videos at once</strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label>How many <input type="number" min={1} max={20} value={batch} onChange={(e) => setBatch(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 60 }} /></label>
            <button type="button" className="studio-btn" disabled={!supported || busy} onClick={() => { setMenu(false); run(async (signal) => {
              for (let i = 0; i < batch; i++) {
                const fresh = await prepare({ ...settings, seed: randomSeed(), part: Math.min(99, settings.part + i), themeId: "random" });
                const p = { ...fresh, assets: { ...fresh.assets, background } };
                await exportOne(p, signal, `Video ${i + 1}/${batch}`);
              }
            }); }}>Export batch</button>
          </div>
          <small className="studio-muted">Prottek video te notun seed, template ar part number. Browser multiple download er permission chaite pare.</small>
        </div>
      )}
    </div>
  );
}
