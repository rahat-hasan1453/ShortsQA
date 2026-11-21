"""Local Chatterbox TTS. Usage: speak.py <ref.wav|default> <out_dir> <json list of {key,text}>  -> writes <out_dir>/<key>.wav."""
import json, os, sys
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

ref, out_dir, items_path = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out_dir, exist_ok=True)
dev = "mps" if torch.backends.mps.is_available() else "cpu"
# Older checkpoints were saved on CUDA: map them to this device while loading.
_orig = torch.load
torch.load = lambda *a, **k: _orig(*a, **{**k, "map_location": torch.device(dev)})
model = ChatterboxTTS.from_pretrained(device=dev)
exaggeration = float(os.environ.get("CHATTERBOX_EXAGGERATION", "0.5"))
cfg_weight = float(os.environ.get("CHATTERBOX_CFG", "0.5"))
for it in json.load(open(items_path)):
    kw = {"exaggeration": exaggeration, "cfg_weight": cfg_weight}
    if ref != "default":
        kw["audio_prompt_path"] = ref
    wav = model.generate(it["text"], **kw)
    ta.save(os.path.join(out_dir, it["key"] + ".wav"), wav, model.sr)
    print("ok", it["key"], flush=True)
