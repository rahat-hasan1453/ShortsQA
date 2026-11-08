"use client";
import { useRef, useState } from "react";
import { exportVideo } from "@/engine/export/encoder";
import { fileBase, metadataText, mixFor, prepare, type Prepared } from "../prepare";
import { randomSeed, type Settings } from "./Controls";

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function ExportPanel({ prepared, settings, supported, busy, setBusy }: {
  prepared: Prepared | null; settings: Settings; supported: boolean; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [batch, setBatch] = useState(3);
  const abort = useRef<AbortController | null>(null);

  async function exportOne(p: Prepared, signal: AbortSignal, label: string) {
    const audio = await mixFor(p);
    const blob = await exportVideo({ timeline: p.timeline, theme: p.theme, assets: p.assets, audio, signal, onProgress: (x) => setProgress(x) });
    download(`${fileBase(p)}.mp4`, blob);
    download(`${fileBase(p)}.txt`, new Blob([metadataText(p.metadata)], { type: "text/plain" }));
    setMessage(`${label} done`);
  }

  async function run(job: (signal: AbortSignal) => Promise<void>) {
    const ac = new AbortController(); abort.current = ac;
    setBusy(true); setProgress(0); setMessage("Exporting…");
    try { await job(ac.signal); }
    catch (e) { setMessage(e instanceof DOMException && e.name === "AbortError" ? "Cancelled" : `Export failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); abort.current = null; }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!supported || !prepared || busy} onClick={() => run((s) => exportOne(prepared!, s, "Export"))}>Export MP4</button>
        {busy && <button type="button" onClick={() => abort.current?.abort()}>Cancel</button>}
      </div>
      {busy && <progress value={progress} max={1} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label>Batch count <input type="number" min={1} max={20} value={batch} onChange={(e) => setBatch(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 60 }} /></label>
        <button type="button" disabled={!supported || busy} onClick={() => run(async (signal) => {
          for (let i = 0; i < batch; i++) {
            const p = await prepare({ ...settings, seed: randomSeed(), part: Math.min(99, settings.part + i), themeId: "random" });
            await exportOne(p, signal, `Video ${i + 1}/${batch}`);
          }
        })}>Export batch</button>
      </div>
      <small>Batch exports download several files; allow multiple downloads if your browser asks.</small>
      <div role="status">{message}</div>
    </div>
  );
}
