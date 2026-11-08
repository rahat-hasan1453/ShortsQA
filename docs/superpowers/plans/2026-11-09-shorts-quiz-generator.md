# Shorts Quiz Generator (v1: "10 Flags Rapid") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static website that builds a "10 Flags Rapid" YouTube Shorts quiz video in the browser (voice, music, timer, reveals) and downloads it as an upload-ready MP4 plus title/description/hashtags/pinned comment.

**Architecture:** Offline tools (run on the developer's Mac, outputs committed) produce validated data, flag SVGs, fonts and pre-generated voice clips. A pure-TypeScript engine (`QuizBuilder` → `Timeline` → `Renderer` + `AudioMixer` → `Encoder`) turns `seed + theme` into frames and audio; the live preview and the export share the same `drawFrame`. A Next.js static export is the UI.

**Tech Stack:** Node 24, Next.js (static export, App Router), TypeScript, Vitest, Playwright (channel `chrome`), `mp4-muxer`, WebCodecs, Web Audio `OfflineAudioContext`, `flag-icons` (MIT), `@fontsource/*` (OFL), `edge-tts` (Python CLI), ffmpeg 9, ffprobe.

**Spec:** `docs/superpowers/specs/2026-11-09-shorts-quiz-generator-design.md`

## Global Constraints

- Output: MP4, **1080×1920**, 30 fps, H.264 video + AAC audio (48 kHz stereo), **duration ≤ 59 s**.
- Safe zone: top **200 px**, bottom **240 px**, right **160 px** clear of text and key graphics (layout starts content at y ≥ 220).
- Export only in Chrome/Edge desktop (WebCodecs); elsewhere show "Open in Chrome or Edge" and disable Export.
- Static hosting only (`output: 'export'`); no render server, no runtime TTS.
- Same seed + same data version ⇒ identical `QuizSpec`, identical frames.
- Difficulty bands from `flagDifficulty`: easy 1–2 (Q1–Q3), medium 3 (Q4–Q6), hard 4 (Q7–Q9), impossible 5 (Q10). Open-ended questions, no multiple choice.
- Voice is sparse: intro once, `reveal-correct` every question, `difficulty-up` before Q4/Q7/Q10, `ask`/`countdown`/`transition` on some questions only.
- Music is synthesized in the browser (no sampled/copyrighted audio).
- No brand names in data (Thermos, Frisbee, Jet Ski, Skittles, Velcro, Scotch, Hoover, Stanley, Rubik's, Crescent, Stillson, Skill Saw, Jubilee, Zeppelin, Popsicle).
- Package manager: npm. Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The old prototype `index.html` is moved to `prototype/` (not deleted) and may be mined for ideas.

## Review Focus

1. **Odd seeds** (empty string, 10 000 characters, emoji): must give a deterministic quiz and never throw. (Task 5)
2. **Longest country names** ("Saint Vincent and the Grenadines", "Bosnia and Herzegovina", "Democratic Republic of the Congo"): reveal text must fit inside the card in every theme, and each name must have a voice clip. (Tasks 4, 7)
3. **A voice clip longer than its slot:** the timeline extends the slot instead of overlapping clips, and 500 random seeds all stay ≤ 59 s. (Task 5)
4. **Concurrent or aborted export:** a second export while one is running is rejected; abort releases the encoders and a fresh export then works. (Task 9)
5. **A font or flag that fails to load:** fall back to a generic font with a visible warning; export refuses to run if any required asset is missing, never producing a blank or partial video. (Tasks 7, 9)

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
prototype/index.html                      moved old prototype
data/                                     merged JSON + fixes.json (incoming/ stays)
tools/build-data/{merge,validators,fixes,index}.ts
tools/flags/copy-flags.ts   tools/fonts/copy-fonts.ts
tools/tts/{segments,clips,generate,audition,check}.ts   tools/tts/config.json
public/{flags,fonts,audio}/               generated, committed
src/engine/{types,rng,quizBuilder,timeline,metadata,theme}.ts
src/engine/render/{index,layout,text,background,timer,reveal}.ts
src/engine/audio/{music,synth,mixer}.ts
src/engine/export/{support,encoder}.ts
src/app/{layout.tsx,page.tsx}  src/app/components/{Controls,Preview,ExportPanel}.tsx
tests/unit/*.test.ts   tests/browser/*.spec.ts
```

---

### Task 1: Scaffold the app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/unit/smoke.test.ts`
- Move: `index.html` → `prototype/index.html`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test` (vitest run), `test:browser` (playwright), `build:data`, `copy:flags`, `copy:fonts`, `tts`, `check:assets`.

- [ ] **Step 1:** Scaffold in a temp directory with `npx create-next-app@latest --ts --app --src-dir --no-tailwind --import-alias "@/*"`, then copy its files into the repo root without touching `briefs/`, `data/`, `docs/`, `SHORTS_HANDOFF.md`, `save.sh`. If the scaffold contains `AGENTS.md` or `node_modules/next/dist/docs/`, read it before configuring.
- [ ] **Step 2:** `git mv index.html prototype/index.html`. In `next.config.ts` set `output: 'export'` and `images: { unoptimized: true }`.
- [ ] **Step 3:** Install `vitest`, `@playwright/test`, `mp4-muxer`, `flag-icons`, `tsx`. Configure Playwright with one project `{ name: 'chrome', use: { channel: 'chrome' } }` (bundled Chromium lacks H.264) and `webServer: npm run dev`.
- [ ] **Step 4:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`. Run `npm test` → PASS. Run `npm run build` → creates `out/index.html`.
- [ ] **Step 5:** Commit `chore: scaffold Next.js static app, move prototype`.

---

### Task 2: Data merge and validation

**Files:**
- Create: `tools/build-data/{merge,validators,fixes,index}.ts`, `data/fixes.json`, `tests/unit/build-data.test.ts`
- Output (generated): `data/{countries,themes,voice_lines,titles,landmarks,what_is_it,missing_letters}.json`

**Interfaces:**
- Produces: `type Issue = { file: string; n?: number; rule: string; message: string }`; `mergeParts(dir: string, prefix: string): unknown[]` (reads `<prefix>.part*.json`, flattens arrays in file order); `applyFixes(datasets: Record<string, any[]>, fixes: Fix[]): Record<string, any[]>` where `Fix = { file: string; n: number; field: string; op: 'remove' | 'replace' | 'set'; value?: unknown; with?: unknown }`; `validate<Kind>(rows): Issue[]` for `countries | voiceLines | titles | landmarks | whatIsIt | missingLetters`. `missingLetters` returns issues as `severity: 'warn'` (dataset is incomplete, 250/1000); all other kinds are errors that fail the build.
- Required fields for `Country`: `iso2, name, altNames, continent, subregion, capital, flagDifficulty (1–5), flagLookalikes, flagHint`.

- [ ] **Step 1: Write failing tests** in `tests/unit/build-data.test.ts`: `validateCountries` flags a duplicate `iso2`, a `flagDifficulty` of 6, a lookalike code not in the list; `validateWhatIsIt` flags `wrongOptions` containing the answer or an `altAnswers` entry, and flags the answer "Frisbee" (brand list from Global Constraints, case-insensitive, whole word); `validateVoiceLines` flags a reveal line with zero or two `{answer}` and any placeholder outside `{answer}{n}{total}{score}{region}{category}{part}`; `validateTitles` flags a title over 70 characters; `applyFixes` with `{op:'remove', field:'altAnswers', value:'Kiwi', n:51}` removes only that entry.
- [ ] **Step 2:** Run `npx vitest run tests/unit/build-data.test.ts` → FAIL (modules missing).
- [ ] **Step 3:** Implement the functions above. Brand list is one exported constant `BRANDS`. Duplicate-answer and alt-vs-answer clash checks apply across the whole dataset.
- [ ] **Step 4:** Write `data/fixes.json` covering every known issue: brands (Thermos, Frisbee, Jet Ski, Skittles, Velcro, Scotch, Hoover, Stanley, Rubik's, Crescent, Stillson, Skill Saw, Jubilee, Zeppelin, Popsicle) replaced by generic names; clashes Kiwi (items 51, 268), Mouse (74, 432), Plane (593, 656), Palm, Nail, Elk (91, 92), Windmill (950); item 749 renamed to a ≤3-word name; landmarks 122 and 281 dropped (Hong Kong, Macau not in master list); landmark country name `Czech Republic` → `Czechia` for items 27, 71, 224; missing-letters hints longer than 8 words or leaking the answer (items 29, 53, 108, 118, 132, 140, 141, 149, 155, 157, 164, 174, 177, 192, 201, 203, 218, 244, 246) shortened.
- [ ] **Step 5:** Implement `tools/build-data/index.ts` (merge → applyFixes → validate → write `data/*.json`; exit code 1 on any error, warnings printed). Add `"build:data": "tsx tools/build-data/index.ts"`. Run it; expected: countries 197 rows, what_is_it 1000 rows, 0 errors, missing_letters warnings only. Re-run `npx vitest run` → PASS.
- [ ] **Step 6:** Commit `feat: merge and validate datasets`.

---

### Task 3: Static asset tools (flags, fonts)

**Files:**
- Create: `tools/flags/copy-flags.ts`, `tools/fonts/copy-fonts.ts`, `tests/unit/assets.test.ts`
- Output: `public/flags/<iso2>.svg` (lowercase), `public/fonts/<slug>-<weight>.woff2`, `public/flags/LICENSE.txt`, `public/fonts/LICENSE.txt`

**Interfaces:**
- Produces: `flagPath(iso2: string): string` → `"/flags/<iso2 lowercase>.svg"`; `fontFamilies(themes): string[]` (unique `fonts.*` values across themes); `fontFile(family: string): string`.

- [ ] **Step 1: Write failing test** in `tests/unit/assets.test.ts`: every `iso2` in `data/countries.json` has `public/flags/<iso2>.svg`; every family in `fontFamilies(themes)` has a file in `public/fonts/` (37 families expected); both LICENSE files exist.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `copy-flags.ts` (copy from `node_modules/flag-icons/flags/4x3/`, fail listing any missing code, e.g. Kosovo `xk`) and `copy-fonts.ts` (install each family from `@fontsource/<slug>` as devDependencies, copy latin 400 and 700 woff2; where a family has no 700, copy 400 only). Add `copy:flags`, `copy:fonts` scripts and run both.
- [ ] **Step 4:** Run tests → PASS. Commit `feat: flag svgs and fonts as static assets`.

---

### Task 4: Voice clips (Edge TTS, offline)

**Files:**
- Create: `tools/tts/{segments,clips,generate,audition,check}.ts`, `tools/tts/config.json`, `tests/unit/tts.test.ts`
- Output: `public/audio/<key>.mp3`, `public/audio/manifest.json`

**Interfaces:**
- Produces: `type Segment = { kind: 'text'; text: string } | { kind: 'slot'; name: 'answer' | 'n' | 'total' | 'score' | 'part' | 'region' }`; `segmentLine(line: string): Segment[]`; `clipKey(voice: string, text: string): string` (sha1 hex, first 16 chars, of `voice + "|" + text`); `type ClipManifest = Record<string, { file: string; durationMs: number; text: string }>`; `collectClipRequests(voiceLines, countries): { key: string; text: string }[]` (every text segment of every flags line, every country `name`, numbers `0`–`99` as words, each distinct region name from `countries[].continent` plus "the world"); `clipDurationMs(manifest, key): number`.
- Consumes: `data/voice_lines.json` (format `"flags"`), `data/countries.json`.

- [ ] **Step 1: Write failing tests** in `tests/unit/tts.test.ts`: `segmentLine("Did you get {answer}? Nice one!")` → text "Did you get", slot answer, text "? Nice one!" (trimmed, empty segments dropped); `segmentLine("Next one!")` → one text segment; `clipKey` is stable and differs for different text; `collectClipRequests` includes "Saint Vincent and the Grenadines" and "forty-two" and has no duplicate keys.
- [ ] **Step 2:** Run → FAIL. Implement `segments.ts`, `clips.ts`.
- [ ] **Step 3:** `pip3 install edge-tts`. Write `audition.ts`: for three candidate female voices from `config.json` (`en-US-AriaNeural`, `en-US-JennyNeural`, `en-GB-SoniaNeural`) render the same two lines to `tmp/audition/<voice>.mp3`. **Run it and ask the user to listen and pick one; write the choice to `config.json` as `"voice"`. Do not bulk-generate before the user chooses.**
- [ ] **Step 4:** Implement `generate.ts`: for each missing request run `edge-tts --voice <voice> --text <text> --write-media <tmp>`, then `ffmpeg -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1` to `public/audio/<key>.mp3`, measure duration with ffprobe, update `manifest.json`. Idempotent: existing keys are skipped. Add `"tts"` script.
- [ ] **Step 5:** Implement `check.ts` (`check:assets`): every key from `collectClipRequests` exists in the manifest with a readable file; exit 1 listing gaps. Run `npm run tts` then `npm run check:assets` → exit 0.
- [ ] **Step 6:** Run unit tests → PASS. Commit `feat: pre-generated voice clips and manifest`.

---

### Task 5: QuizBuilder and Timeline

**Files:**
- Create: `src/engine/{types,rng,quizBuilder,timeline}.ts`, `tests/unit/{rng,quizBuilder,timeline}.test.ts`

**Interfaces:**
- Produces: 
  - `type Band = 'easy'|'medium'|'hard'|'impossible'`
  - `type QuizQuestion = { index: number /*0–9*/; iso2: string; name: string; band: Band; askLineId?: string; countdownLineId?: string; revealLineId: string; transitionLineId?: string }`
  - `type QuizSpec = { version: 1; format: 'flags-rapid'; seed: string; themeId: string; part: number; twistRegion?: string; hookLineId: string; difficultyUpLineIds: Record<number, string> /* keys 3,6,9 */; outroLineId: string; questions: QuizQuestion[] }`
  - Line ids are `"flags.<type>.<index>"`, e.g. `"flags.revealCorrect.4"`.
  - `createRng(seed: string): { next(): number /*[0,1)*/; int(maxExclusive: number): number; pick<T>(xs: T[]): T; shuffle<T>(xs: T[]): T[] }` (deterministic for any string).
  - `buildQuiz(input: { seed: string; themeId?: string; part?: number; useRegionTwist?: boolean; countries: Country[]; themes: Theme[]; voice: VoiceLines; clipMs: (text: string) => number }): QuizSpec`
  - `type Cue = { at: number; kind: 'voice'; clips: string[] } | { at: number; kind: 'tick' | 'heartbeat' | 'chime' | 'whoosh' }`
  - `type Scene = { kind: 'hook'|'question'|'timer'|'reveal'|'diffUp'|'outro'; start: number; end: number; q?: number }`
  - `type Timeline = { spec: QuizSpec; duration: number; scenes: Scene[]; cues: Cue[] }`
  - `class DurationError extends Error {}`; `buildTimeline(spec: QuizSpec, deps: { clipMs: (clipKey: string) => number; lineClips: (lineId: string, q?: QuizQuestion) => string[] }): Timeline`.
- Timeline constants (exported): hook min 3.0 s, timer 3.0 s (Q10: 4.0 s), reveal min 1.5 s, diffUp slot 0.8 s (voice may run into the next timer), outro min 4.0 s, max duration 59 s. A slot grows to `voiceMs/1000 + 0.2` when its voice clip is longer than the slot. `buildTimeline` throws `DurationError` when `duration > 59`.

- [ ] **Step 1: Write failing tests.** `rng.test.ts`: same seed twice gives the same first 20 values; seeds `""`, a 10 000-character string and `"🏁🇫🇷"` neither throw nor collide with each other. `quizBuilder.test.ts`: same inputs give deep-equal specs; 10 distinct `iso2`; bands per index are easy×3, medium×3, hard×3, impossible×1 using `flagDifficulty` mapping; `part` of `0`, `-3`, `1000` is clamped to 1–99; with `useRegionTwist` every question is in that continent when each band has enough countries there, otherwise `twistRegion` is `undefined` and the quiz still builds (check each of the six continents); reveal and ask lines whose clips exceed 1900 ms / 2000 ms are never chosen when a shorter one exists. `timeline.test.ts`: a typical spec has duration between 50 and 59; `difficultyUp` cues exist exactly at questions 3, 6, 9 (0-based), before the timer; a spec whose reveal clip is 3.5 s gets a reveal scene ≥ 3.7 s and no two voice cues overlap; 500 random seeds all build without `DurationError`; a spec with absurd clip lengths throws `DurationError`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/{rng,quizBuilder,timeline}.test.ts` → FAIL.
- [ ] **Step 3:** Implement `rng.ts` (string hash → `mulberry32`), `types.ts`, `quizBuilder.ts`, `timeline.ts`. Region twist applies only if the continent has ≥3 easy, ≥3 medium, ≥3 hard and ≥1 impossible countries.
- [ ] **Step 4:** Run the three test files → PASS.
- [ ] **Step 5:** Commit `feat: seeded QuizBuilder and Timeline`.

---

### Task 6: Metadata (title, description, hashtags, pinned comment)

**Files:**
- Create: `src/engine/metadata.ts`, `tests/unit/metadata.test.ts`

**Interfaces:**
- Consumes: `QuizSpec`, `data/titles.json` (format `"flags"`: `titles`, `titlesSeries`, `descriptions`, `pinnedComments`, `hashtagSets`).
- Produces: `buildMetadata(spec: QuizSpec, titles: TitleBank): { title: string; description: string; hashtags: string[]; pinnedComment: string }`. Placeholder values: `{n}`=10, `{level}`="impossible", `{region}`=`spec.twistRegion ?? "the World"`, `{category}`="flag", `{part}`=`spec.part`. Templates containing `{theme}` are skipped (flags have no per-flag theme). Uses `titlesSeries` when `part > 1`. Choice is seeded from `spec.seed`.

- [ ] **Step 1: Write failing tests:** for 300 random seeds, the title is ≤ 70 characters and no `{…}` remains in any field; `part=1` uses `titles`, `part=5` uses `titlesSeries`; hashtags include `#shorts`; same spec gives identical output; `{theme}` never appears in a title; the pinned comment is ≤ 120 characters.
- [ ] **Step 2:** Run → FAIL. Implement; when a filled title exceeds 70 characters, pick another template (a template that fits always exists in the data).
- [ ] **Step 3:** Run → PASS. Commit `feat: video metadata generator`.

---

### Task 7: Renderer

**Files:**
- Create: `src/engine/theme.ts`, `src/engine/render/{layout,text,background,timer,reveal,index}.ts`, `src/app/debug/frame/page.tsx` (dev-only route), `tests/unit/{layout,text}.test.ts`, `tests/browser/render.spec.ts`

**Interfaces:**
- Produces: 
  - `type Theme` mirrors `data/themes.json` entries (palette, background `{type}`, fonts, timer `{style}`, reveal `{style}`, music).
  - `SAFE = { top: 200, bottom: 240, right: 160 }`; layout rects (all inside the safe zone, content starts y ≥ 220): `LAYOUT.header`, `LAYOUT.flagCard` (900×600, centered, y 420–1020), `LAYOUT.timer`, `LAYOUT.reveal`, `LAYOUT.dots` (y ≈ 1560).
  - `fitText(measure: (px: number) => number, maxWidth: number, maxPx: number, minPx: number): number` (largest font size that fits, never below `minPx`).
  - `loadAssets(themes: Theme[], countries: Country[]): Promise<Assets>` with `Assets = { flags: Map<string, ImageBitmap>; fontsOk: boolean; warnings: string[] }`; a failed font sets `fontsOk=false`, adds a warning, and uses `sans-serif`; a missing flag throws `AssetError`.
  - `drawFrame(ctx: CanvasRenderingContext2D, f: { timeline: Timeline; theme: Theme; assets: Assets; backgroundOnly?: boolean }, t: number): void` — pure function of `(f, t)`; no `Date.now`, no `Math.random`.
- Drawers by theme value: background `pattern|animated-gradient|texture|bokeh|gradient|grid`; timer `bar|ring|pulse|hourglass|numeric|flip`; reveal `wipe|pop|confetti|shake|flip|slide`; each is a function of `t`.

- [ ] **Step 1: Write failing unit tests:** `fitText` shrinks "Saint Vincent and the Grenadines" below the size that fits "Chad" and never returns below `minPx`; layout rects: every rect has `y ≥ 220`, `y + height ≤ 1920 − 240`, `x + width ≤ 1080 − 160`.
- [ ] **Step 2: Write failing browser spec** `tests/browser/render.spec.ts` against `/debug/frame?theme=<id>&seed=<s>&t=<sec>`: (a) golden screenshots (`toHaveScreenshot`) for themes `arctic-ice` and `retro-arcade` at hook, question, reveal, Q10 timer and outro times; (b) **safe-zone:** for all 15 themes at question and reveal times, pixels in the top 200, bottom 240 and right 160 margins equal the same frame drawn with `backgroundOnly: true`; (c) **long names:** for the three longest country names in the data, in all 15 themes, the reveal text's measured width ≤ the card width; (d) rendering the same `t` twice yields identical pixels; (e) with a font URL forced to 404, the page renders with `sans-serif` and shows the warning text instead of throwing.
- [ ] **Step 3:** Run `npx vitest run tests/unit/{layout,text}.test.ts` and `npx playwright test tests/browser/render.spec.ts` → FAIL.
- [ ] **Step 4:** Implement `theme.ts`, `layout.ts`, `text.ts`, the three drawer modules, `index.ts`, and the debug route. Background motion and timers derive only from `t`. Draw order: background, header, flag card with the flag SVG bitmap, timer, reveal, progress dots, safe-zone overlay only when `?safe=1`.
- [ ] **Step 5:** Run unit tests → PASS. Run the browser spec once with `--update-snapshots`, inspect the screenshots by eye for the two themes (layout, legibility), then re-run → PASS.
- [ ] **Step 6:** Commit `feat: deterministic canvas renderer with safe-zone tests`.

---

### Task 8: Audio (synth and mixer)

**Files:**
- Create: `src/engine/audio/{music,synth,mixer}.ts`, `tests/unit/music.test.ts`, `tests/browser/audio.spec.ts`

**Interfaces:**
- Produces: `parseMusicMood(mood: string): { bpm: number; family: 'piano-bells'|'chiptune'|'synthwave'|'orchestral'|'acoustic'|'ambient'|'pop' }` (bpm from `"<n> bpm"`, family by keywords: chiptune/8-bit→chiptune, synthwave/electronic/lo-fi→synthwave, orchestral/cinematic→orchestral, acoustic/folk/ukulele→acoustic, ambient→ambient, piano/bells→piano-bells, else pop); `loadClips(manifest: ClipManifest, ctx: BaseAudioContext): Promise<Map<string, AudioBuffer>>`; `mixAudio(timeline: Timeline, clips: Map<string, AudioBuffer>, theme: Theme): Promise<AudioBuffer>` (stereo, 48 kHz, length = `ceil(timeline.duration × 48000)`); synthesized `tick`, `heartbeat`, `chime`, `whoosh`; music bed ducked by about 8 dB while any voice clip plays; segments of a voice cue are placed back-to-back with 40 ms gaps.

- [ ] **Step 1: Write failing tests:** `music.test.ts` — for all 15 themes `parseMusicMood(theme.music.mood)` returns a finite bpm between 80 and 140 and a family. `audio.spec.ts` (browser) — mixing a timeline for a fixed seed gives a buffer of the right length, peak between 0.05 and 0.98, no NaN, RMS during a reveal voice cue above RMS of silence, and RMS of music alone during a voice cue about 8 dB below music alone elsewhere.
- [ ] **Step 2:** Run → FAIL. Implement the modules.
- [ ] **Step 3:** Run → PASS. Commit `feat: offline audio mixer with synthesized music and effects`.

---

### Task 9: Encoder and export guard

**Files:**
- Create: `src/engine/export/{support,encoder}.ts`, `tests/browser/export.spec.ts`

**Interfaces:**
- Produces: `detectSupport(): Promise<{ ok: true } | { ok: false; reason: string }>` (checks `VideoEncoder.isConfigSupported` for `avc1.640028` at 1080×1920 and `AudioEncoder.isConfigSupported` for `mp4a.40.2` at 48 kHz stereo); `exportVideo(opts: { timeline: Timeline; theme: Theme; assets: Assets; audio: AudioBuffer; onProgress?: (p: number) => void; signal?: AbortSignal }): Promise<Blob>` (30 fps, frames from `drawFrame` on an `OffscreenCanvas`, `mp4-muxer` with `fastStart: 'in-memory'`); `class ExportBusyError extends Error {}`; `class AssetError extends Error {}`. Rules: reject immediately with `ExportBusyError` if an export is running; throw `DurationError` if `timeline.duration > 59`; throw `AssetError` before encoding if any flag bitmap used by the timeline is missing; on encoder error retry once at half bitrate, then rethrow with the seed in the message; abort closes both encoders and clears the busy flag.

- [ ] **Step 1: Write failing browser spec** `export.spec.ts`: (a) export a fixed seed, save the blob, run `ffprobe -show_streams -of json` and assert width 1080, height 1920, `codec_name` `h264` and `aac`, duration ≤ 59, frame rate 30; (b) call `exportVideo` twice without awaiting → second rejects `ExportBusyError`, first still completes; (c) abort mid-export, then run a complete export successfully; (d) a timeline with `duration` 61 rejects with `DurationError` before any frame is drawn; (e) removing a needed flag bitmap rejects `AssetError`.
- [ ] **Step 2:** Run → FAIL. Implement `support.ts`, `encoder.ts`.
- [ ] **Step 3:** Run `npx playwright test tests/browser/export.spec.ts` → PASS.
- [ ] **Step 4:** Commit `feat: WebCodecs MP4 encoder with export guards`.

---

### Task 10: UI (generator, preview, export, batch)

**Files:**
- Create: `src/app/components/{Controls,Preview,ExportPanel}.tsx`; Modify: `src/app/page.tsx`
- Test: `tests/browser/app.spec.ts`

**Interfaces:**
- Consumes: `buildQuiz`, `buildTimeline`, `buildMetadata`, `loadAssets`, `loadClips`, `mixAudio`, `drawFrame`, `exportVideo`, `detectSupport`.
- Produces: page behavior — Controls: theme select (15 + "Random"), seed text with "New seed" button, part number (1–99), "Region twist" checkbox. Preview: 9:16 canvas scaled to the window, play/pause/scrub with synced audio from the mixed buffer, safe-zone overlay toggle. ExportPanel: "Export MP4" with progress and Cancel; downloads `flags-part<N>-<seed>.mp4` and `flags-part<N>-<seed>.txt` (title, description, hashtags, pinned comment); batch box "N random videos" exports sequentially. Unsupported browser: message "Open in Chrome or Edge" and Export disabled.

- [ ] **Step 1: Write failing browser spec** `app.spec.ts`: page loads with a visible canvas; setting seed `demo`, theme `retro-arcade`, clicking Export produces a download named `flags-part1-demo.mp4` of size > 500 KB plus a `.txt` containing `#shorts`; Cancel during export leaves Export clickable again; with `VideoEncoder` deleted via `addInitScript` the page shows "Open in Chrome or Edge" and Export is disabled; changing the seed changes the displayed first country but reloading with the same seed shows the same one.
- [ ] **Step 2:** Run `npx playwright test tests/browser/app.spec.ts` → FAIL. Implement components; load assets and clips once on mount and show warnings from `Assets.warnings`.
- [ ] **Step 3:** Run → PASS. Commit `feat: generator UI with preview, export and batch`.

---

### Task 11: Build pipeline, docs and deployment

**Files:**
- Modify: `package.json` (`build` script), `README.md` (replace the old prototype readme), `.gitignore`
- Create: `docs/how-to-add-content.md`

**Interfaces:**
- Produces: `npm run build` = `build:data` → `check:assets` → `next build`; fails if any step fails. `out/` is the deployable folder.

- [ ] **Step 1: Write failing check:** `tests/unit/build.test.ts` runs `npm run check:assets` against a temp copy of the manifest missing one key and asserts a non-zero exit code.
- [ ] **Step 2:** Run → FAIL. Wire the scripts so the test passes; confirm `npm run build` succeeds on the real data and produces `out/`.
- [ ] **Step 3:** Rewrite `README.md` (what it is, how to run, supported browsers) and write `docs/how-to-add-content.md` (add a voice line → `npm run tts`; change a theme; add a country; the `fixes.json` format).
- [ ] **Step 4:** Run the full suite: `npm test` and `npm run test:browser` → all PASS. Commit `chore: build pipeline and docs`.
- [ ] **Step 5:** **Ask the user before deploying** (external, public action). On approval deploy `out/` as a static site to Vercel and report the URL.

---

## Self-review notes

- **Spec coverage:** goal/success criteria → Tasks 9, 10; architecture units → Tasks 5, 7, 8, 9; v1 format, ramp, bands → Task 5; voice → Tasks 4, 5; layout/safe zone → Task 7; variety (themes, twist, lines, part) → Tasks 5, 6; data pipeline and `fixes.json` → Task 2; TTS → Task 4; flags/fonts → Task 3; error handling → Tasks 7, 9, 10; testing (unit, golden frames, ffprobe smoke, safe-zone) → Tasks 2–10; hosting → Task 11.
- **Deviations from the spec, deliberate:** voice lines are generated as **segments** (text pieces plus separate country/number clips, joined with 40 ms gaps) instead of one clip per line × country, which would need about 2,000 clips; a typical video lands near **55 s** (difficulty-up slots add about 2.4 s to the spec's 52 s), still under the 59 s limit.
