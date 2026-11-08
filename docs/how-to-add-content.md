# Changing content

All raw data lives in `data/incoming/<name>.partNN.json`. `npm run build:data` merges the parts, applies `data/fixes.json`, validates everything and writes `data/<name>.json`. It fails on any error.

## Add or change a voice line

1. Edit the line in `data/incoming/voice_lines.part0N.json` (format `"flags"`). Placeholders: `{answer} {n} {total} {score} {region} {part}`. Lines with `{score}` are never used (the viewer's score is unknown).
2. `npm run build:data`
3. `npm run tts` generates only the missing clips (needs `tools/tts/.venv` with `edge-tts`: `python3 -m venv tools/tts/.venv && tools/tts/.venv/bin/pip install edge-tts`).
4. `npm run check:assets`, then commit `public/audio/`.

Changing the voice: edit `voice` in `tools/tts/config.json`, delete `public/audio/*.mp3` and `manifest.json`, run `npm run tts`. Run `npx tsx tools/tts/audition.ts` first to hear candidates.

## Add a country

Add it to a `countries_master.part*.json` (fields: `iso2 name altNames continent subregion capital flagDifficulty flagLookalikes flagHint`), then `npm run build:data`, `npm run copy:flags`, `npm run tts`. A new country needs at least `flagDifficulty` 1–5; the difficulty decides which question slot it can take.

## Change a theme

Edit `data/incoming/themes.part*.json`. Supported values: background `pattern | animated-gradient | texture | bokeh | gradient | grid`, timer `bar | ring | pulse | hourglass | numeric | flip`, reveal `wipe | pop | confetti | shake | flip | slide`. New fonts: `npm i -D @fontsource/<font>` then `npm run copy:fonts`.

## `data/fixes.json`

A list of corrections applied after merging, so raw data is never edited silently:

```json
{ "file": "what_is_it", "n": 51, "field": "altAnswers", "op": "remove", "value": "Kiwi" }
{ "file": "what_is_it", "op": "replace", "value": "Thermos", "with": "Vacuum Flask" }
{ "file": "landmarks", "n": 122, "op": "dropRow" }
```

`op` is `remove` or `replace` (array entries or string fields, case-insensitive), `set` (needs `n` and `field`) or `dropRow` (needs `n`). Omit `n` to apply to every row; omit `field` to try every field.
