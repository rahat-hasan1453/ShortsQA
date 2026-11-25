"use client";
import Collapsible from "./Collapsible";
import { useEffect, useRef, useState } from "react";
import { audioDir, VOICES } from "@/engine/voices";

/** True when the voice's clip folder has a manifest (its clips were generated). */
export async function voiceHasClips(id: string): Promise<boolean> {
  try { return (await fetch(`${audioDir(id)}/manifest.json`, { method: "HEAD" })).ok; } catch { return false; }
}

export default function VoicePicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled: boolean }) {
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all(VOICES.map(async (v) => [v.id, await voiceHasClips(v.id)] as const)).then((r) => { if (live) setReady(Object.fromEntries(r)); });
    return () => { live = false; audio.current?.pause(); };
  }, []);

  const play = (id: string) => {
    audio.current?.pause();
    if (playing === id) { setPlaying(null); return; }
    const a = new Audio(`/audio/samples/${id}.mp3`);
    a.onended = () => setPlaying(null);
    audio.current = a; setPlaying(id);
    a.play().catch(() => setPlaying(null));
  };

  return (
    <Collapsible card title="Voice" hint="who reads the voice-over">
      <div role="group" aria-label="Voice" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {VOICES.map((v) => {
          const has = ready[v.id] !== false; // unknown (still checking) counts as available
          const selected = v.id === value;
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, border: selected ? "2px solid #2563eb" : "1px solid #8884", background: selected ? "#2563eb14" : "transparent", opacity: has ? 1 : 0.5 }}>
              <button type="button" aria-pressed={selected} aria-disabled={!has || disabled}
                onClick={() => { if (has && !disabled) onChange(v.id); }}
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: has && !disabled ? "pointer" : "not-allowed", color: "inherit" }}>
                <strong>{v.label}</strong>
                <span style={{ display: "block", fontSize: 12, color: "#777" }}>{v.gender} · {v.accent}{has ? "" : " · clips not generated"}</span>
              </button>
              <button type="button" aria-label={`Listen to ${v.label}`} onClick={() => play(v.id)}
                style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid #8886", background: "transparent", cursor: "pointer", color: "inherit" }}>{playing === v.id ? "■" : "▶"}</button>
            </div>
          );
        })}
      </div>
    </Collapsible>
  );
}
