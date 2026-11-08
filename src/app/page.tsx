"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Controls, { randomSeed, type Settings } from "./components/Controls";
import ExportPanel from "./components/ExportPanel";
import Preview from "./components/Preview";
import { detectSupport, type Support } from "@/engine/export/support";
import { loadBackground } from "@/engine/render/assets";
import { mixFor, prepare, type Prepared } from "./prepare";

export default function Page() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [support, setSupport] = useState<Support | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bg, setBg] = useState<ImageBitmap | null>(null);
  const audioCache = useRef<{ p: Prepared; buf: Promise<AudioBuffer> } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSettings({ themeId: q.get("theme") ?? "random", seed: q.get("seed") ?? randomSeed(), part: Number(q.get("part")) || 1, twist: q.get("twist") === "1", font: q.get("font") ?? "theme" });
    detectSupport().then(setSupport);
  }, []);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    setPrepared(null); setError("");
    prepare(settings).then((p) => { if (!cancelled) setPrepared(p); }).catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, [settings]);

  const chooseBackground = async (f: File | null) => {
    try { setBg(f ? await loadBackground(f) : null); setError(""); }
    catch { setError("That image could not be read. Try a JPG or PNG."); }
  };
  const view = useMemo(() => (prepared ? { ...prepared, assets: { ...prepared.assets, background: bg ?? undefined } } : null), [prepared, bg]);

  const getAudio = () => {
    if (!prepared) return Promise.reject(new Error("not ready"));
    if (audioCache.current?.p !== prepared) audioCache.current = { p: prepared, buf: mixFor(prepared) };
    return audioCache.current.buf;
  };

  if (!settings) return null;
  const warnings = prepared?.assets.warnings ?? [];
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <h1 style={{ margin: 0 }}>Shorts Quiz Generator</h1>
        <p style={{ margin: 0 }}>10 Flags Rapid. First flag: <strong data-testid="first-country">{prepared?.spec.questions[0].name ?? ""}</strong></p>
        {support && !support.ok && <p role="alert" style={{ color: "#b00020" }}>{support.reason}</p>}
        {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
        {warnings.map((w) => <p key={w} role="alert" style={{ color: "#a15c00" }}>{w}</p>)}
        <Controls value={settings} onChange={setSettings} disabled={busy} hasBackground={!!bg} onBackground={chooseBackground} />
        {prepared && <div><strong>{prepared.metadata.title}</strong><div style={{ fontSize: 13 }}>{prepared.metadata.hashtags.join(" ")}</div></div>}
        <ExportPanel prepared={view} settings={settings} supported={support?.ok === true} busy={busy} setBusy={setBusy} background={bg ?? undefined} />
      </section>
      <Preview prepared={view} getAudio={getAudio} />
    </main>
  );
}
