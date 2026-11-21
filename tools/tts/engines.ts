import path from "node:path";
import type { VoiceDef } from "../../src/engine/voices";

/** The Python process that renders every listed clip of one voice to <outDir>/<key>.wav. */
export function engineCommand(v: VoiceDef, cfg: { chatterboxPython: string }, root: string, home: string, outDir: string, itemsFile: string): { cmd: string; args: string[] } {
  if (v.engine === "kokoro") {
    return { cmd: path.join(root, "tools/tts/.venv-kokoro/bin/python"), args: [path.join(root, "tools/tts/kokoro/speak.py"), v.voice!, outDir, itemsFile] };
  }
  const py = cfg.chatterboxPython.startsWith("~/") ? path.join(home, cfg.chatterboxPython.slice(2)) : cfg.chatterboxPython;
  return { cmd: py, args: [path.join(root, "tools/tts/chatterbox/speak.py"), v.refAudio ?? "default", outDir, itemsFile] };
}
