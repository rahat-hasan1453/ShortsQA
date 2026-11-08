export type Support = { ok: true } | { ok: false; reason: string };

export async function detectSupport(): Promise<Support> {
  const g = globalThis as any;
  if (typeof g.VideoEncoder === "undefined" || typeof g.AudioEncoder === "undefined" || typeof g.OffscreenCanvas === "undefined") {
    return { ok: false, reason: "Open in Chrome or Edge" };
  }
  try {
    const v = await g.VideoEncoder.isConfigSupported({ codec: "avc1.640028", width: 1080, height: 1920, bitrate: 6_000_000, framerate: 30, avc: { format: "avc" } });
    const a = await g.AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 });
    if (!v.supported) return { ok: false, reason: "This browser cannot encode H.264 video. Open in Chrome or Edge." };
    if (!a.supported) return { ok: false, reason: "This browser cannot encode AAC audio. Open in Chrome or Edge." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Open in Chrome or Edge" };
  }
}
