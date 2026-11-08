# Shorts Quiz Generator — Design (v1: "10 Flags Rapid")

Date: 2026-11-09. Status: draft for review.

## 1. Goal and success criteria

A website that generates YouTube Shorts quiz videos. The user picks a format, theme and seed, previews the video, and downloads an MP4 that can be uploaded to YouTube with no editing. Voice-over, music, countdown and answer reveals are all inside the video. The long-term goal is monetization through a daily upload cadence (1–3 videos per day).

A downloaded file is valid when:
- 9:16, 1080×1920, H.264 video + AAC audio, MP4, **duration ≤ 59 s**;
- all important content is inside the safe zone: top 200 px, bottom 240 px and right 160 px are kept clear of text and key graphics.

Also downloaded with each video: title, description, hashtags and pinned comment (from `data/titles.json`).

## 2. Decisions already made (with the user)

| Topic | Decision |
|---|---|
| Location | New standalone Next.js app in `/Users/rahat/ShortsQA` (not inside RiQS) |
| Hosting | Deployed to the internet, **static hosting** (Vercel free tier is enough) |
| Rendering | **In the browser** (WebCodecs H.264 + AAC, `mp4-muxer`). No render server |
| Voice | Edge TTS, one female voice, **pre-generated offline** and shipped as static audio |
| First format | "10 Flags Rapid" (easy to impossible). Other formats come in later specs |

Everything below serves v1. Other formats (landmarks, capitals, country-shape, real-vs-fake-flag, what-is-it, math, missing-letters) reuse the engine and are **out of scope** for this spec.

## 3. Architecture

Four independent parts.

1. **Data (`data/`)** — validated JSON merged from `data/incoming/*.part*.json`.
2. **Offline tools (`tools/`)** — run on the developer's Mac; their outputs are committed.
3. **Engine (`src/engine/`)** — pure TypeScript, no UI, fully unit-testable.
4. **Web UI (`src/app/`)** — Next.js with `output: 'export'`.

### 3.1 Engine units

| Unit | Responsibility | Depends on |
|---|---|---|
| `QuizBuilder` | `(seed, format, options) → QuizSpec`: picks 10 questions, orders them by difficulty, picks voice lines and title | data, seeded RNG |
| `Timeline` | `QuizSpec → Timeline`: assigns exact start/end seconds to every scene and audio cue | QuizSpec |
| `Renderer` | `drawFrame(ctx, timeline, theme, t)`: pure function that paints one 1080×1920 frame | Timeline, Theme |
| `AudioMixer` | Builds one stereo buffer offline with `OfflineAudioContext`: voice clips, synthesized ticks, heartbeat, chimes, whoosh, music bed | Timeline, audio assets |
| `Encoder` | Frame loop → `VideoEncoder` (H.264) + `AudioEncoder` (AAC) → `mp4-muxer` → `Blob` | Renderer, AudioMixer |

`Renderer.drawFrame` is pure and shared by the live preview and the export, so the preview is exactly what is exported. Export is not real time: it steps `t` frame by frame at 30 fps (30 fps is enough for quiz content and halves encode time versus 60).

`QuizSpec` is a small serializable JSON object (seed, format, theme id, question list, chosen voice-line ids, title ids). It can be saved, loaded and used for batch export.

### 3.2 Data flow

```
seed + format + theme → QuizBuilder → QuizSpec → Timeline
                                                   ├→ Renderer (frames)  ┐
                                                   └→ AudioMixer (audio) ┴→ Encoder → MP4
QuizSpec → titles bank → title / description / hashtags / pinned comment (text file)
```

Batch export = generate N specs from N seeds and export them one after another.

### 3.3 Repository layout

```
data/                 merged, validated JSON (countries, themes, voice_lines, titles, ...)
data/fixes.json       explicit, auditable corrections applied during merge
data/incoming/        raw parts from the side chats (kept for reference)
tools/build-data/     merge + validate
tools/tts/            Edge TTS generation + loudness normalization (ffmpeg)
tools/flags/          flag SVG copy + license note
public/audio/         voice clips (committed)
public/flags/         flag SVGs (committed)
src/engine/           QuizBuilder, Timeline, Renderer, AudioMixer, Encoder
src/app/              UI
```

## 4. Format v1: "10 Flags Rapid"

Target duration about 52 s.

| Part | Time | Content |
|---|---|---|
| Hook | 3 s | Themed title card ("Can you name all 10 flags?"), voice intro line |
| Q1–Q10 | about 4.5 s each (about 45 s) | Flag appears → 3 s timer with ticking → 1.5 s reveal (country name, voice "It's {answer}!", chime) |
| Outro | 4 s | Score line plus call to action ("Comment your score", "Part N"); last frame fades into the first frame for a loop |

Q10 ("impossible") gets a 4 s timer with a heartbeat. The only hard limit is 59 s; `Timeline` computes the real total and the export refuses anything above it.

### 4.1 Difficulty ramp

Source field: `flagDifficulty` (1–5) in the countries data. Bands and available countries:

| Band | `flagDifficulty` | Countries available | Questions |
|---|---|---|---|
| Easy | 1–2 | 41 | Q1–Q3 |
| Medium | 3 | 48 | Q4–Q6 |
| Hard | 4 | 68 | Q7–Q9 |
| Impossible | 5 | 40 | Q10 |

All bands have enough countries for a 10-question quiz with no repeats. Questions are open-ended (no multiple choice): viewers answer mentally and see the answer after the timer.

### 4.2 Voice

Voice is sparse. Lines come from `data/voice_lines.json` (placeholders `{answer} {n} {total} {score} {region} {part}`):
- intro once; `ask` on some questions only; `countdown` cues on a few;
- `reveal-correct` on every question;
- `difficulty-up` before Q4, Q7 and Q10;
- `transition` between some questions; `outro` once.

Every clip is generated offline for every line and every country name, and committed.

### 4.3 Layout (1080×1920)

- 0–220 px: kept empty (platform UI).
- Header (y 230–380): "FLAG n/10" and difficulty badge.
- Flag card: about 900×600 px, centered around y 420–1020.
- Timer ring below the flag; reveal text under the flag.
- Progress dots (10) near y 1560.
- Bottom 240 px and right 160 px: empty.
- A debug toggle draws the safe-zone overlay.

### 4.4 Variety (avoids "template spam")

- 15 themes from `data/themes.json` (palette, background, fonts, timer style, music mood). One per video.
- Countries are random within each difficulty band.
- Optional twist per video (region such as "Flags from Africa", or a visual theme such as "every flag has stars"), supported by `continent`, `subregion`, `flagLookalikes`.
- Voice lines, hook and title templates vary per video.
- "Part N" counter increments per series.

YouTube may treat near-identical mass-produced videos as inauthentic content. The variety above is a mitigation, not a guarantee; the YPP policy should be checked by the user before relying on monetization.

## 5. Offline tools

### 5.1 `tools/build-data`

Merges `data/incoming/*.part*.json` into final files. All known corrections live in `data/fixes.json` (reviewable, no silent edits), including:
- remove brand names (Thermos, Frisbee, Jet Ski, Skittles, Velcro, Scotch, Hoover, Stanley, Rubik's, Crescent, Stillson, Skill Saw, Jubilee, Zeppelin, Popsicle) or replace with generic names;
- alt-answer clashes (Kiwi, Mouse, Plane, Palm, Nail, Elk, Windmill);
- hints longer than 8 words or leaking the answer; words shorter than 5 letters in missing-letters;
- `Czech Republic` vs `Czechia`; Hong Kong and Macau landmarks not in the 197-country master list.

The validator fails the build on: duplicates, unknown ISO codes, brand names, length and placeholder violations, `wrongOptions` equal to the answer or an alt.

Only the countries, themes, voice lines and titles are required for v1; landmarks, what-is-it and missing-letters are merged but not used yet.

### 5.2 `tools/tts`

- Voice: one fixed Edge TTS female voice (exact voice name chosen at implementation time and recorded in a config file).
- Generates a clip per voice line (with placeholders expanded for numbers 1–10 and scores) and per country name.
- Normalizes loudness with ffmpeg (single target level) and writes `public/audio/<hash>.mp3` plus a manifest.

### 5.3 `tools/flags`

Copies flag SVGs for all 197 countries from the MIT-licensed `flag-icons` package into `public/flags/<iso2>.svg` and writes a license notice. Build fails if any country in the data lacks an SVG.

## 6. Error handling

- Missing audio or flag assets are caught at build time; deployment is blocked.
- WebCodecs / `VideoEncoder` / `AudioEncoder` feature detection on page load; if unsupported, show "Open in Chrome or Edge" and disable Export.
- Duration guard: refuse export above 59 s.
- Encoder failure: retry once at a lower bitrate, then show the error with the seed so the video can be reproduced.
- Same seed + same data version always produces the same quiz and the same frames.

## 7. Testing

- **Unit:** `QuizBuilder` determinism (same seed → same spec), difficulty ramp, no repeated country, band membership; `Timeline` total < 59 s; data validators (positive and negative cases).
- **Golden frames:** headless Chrome renders fixed frames (hook, question, reveal, impossible, outro) for two themes and compares to stored snapshots.
- **Export smoke test:** produce a real MP4 in headless Chrome and verify with `ffprobe`: 1080×1920, H.264, AAC, duration ≤ 59 s.
- **Safe-zone test:** a pixel check that the margins are empty in golden frames.

## 8. Risks and assumptions

- Chrome/Edge on desktop is required for export (WebCodecs AAC support). Safari and Firefox are unsupported.
- Music is synthesized in the browser, so no Content ID claims. Music quality is the weakest part and may need iteration.
- Edge TTS is an unofficial endpoint; the offline approach limits exposure, and voice clips must be regenerated if the voice or script changes.
- `flagDifficulty` and `flagLookalikes` come from model-generated data and have not been fact-checked; spot checks are planned before launch.
- AI-generated data may still contain factual errors (capitals, ISO codes); only validation of format and consistency is automated.

## 9. Out of scope (v1)

Other formats, multiple-choice variant, user accounts, server-side storage, direct YouTube upload, analytics, localization.

## 10. Open items to settle during planning

- Exact Edge TTS voice name.
- Exact numbers for the music beds per theme mood.
- Whether `Renderer` uses Canvas 2D only or OffscreenCanvas in a worker (decide after a first profiling of frame time).
