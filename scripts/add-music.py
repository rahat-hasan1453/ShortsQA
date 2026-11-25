#!/usr/bin/env python3
"""Add CC0 / public-domain tracks from Wikimedia Commons to the music library.

  python3 scripts/add-music.py "Komiku - 10 - Fetch Fever.ogg" "Soft and Furious - 03 - Hardwave.ogg" ...

For each Commons file name: checks the licence (only CC0 / Public domain are accepted),
downloads it, keeps the first 64 s, normalises to -20 LUFS, writes public/music/<id>.mp3
(MP3 128 kbps) and appends it to public/music/library.json and CREDITS.md.
Needs ffmpeg. Tags: pass  --mood chiptune,upbeat  before the names to label the tracks that follow.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MUSIC = os.path.join(ROOT, "public", "music")
UA = {"User-Agent": "shortsqa-music-library/1.0 (local tool)"}
OK_LICENSES = ("cc0", "public domain", "cc-zero", "pd")

def get(url, tries=6):
    """GET via curl (Wikimedia throttles Python's HTTP client harder); honours rate limits."""
    for i in range(tries):
        r = subprocess.run(["curl", "-sL", "-m", "180", "-A", UA["User-Agent"], "-w", "\n%{http_code}", url], capture_output=True)
        body, _, code = r.stdout.rpartition(b"\n")
        if code == b"200": return body
        if code != b"429": raise SystemExit(f"HTTP {code.decode()} for {url}")
        time.sleep(60 + 30 * i)
    raise SystemExit("Wikimedia keeps rate-limiting; try again later")

def info(name):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": "File:" + name})
    page = list(json.loads(get("https://commons.wikimedia.org/w/api.php?" + q))["query"]["pages"].values())[0]
    if "imageinfo" not in page: raise SystemExit(f"not found on Commons: {name}")
    return page["imageinfo"][0]

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def main(args):
    lib_path = os.path.join(MUSIC, "library.json")
    lib = json.load(open(lib_path))
    mood = ["upbeat"]
    for a in args:
        if a.startswith("--mood="): mood = a[7:].split(","); continue
        m = re.match(r"^(.*?) - (?:\d+ - )?(.*)\.\w+$", a)
        artist, title = (m.group(1), m.group(2)) if m else ("Unknown", a)
        tid = slug(title)
        if any(t["id"] == tid for t in lib): print("already in library:", tid); continue
        i = info(a); meta = i["extmetadata"]
        lic = (meta.get("LicenseShortName", {}).get("value") or "").strip()
        if not any(lic.lower().startswith(k) for k in OK_LICENSES):
            print(f"SKIP {a}: licence is '{lic}', only CC0 / public domain is accepted"); continue
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "src" + os.path.splitext(a)[1])
            open(src, "wb").write(get(i["url"]))
            out = os.path.join(MUSIC, tid + ".mp3")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-t", "64", "-af", "loudnorm=I=-20:TP=-2:LRA=11,afade=t=out:st=61:d=3", "-ac", "2", "-ar", "44100", "-b:a", "128k", out], check=True)
        lib.append({"id": tid, "title": title, "artist": artist, "license": "CC0" if "cc0" in lic.lower() else lic, "file": tid + ".mp3", "mood": mood, "source": i["descriptionurl"] if "descriptionurl" in i else "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(a.replace(" ", "_"))})
        print("added", tid, f"({os.path.getsize(out)//1024} KB, {lic})")
        json.dump(lib, open(lib_path, "w"), indent=2, ensure_ascii=False)
        time.sleep(8)
    rows = "\n".join(f"| {t['file']} | {t['title']} | {t['artist']} | {t['license']} | {t['source']} |" for t in lib)
    open(os.path.join(MUSIC, "CREDITS.md"), "w").write(
        "# Music credits (all CC0 / public domain: no attribution required, listed for the record)\n\n"
        "| File | Track | Artist | Licence | Source |\n|---|---|---|---|---|\n" + rows +
        "\n\nFirst 64 s of each, loudness-normalised to -20 LUFS, MP3 128 kbps.\nAdd more with: python3 scripts/add-music.py \"<Commons file name>\" (see the header of that script).\n")

if __name__ == "__main__": main(sys.argv[1:])
