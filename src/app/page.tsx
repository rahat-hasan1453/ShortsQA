"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Controls, { randomSeed, type Settings } from "./components/Controls";
import ExportPanel from "./components/ExportPanel";
import Preview from "./components/Preview";
import { FORMATS } from "./formats";
import { detectSupport, type Support } from "@/engine/export/support";
import { loadBackground } from "@/engine/render/assets";
import { mixFor, prepare, type Prepared } from "./prepare";
import { DEFAULT_VOICE_ID, voiceById } from "@/engine/voices";
import { voiceHasClips } from "./components/VoicePicker";

export default function Page() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [support, setSupport] = useState<Support | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bg, setBg] = useState<ImageBitmap | null>(null);
  const [voiceWarning, setVoiceWarning] = useState("");
  const audioCache = useRef<{ p: Prepared; buf: Promise<AudioBuffer> } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const initial: Settings = { format: (FORMATS.find((f) => f.ready && f.id === q.get("quiz"))?.id ?? "flags") as Settings["format"], themeId: q.get("theme") ?? "random", seed: q.get("seed") ?? randomSeed(), part: Number(q.get("part")) || 1, twist: q.get("twist") === "1", font: q.get("font") ?? "theme", voice: voiceById(q.get("voice") ?? "")?.id ?? DEFAULT_VOICE_ID, answerStyle: (["open", "options", "list"].includes(q.get("style") ?? "") ? q.get("style") : "list") as Settings["answerStyle"]  };
    const wanted = q.get("voice");
    // A voice whose clips were not generated yet would fail to prepare: fall back to the default and say so.
    if (wanted && wanted !== DEFAULT_VOICE_ID) {
      voiceHasClips(initial.voice).then((ok) => {
        if (ok && initial.voice === wanted) setSettings(initial);
        else { setVoiceWarning(`Voice "${wanted}" has no clips yet; using ${voiceById(DEFAULT_VOICE_ID)!.label}.`); setSettings({ ...initial, voice: DEFAULT_VOICE_ID }); }
      });
    } else setSettings(initial);
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
  const H2: React.CSSProperties = { margin: "8px 0 0", fontSize: 18 };
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 16, display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ display: "grid", gap: 14, alignContent: "start" }}>
        <h1 style={{ margin: 0 }}>Shorts Quiz Maker</h1>
        {support && !support.ok && <p role="alert" style={{ color: "#b00020", margin: 0 }}>{support.reason}</p>}
        {error && <p role="alert" style={{ color: "#b00020", margin: 0 }}>{error}</p>}
        {voiceWarning && <p role="alert" style={{ color: "#a15c00", margin: 0 }}>{voiceWarning}</p>}
        {warnings.map((w) => <p key={w} role="alert" style={{ color: "#a15c00", margin: 0 }}>{w}</p>)}

        <h2 style={H2}>1. Choose a quiz type</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {FORMATS.map((f) => (
            <button key={f.id} type="button" disabled={!f.ready || busy} aria-pressed={f.id === settings.format}
              onClick={() => setSettings({ ...settings, format: f.id as Settings["format"] })}
              style={{ textAlign: "left", padding: 10, borderRadius: 10, border: f.id === settings.format ? "2px solid #2563eb" : "1px solid #8884", background: f.id === settings.format ? "#2563eb14" : "transparent", opacity: f.ready ? 1 : 0.55, cursor: f.ready ? "pointer" : "not-allowed" }}>
              <strong>{f.name}</strong>{!f.ready && <span style={{ fontSize: 12, marginLeft: 6 }}>Coming soon</span>}
              <div style={{ fontSize: 12, color: "#777" }}>{f.blurb}</div>
            </button>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>First answer: <strong data-testid="first-country">{prepared?.spec.questions[0].name ?? ""}</strong>{prepared && <span style={{ color: "#777" }}> · template: {prepared.theme.name}</span>}</p>

        <h2 style={H2}>2. Pick a style</h2>
        <Controls value={settings} onChange={setSettings} disabled={busy} hasBackground={!!bg} onBackground={chooseBackground} />

        <h2 style={H2}>3. Make the video</h2>
        {prepared && <div><strong>{prepared.metadata.title}</strong><div style={{ fontSize: 13, color: "#777" }}>{prepared.metadata.hashtags.join(" ")}</div></div>}
        <ExportPanel prepared={view} settings={settings} supported={support?.ok === true} busy={busy} setBusy={setBusy} background={bg ?? undefined} />
      </section>
      <Preview prepared={view} getAudio={getAudio} />
    </main>
  );
}
