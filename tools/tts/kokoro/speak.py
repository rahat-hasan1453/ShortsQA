"""Local Kokoro TTS. Usage: speak.py <voice> <out_dir> <json list of {key,text}>  -> writes <out_dir>/<key>.wav (24 kHz)."""
import json, sys, os
import soundfile as sf
from kokoro import KPipeline

voice, out_dir, items_path = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out_dir, exist_ok=True)
pipe = KPipeline(lang_code="a" if voice[0] == "a" else "b", repo_id="hexgrad/Kokoro-82M")
for it in json.load(open(items_path)):
    audio = []
    for _, _, a in pipe(it["text"], voice=voice, speed=float(os.environ.get("KOKORO_SPEED", "1.0"))):
        audio.append(a)
    if not audio:
        raise SystemExit(f"no audio for {it['text']!r}")
    import numpy as np
    sf.write(os.path.join(out_dir, it["key"] + ".wav"), np.concatenate(audio), 24000)
    print("ok", it["key"], flush=True)
