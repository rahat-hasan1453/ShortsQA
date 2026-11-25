"use client";
import Collapsible from "./Collapsible";
import { useEffect, useRef, useState } from "react";
import { LIBRARY, MUSIC_AUTO, MUSIC_NONE, trackUrl } from "@/engine/audio/music";

const row = (selected: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 6, padding: 8, borderRadius: 10,
  border: selected ? "2px solid #2563eb" : "1px solid #8884", background: selected ? "#2563eb14" : "transparent",
});

export default function MusicPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled: boolean }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const play = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id) { setPlaying(null); return; }
    const a = new Audio(url);
    a.volume = 0.6;
    a.onended = () => setPlaying(null);
    audio.current = a; setPlaying(id);
    a.play().catch(() => setPlaying(null));
  };
  const choose = (id: string) => { if (!disabled) onChange(id); };
  const plain = (id: string, title: string, sub: string) => (
    <div style={row(value === id)}>
      <button type="button" aria-pressed={value === id} onClick={() => choose(id)} disabled={disabled}
        style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer", color: "inherit" }}>
        <strong>{title}</strong>
        <span style={{ display: "block", fontSize: 12, color: "#777" }}>{sub}</span>
      </button>
    </div>
  );

  return (
    <Collapsible card title="Music" hint="background track under the voice">
      <div role="group" aria-label="Music" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {plain(MUSIC_AUTO, "Auto", "a different track for each video (same seed = same track)")}
        {plain(MUSIC_NONE, "No music", "voice and sound effects only")}
        {LIBRARY.map((t) => (
          <div key={t.id} style={row(value === t.id)}>
            <button type="button" aria-pressed={value === t.id} onClick={() => choose(t.id)} disabled={disabled}
              style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer", color: "inherit" }}>
              <strong>{t.title}</strong>
              <span style={{ display: "block", fontSize: 12, color: "#777" }}>{t.artist} · {t.mood.join(", ")} · {t.license}</span>
            </button>
            <button type="button" aria-label={`Listen to ${t.title}`} onClick={() => play(t.id, trackUrl(t))}
              style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid #8886", background: "transparent", cursor: "pointer", color: "inherit" }}>{playing === t.id ? "■" : "▶"}</button>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}
