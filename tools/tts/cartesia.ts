import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const VERSION = "2025-04-16";
export const CARTESIA_MODEL = "sonic-latest";

/** The key is read from CARTESIA_API_KEY or the git-ignored file .env.cartesia (never committed). */
export function cartesiaKey(): string {
  if (process.env.CARTESIA_API_KEY) return process.env.CARTESIA_API_KEY.trim();
  const f = path.join(root, ".env.cartesia");
  if (fs.existsSync(f)) {
    const m = fs.readFileSync(f, "utf8").match(/CARTESIA_API_KEY\s*=\s*(\S+)/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("No Cartesia key: put CARTESIA_API_KEY=... in .env.cartesia (git-ignored)");
}

export async function listVoices(): Promise<{ id: string; name: string; description: string; language: string; gender?: string }[]> {
  const all: any[] = [];
  let url: string | null = "https://api.cartesia.ai/voices?limit=100";
  while (url) {
    const res = await fetch(url, { headers: { "X-API-Key": cartesiaKey(), "Cartesia-Version": VERSION } });
    if (!res.ok) throw new Error(`voices ${res.status}: ${await res.text()}`);
    const j: any = await res.json();
    all.push(...(j.data ?? j));
    url = j.has_more && j.next_page ? `https://api.cartesia.ai/voices?limit=100&starting_after=${j.next_page}` : null;
  }
  return all;
}

/** Synthesises one line to an mp3 file. */
export async function cartesiaSpeak(text: string, voiceId: string, out: string): Promise<void> {
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: { "X-API-Key": cartesiaKey(), "Cartesia-Version": VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_id: CARTESIA_MODEL, transcript: text, language: "en",
      voice: { mode: "id", id: voiceId },
      output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
    }),
  });
  if (!res.ok) throw new Error(`cartesia ${res.status}: ${await res.text()}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}
