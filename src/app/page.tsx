"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Controls, { randomSeed, type Settings } from "./components/Controls";
import ExportPanel from "./components/ExportPanel";
import ThemeToggle from "./components/ThemeToggle";
import ShapeSwitch from "./components/ShapeSwitch";
import Preview from "./components/Preview";
import { FORMATS } from "./formats";
import { detectSupport, type Support } from "@/engine/export/support";
import { loadBackground } from "@/engine/render/assets";
import { mixFor, prepare, type Prepared } from "./prepare";
import { DEFAULT_VOICE_ID, voiceById } from "@/engine/voices";
import { cleanLook } from "@/engine/look";
import { voiceHasClips } from "./components/VoicePicker";

const PREFS_KEY = "shortsqa:style-prefs";

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
    let saved: Record<string, string> = {}; // the look you chose last time (template, font, answer style, flag size / shape, timer); the address wins when it names one
    try { saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); } catch { /* unreadable: use the defaults */ }
    const style = q.get("style") ?? saved.answerStyle ?? "";
    const initial: Settings = { format: (FORMATS.find((f) => f.ready && f.id === q.get("quiz"))?.id ?? "flags") as Settings["format"], themeId: q.get("theme") ?? saved.themeId ?? "random", seed: q.get("seed") ?? randomSeed(), part: Number(q.get("part")) || 1, twist: q.get("twist") === "1", font: q.get("font") ?? saved.font ?? "theme", voice: voiceById(q.get("voice") ?? "")?.id ?? DEFAULT_VOICE_ID, shape: q.get("shape") === "long" ? "long" : "short", answerStyle: (["open", "options", "list"].includes(style) ? style : "list") as Settings["answerStyle"], ...cleanLook({ flagSize: q.get("flag") ?? saved.flagSize, flagShape: q.get("flagshape") ?? saved.flagShape, timer: q.get("timer") ?? saved.timer }) };
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

  useEffect(() => { // remember the look for next time
    if (!settings) return;
    const { themeId, font, answerStyle, flagSize, flagShape, timer } = settings;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ themeId, font, answerStyle, flagSize, flagShape, timer })); } catch { /* storage full or blocked: nothing to remember */ }
  }, [settings]);

  useEffect(() => { // keep ?shape= in the address so a reload (or a shared link) opens the same shape
    if (!settings) return;
    const u = new URL(window.location.href);
    if (settings.shape === "long") u.searchParams.set("shape", "long"); else u.searchParams.delete("shape");
    if (u.href !== window.location.href) window.history.replaceState(null, "", u);
  }, [settings]);

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
  const alerts = [
    ...(support && !support.ok ? [{ text: support.reason, bad: true }] : []),
    ...(error ? [{ text: error, bad: true }] : []),
    ...(voiceWarning ? [{ text: voiceWarning, bad: false }] : []),
    ...warnings.map((w) => ({ text: w, bad: false })),
  ];
  return (
    <div className="studio">
      <header className="studio-top">
        <div className="studio-brand"><span className="studio-logo" aria-hidden>Q</span><strong>Shorts Quiz Studio</strong></div>
        <div className="studio-title" title={prepared?.metadata.title}>{prepared?.metadata.title ?? "Preparing…"}</div>
        <ThemeToggle />
        <ExportPanel prepared={view} settings={settings} supported={support?.ok === true} busy={busy} setBusy={setBusy} background={bg ?? undefined} />
      </header>

      <aside className="studio-panel studio-left" aria-label="Quiz settings">
        <h2 className="studio-h">Quiz</h2>
        <div role="group" aria-label="Quiz type" className="studio-formats">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" disabled={!f.ready || busy} aria-pressed={f.id === settings.format} className="studio-card"
              onClick={() => setSettings({ ...settings, format: f.id as Settings["format"] })}>
              <strong>{f.name}</strong>{!f.ready && <span style={{ fontSize: 12, marginLeft: 6 }}>Coming soon</span>}
              <span className="studio-muted">{f.blurb}</span>
            </button>
          ))}
        </div>
        <Controls section="content" value={settings} onChange={setSettings} disabled={busy} hasBackground={!!bg} onBackground={chooseBackground} prepared={prepared} />
      </aside>

      <main className="studio-stage">
        {alerts.length > 0 && <div className="studio-alerts">{alerts.map((a) => <p key={a.text} role="alert" style={{ color: a.bad ? "#e5484d" : "#d68a00", margin: 0 }}>{a.text}</p>)}</div>}
        <ShapeSwitch value={settings.shape} disabled={busy} onChange={(shape) => setSettings({ ...settings, shape })} />
        <Preview prepared={view} getAudio={getAudio} />
        <p className="studio-meta">First answer: <strong data-testid="first-country">{prepared?.spec.questions[0].name ?? ""}</strong>{prepared && <span className="studio-muted"> · template: {prepared.theme.name}</span>}</p>
        {prepared && <p className="studio-meta studio-muted">{prepared.metadata.hashtags.join(" ")}</p>}
      </main>

      <aside className="studio-panel studio-right" aria-label="Style settings">
        <h2 className="studio-h">Style</h2>
        <Controls section="style" value={settings} onChange={setSettings} disabled={busy} hasBackground={!!bg} onBackground={chooseBackground} prepared={prepared} />
      </aside>
    </div>
  );
}
