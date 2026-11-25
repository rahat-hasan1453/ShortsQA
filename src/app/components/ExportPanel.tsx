"use client";
import { useEffect, useRef, useState } from "react";
import { exportVideo } from "@/engine/export/encoder";
import { drawFrame } from "@/engine/render";
import { frameSize } from "@/engine/render/layout";
import { fileBase, metadataText, mixFor, prepare, renderId, type Prepared } from "../prepare";
import { randomSeed, type Settings } from "./Controls";
import { canPickFolder, commitDownloadSerial, nextDownloadSerial, nextSerial, pad, pickFolder, rememberedFolder, writeFile } from "../exportFolder";

function download(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const post = async (url: string, body?: BodyInit, size?: number) => {
  const r = await fetch(url, { method: "POST", body, ...(size !== undefined ? { headers: { "x-chunk-length": String(size) } } : {}) });
  if (!r.ok) throw new Error(`saving the video failed (${r.status})`);
};

/** Long videos: the MP4 streams to output/<id>.mp4 on this machine (too big to hold in memory), with a 1280x720 thumbnail beside it. */
async function exportLong(p: Prepared, audio: AudioBuffer, signal: AbortSignal, onProgress: (x: number) => void): Promise<string> {
  const id = renderId(p), base = `/api/render/${id}`;
  let started: Promise<void> = Promise.resolve();
  await exportVideo({
    timeline: p.timeline, theme: p.theme, assets: p.assets, audio, signal, onProgress,
    // The first chunk of an attempt clears any old file; every other chunk waits for it so the reset never lands late.
    sink: (data, pos, fresh) => {
      if (fresh) return (started = post(`${base}?pos=${pos}&reset=1`, data as BodyInit, data.length));
      return started.then(() => post(`${base}?pos=${pos}`, data as BodyInit, data.length));
    },
  });
  const { w, h } = frameSize("long"), big = new OffscreenCanvas(w, h), thumb = new OffscreenCanvas(1280, 720);
  drawFrame(big.getContext("2d")!, p, Math.min(1.2, p.timeline.duration / 2));
  thumb.getContext("2d")!.drawImage(big, 0, 0, 1280, 720);
  await post(`${base}?thumb=1`, await thumb.convertToBlob({ type: "image/jpeg", quality: 0.9 }));
  await post(`${base}?done=1`);
  return base;
}

export default function ExportPanel({ prepared, settings, supported, busy, setBusy, background }: {
  prepared: Prepared | null; settings: Settings; supported: boolean; busy: boolean; setBusy: (b: boolean) => void; background?: ImageBitmap;
}) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [count, setCount] = useState(1);
  const [dialog, setDialog] = useState(false);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [nextNo, setNextNo] = useState(1);
  const abort = useRef<AbortController | null>(null);
  const folderMode = canPickFolder();

  useEffect(() => { // when the dialog opens: the remembered folder (if still allowed) and the next serial in it
    if (!dialog) return;
    let live = true;
    (async () => {
      const h = folderMode ? await rememberedFolder(false) : null;
      const n = h ? await nextSerial(h) : nextDownloadSerial();
      if (live) { setFolder(h); setNextNo(n); }
    })();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDialog(false); };
    document.addEventListener("keydown", onKey);
    return () => { live = false; document.removeEventListener("keydown", onKey); };
  }, [dialog, folderMode]);

  const changeFolder = async () => {
    try { const h = await pickFolder(); setFolder(h); setNextNo(await nextSerial(h)); } catch { /* cancelled */ }
  };

  /** One video: <folder>/<serial>/video.mp4 + details.txt, or two plain downloads named by serial when no folder is available. */
  async function exportOne(p: Prepared, signal: AbortSignal, dir: FileSystemDirectoryHandle | null, serial: number, label: string) {
    const audio = await mixFor(p);
    const no = pad(serial), txt = new Blob([metadataText(p.metadata, p.spec)], { type: "text/plain" });
    const long = p.spec.profile === "long";
    let longUrl = "";
    let blob: Blob | null = null;
    if (long) longUrl = await exportLong(p, audio, signal, (x) => setProgress(x));
    else blob = await exportVideo({ timeline: p.timeline, theme: p.theme, assets: p.assets, audio, signal, onProgress: (x) => setProgress(x) });
    if (dir) {
      const sub = await dir.getDirectoryHandle(no, { create: true });
      if (long) { const r = await fetch(longUrl); if (!r.ok || !r.body) throw new Error("could not read the finished video"); await writeFile(sub, "video.mp4", r.body); }
      else await writeFile(sub, "video.mp4", blob!);
      await writeFile(sub, "details.txt", txt);
      setMessage(`${label} saved to ${dir.name}/${no}`);
    } else {
      if (long) { const a = document.createElement("a"); a.href = longUrl; a.download = `${no}.mp4`; document.body.appendChild(a); a.click(); a.remove(); }
      else download(`${no}.mp4`, blob!);
      download(`${no}.txt`, txt);
      commitDownloadSerial(serial);
      setMessage(`${label} downloaded as ${no}`);
    }
  }

  async function confirmExport() {
    let dir = folder;
    if (folderMode && !dir) { // first time: ask for the folder inside this click
      try { dir = (await rememberedFolder(true)) ?? (await pickFolder()); } catch { return; } // cancelled: stay in the dialog
    }
    setDialog(false);
    const start = dir ? await nextSerial(dir) : nextDownloadSerial();
    const ac = new AbortController(); abort.current = ac;
    setBusy(true); setProgress(0); setMessage("Exporting…");
    try {
      for (let i = 0; i < count; i++) {
        let p = prepared!;
        if (count > 1) { // a batch: each video gets a new seed, template and part number
          const fresh = await prepare({ ...settings, seed: randomSeed(), part: Math.min(99, settings.part + i), themeId: "random" });
          p = { ...fresh, assets: { ...fresh.assets, background } };
        }
        await exportOne(p, ac.signal, dir, start + i, count > 1 ? `Video ${i + 1}/${count}` : "Video");
      }
    } catch (e) { setMessage(e instanceof DOMException && e.name === "AbortError" ? "Cancelled" : `Export failed: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(false); abort.current = null; }
  }

  const ready = supported && !!prepared && !busy;
  const first = pad(nextNo), last = pad(nextNo + count - 1);
  return (
    <div className="studio-export">
      <div role="status" className="studio-status">{message}</div>
      {busy && <progress value={progress} max={1} className="studio-progress" />}
      {busy && <button type="button" className="studio-btn" onClick={() => abort.current?.abort()}>Cancel</button>}
      <div className="studio-split">
        <button type="button" className="studio-btn studio-primary" disabled={!ready} onClick={() => setDialog(true)}>Export MP4</button>
        <button type="button" className="studio-btn studio-primary studio-caret" aria-label="More export options" disabled={!ready} onClick={() => setDialog(true)}>▾</button>
      </div>
      {dialog && (
        <div className="studio-modalback" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(false); }}>
          <div className="studio-modal" role="dialog" aria-modal="true" aria-label="Export video">
            <h2>Export video</h2>
            <p className="studio-muted">{count === 1 ? "Your video is saved in its own numbered folder:" : `${count} videos are saved, each in its own numbered folder:`}</p>
            <pre className="studio-tree">{`${folderMode ? (folder?.name ?? "your folder") + "/" : ""}${count === 1 ? first : `${first} … ${last}`}${folderMode ? "/" : ""}\n  video.mp4\n  details.txt  (title, description, hashtags)`}</pre>
            {folderMode
              ? <p className="studio-muted">{folder ? <>Saving into <strong>{folder.name}</strong>. <button type="button" className="studio-link" onClick={changeFolder}>Change folder</button></> : "You will be asked to choose a folder once; it is remembered."}</p>
              : <p className="studio-muted">This browser cannot save into a folder, so the two files are downloaded as {first}.mp4 and {first}.txt.</p>}
            <label className="studio-howmany">How many videos <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} /></label>
            {count > 1 && <p className="studio-muted">Each video gets a new seed, template and part number.</p>}
            <div className="studio-modalbtns">
              <button type="button" className="studio-btn" onClick={() => setDialog(false)}>Cancel</button>
              <button type="button" className="studio-btn studio-primary" onClick={confirmExport}>{count === 1 ? "Export" : `Export ${count} videos`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
