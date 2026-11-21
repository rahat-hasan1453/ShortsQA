# Long Video (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (owner chose native execution). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The "Long 16:9" switch works. It makes a 1920×1080 quiz video of 30 questions (owner changed from 40 on 2026-11-22), using the same engine as Shorts, and exports it to disk without holding the whole MP4 in memory.

**Architecture:**
- A `profile` ("short" | "long") on `QuizSpec` drives the question count, the timing, the frame size and the layout.
- The existing drawing helpers take their rectangles as parameters, so a new `render/landscape.ts` can place them on a 16:9 layout: the card on the left; the header, A–D options and timer bar on the right; a progress strip along the bottom.
- Long exports stream MP4 chunks to `POST /api/render/<id>`, which writes `output/<id>.mp4` and serves it back for download.

**Tech Stack:** as phase 1; `mp4-muxer` StreamTarget.

**Spec:** `docs/superpowers/specs/2026-11-22-usa-gk-studio-design.md` §5 (Long video) and §8 (metadata: chapters, thumbnail). Owner's order: phase 3 before phase 2.

## Global Constraints

- Long video timing: a **5 s timer** (6 s on the last question) and **about 40 questions**, with ask, timer, reveal and fact for each question. Tune for **6–8 minutes**, but **never pad**; a shorter video is acceptable. The hard maximum is **510 s (8.5 min)**.
- The long frame is **1920×1080**. Shorts stay **1080×1920**, and their timing, layout and golden snapshots must not change.
- The long answer style is always **options A–D** (a 1–10 list cannot hold 40 questions).
- Long titles and hashtags carry **no `#shorts`**, and the description gets **chapters**: YouTube timestamps for Intro and each level, starting at 0:00.
- The long thumbnail is **1280×720 JPG**, saved next to the MP4.
- Interim content: all 8 existing quiz types. USA presets come with phase 2.

## Review Focus

1. **A quiz type whose pool is too small for 40 questions** (landmarks has one photo per country and only 16 "impossible" photos): the count drops, down to no fewer than 24. If even 24 is impossible, building fails with a clear message. Test in Task 2.
2. **Switching between Shorts and Long several times:** the preview, gallery thumbnails and answer style follow the shape each time, with no stale 9:16 thumbnails on a 16:9 quiz. Test in Task 5.
3. **Cancelling a long export halfway:** no half-written file is offered for download, and Export works again afterwards. Test in Task 4.
4. **Long text** (a long country name or capital, or a long fact) in the 16:9 option rows and fact panel: it fits without overflowing. Covered by the render test in Task 3, which uses the longest names.
5. **Very long timelines:** a 7-minute timeline must not be rejected by the Shorts 59 s limit anywhere (validate, prepare or the encoder). Test in Task 4.

---

### Task 1: Profile and frame size

**Files:** `src/engine/types.ts`, `src/engine/render/layout.ts`; test `tests/unit/profile.test.ts`

- Produces:
  - `type Profile = "short" | "long"`
  - `QuizSpec.profile?: Profile` (absent means short)
  - `frameSize(profile?: Profile): { w: number; h: number }`, giving 1080×1920 or 1920×1080
  - `LONG_W = 1920`, `LONG_H = 1080`
- [ ] Test: `frameSize()` and `frameSize("short")` give `{w:1080,h:1920}`; `frameSize("long")` gives `{w:1920,h:1080}`.
- [ ] Implement, run, commit.

### Task 2: Long quiz build and timeline

**Files:** `src/engine/quizBuilder.ts`, `src/engine/timeline.ts`, `src/engine/lines.ts`, `src/engine/types.ts` (Scene kind `"score"`); test `tests/unit/long.test.ts`

- Produces:
  - `bandCounts(profile)`: short gives `[3,3,3,1]`; long gives `[13,11,10,6]` (40 questions).
  - Every picker takes its counts as a parameter. When a band's pool is short, the long build takes what it can, and fails only below 24 questions.
  - `BuildInput.profile`. A long build forces `answerStyle: "options"`, allows up to 14 fun facts and targets ≤ 480 s.
  - Level-up lines come before the first question of each new band. A short build keeps its existing breakpoints `[3,6,9]`.
  - `slotValues().total` is the question count (10 for Shorts, so Shorts don't change).
  - Long timeline:
    - `TIMER_SEC_LONG = 5` and `TIMER_LAST_SEC_LONG = 6`
    - a `score` scene of `SCORE_SEC = 4` before the outro
    - `maxDuration(profile)` is 59 for short and 510 for long
- [ ] Tests:
  - For each of the 8 quiz kinds and 5 seeds, a long build has between 24 and 40 questions, `answerStyle` "options", `profile` "long", and a timeline duration between 180 and 510 s.
  - A flags long build has exactly 40 questions, a duration between 300 and 510 s, and exactly one `score` scene, placed just before `outro`.
  - Short builds are unchanged: the existing quizBuilder and timeline tests stay green.
- [ ] Implement, run the whole unit suite, commit.

### Task 3: 16:9 renderer

**Files:** `src/engine/render/index.ts`, `src/engine/render/background.ts`, `src/engine/render/timer.ts`, new `src/engine/render/landscape.ts`; test `tests/browser/long.spec.ts`

- Make these helpers take their rectangles as parameters, with defaults equal to today's values: `drawHeader(box)`, `drawOptions(rows)`, `drawTimer(box)`, `drawFactPanel(panel)`, `drawHook(box, sub)`, `drawBackground(…, w, h)`. Export the ones `landscape.ts` needs.
- `LANDSCAPE` rects inside a 64 px margin:
  - `card` {x:96,y:180,w:820,h:620}
  - `header` {x:980,y:150,w:844,h:110}
  - `rows` {x:980,y:300,w:844,h:104,gap:20,count:4}
  - `bar` {x:980,y:780,w:844,h:20}
  - `progress` {x:96,y:900,w:1728,h:28}
  - `hook` {x:260,y:260,w:1400,h:420}
  - `fact` {x:980,y:300,w:844,h:500}
- `drawFrame` sends `spec.profile === "long"` to `drawLandscapeFrame`.
- The score scene says "HOW MANY DID YOU GET?" and shows four tier pills by score out of N: Beginner (≤ 30 %), Smart (≤ 60 %), Expert (≤ 85 %), Genius.
- [ ] Browser test: on `/debug/frame?profile=long&seed=demo`, render one frame of each scene kind for a long flags quiz and a long capitals quiz. Nothing throws, every content pixel lies inside the 1920×1080 frame, and the longest country name in an option row fits (`measureText` ≤ row width minus padding).
- [ ] Short golden snapshots (`render.spec.ts`) stay unchanged.
- [ ] Implement, run, commit.

### Task 4: Streaming export to disk

**Files:** `src/engine/export/encoder.ts`, new `src/app/api/render/[id]/route.ts`; tests `tests/unit/render-route.test.ts`, `tests/browser/long.spec.ts`

- `exportVideo` sizes the video from `frameSize(spec.profile)` and validates against `maxDuration(spec.profile)`. With `o.sink`, it uses `StreamTarget({ chunked: true, onData })` and calls `await sink(data, position)`. Without `o.sink`, it returns a Blob as it does today.
- Route:
  - `POST /api/render/<id>?pos=<n>` (raw body) writes at that position in `output/<id>.mp4.part`.
  - `POST /api/render/<id>?done=1` renames the file to `.mp4`.
  - `POST /api/render/<id>?thumb=1` writes `<id>.jpg`.
  - `GET /api/render/<id>` streams the finished MP4 as an attachment; it returns 404 while only a `.part` exists.
  - `id` must match `/^[a-z0-9-]{1,80}$/`.
- [ ] Unit test: the route writes chunks at their positions, out of order, into one file; `done` renames it; GET before `done` gives 404; a bad id gives 400.
- [ ] Browser test: a long timeline of 7 minutes passes `validate` and is not rejected. Cancelling a long export leaves no `.mp4` and Export is enabled again.
- [ ] Implement, run, commit.

### Task 5: UI and metadata

**Files:** `Controls.tsx` (`Settings.shape`), `ShapeSwitch.tsx`, `page.tsx` (`?shape=long`), `prepare.ts`, `Preview.tsx`, `TemplateGallery.tsx`, `ExportPanel.tsx`, `src/engine/metadata.ts`, `globals.css`; tests `tests/browser/shell.spec.ts`, `tests/unit/metadata.test.ts`

- ShapeSwitch is interactive. Long switches the canvas to 16:9 and hides Answer style, replacing it with the note "Long videos always use A–D options".
- The gallery thumbnail size follows the profile: 384×216 for long.
- A long export streams to `/api/render/<fileBase>`, uploads the thumbnail, then downloads the file through `GET`.
- Long metadata:
  - the title's `{n}` becomes the question count
  - `#shorts` is removed from the hashtags
  - the description ends with a `Chapters:` block built from the scenes (`0:00 Intro`, then `m:ss Easy` / `Medium` / `Hard` / `Impossible` at each band's first timer scene)
- [ ] Tests:
  - Switching to Long gives a 16:9 canvas, hides Answer style and gives a 16:9 gallery thumbnail; switching back to Shorts restores everything.
  - Long metadata has no `#shorts` and has chapters starting with `0:00`.
- [ ] Implement, run, commit.

### Task 6: Verify

- [ ] Run the full unit and browser suites.
- [ ] Do one real long flags export with Michael's voice through the headless script. Check that the duration is between 300 and 510 s, that it is 1920×1080 h264+aac, and that a frame looks right. Then do a final review.
