# USA GK Quiz Studio — design

Date: 2026-11-22 · Status: draft for approval

## Intent

ShortsQA is a flag/country Shorts maker today. The owner wants it to become a complete production system for a **USA General Knowledge** YouTube channel, with **monetization** as the goal. The work should be automated end to end: an agent picks a planned video, renders it, gets its title, description and tags from the site, uploads it to YouTube without any manual editing, and records that it did. A tracker shows what was made, what is uploaded and what is left. The channel and its competitors are described in the owner's notes (`youtube_quiz_channel_and_generator_chat_notes.md`).

## Goals

1. **PIN login** (the PIN is kept only in `.env.local`, never in the repo) so outsiders cannot use the site.
2. **Voice picker** that lists several open-source voices with a sample play button. It covers the Kokoro voices and **Chatterbox**, which is installed in `~/tts-test/env` (`chatterbox_tts 0.1.7`, supports voice cloning and an emotion/exaggeration control).
3. **Long videos of 6–8 minutes** in 16:9 at 1920×1080, built on the same render flow as Shorts.
4. **Template gallery** like YAQUIZO's: a thumbnail card per template, with category filters.
5. **Font picker with previews**: a searchable list in which each font name is drawn in its own font, plus a sample-text preview.
6. **New USA question types** (owner's list):
   - Long: USA Geography Quiz, American History Quiz, USA Brands & Logos, General Knowledge Quiz, US Culture & Traditions, USA Mixed Trivia, Weekly Mega Quiz.
   - Shorts: 5 US State Capitals, Guess the US President, Guess 5 American Brands, 3 Science Questions, Guess the American Food, 5 Hardest USA Questions, Perfect Score Challenge.
7. **Per-video metadata** for upload: title, description, tags, hashtags and pinned comment, written in the style competitors use. It is saved as machine-readable JSON.
8. **Plan / publish tracker**: every planned, rendered and uploaded video, with its YouTube link.
9. **Every render is different.** The same video is never rendered twice.

## Non-goals

- The YouTube upload itself. The agent does it from the JSON contract described below.
- Cloud rendering, cloud TTS and a cloud database.
- Analytics dashboards and YouTube API reads (roadmap phase 4 in the notes).
- A full YAQUIZO-style free-form canvas editor (dragging elements, per-element motion settings).

## Anti-goals (a failure even if it works)

- Template-identical, mass-produced uploads that fail YouTube's "inauthentic / repetitive content" review. Variety and facts are features, not polish.
- Wrong answers in a fact quiz. Only verified questions may be rendered.
- Anything that costs money per video.

## Constraints found in the code

- `next.config.ts` has `output: "export"`, so the site is fully static. PIN login, API routes and file writes all need **server mode** (`next start`). In Next 16, middleware is called **`proxy.ts`** (see `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).
- Voice is **pre-generated**:
  - `tools/tts` renders every line to `public/audio/<hash>.mp3`, listed in a single `manifest.json`, with one voice (Kokoro `af_heart`).
  - A line with no clip cannot be spoken, and changing the voice deletes the other voice's entries.
- `timeline.ts` throws when a video is over 59 s.
- `render/layout.ts` hard-codes `W = 1080, H = 1920`.
- `export/encoder.ts` builds the whole MP4 in memory (`ArrayBufferTarget`). That is fine for 60 s, but too much memory for 8 minutes.
- `quizBuilder` is built around 10 questions in fixed bands (3 easy, 3 medium, 3 hard, 1 impossible), with flag- or picture-centred cards.
- `metadata.ts` and `titles.json` already pick a title, description, hashtags and pinned comment, but only for the existing formats. There are no tags, and the output is a `.txt` file.
- The repo has no record of which videos were made.
- Generation costs nothing today: Kokoro runs locally, rendering happens in the browser, the music is CC0 and the photos come from Wikipedia. The paid Cartesia backend exists but is off.

## Approaches considered

**Where things run**
- **A. Local-first (chosen).** The site runs on the owner's Mac with `next start`. The tracker and question history live in local files and are read and written through the site's API. The agent drives the same site headlessly with Playwright, and TTS runs locally when it is needed. Trade-off: the site is reachable only while the Mac is on; the PIN protects it if it is ever exposed over LAN or a tunnel.
- B. Hybrid: Vercel UI plus a cloud DB and blob storage, with the Mac as a worker. Rejected for now: more moving parts and some cost for little gain, since all the heavy work is already on the Mac. Moving from A to B later is possible because the tracker format stays the same.
- C. Cloud rendering. Rejected: the voice models run locally, and an 8-minute cloud render is slow and costs money.

**Who renders.** The agent renders through Playwright, using the same `drawFrame` and encoder the preview uses (chosen). Manual browser export stays available.

**How strict "different" is**
- **Question cooldown (chosen).** A whole video is never repeated: the fingerprint is blocked. A single question may come back only after a cooldown, 90 days by default. This keeps the question bank to a size that can be maintained, and it allows the notes' "Quiz Repurpose" idea (one long video split into Shorts).
- Never repeat a question. Rejected: it needs hundreds of new verified questions a week, and it rules out repurposing.

## Design

### 1. Server mode and PIN

- Remove `output: "export"`. The app runs with `next start` on a fixed local port; `.claude/launch.json` stays on `next dev` for development.
- Add a `/login` page with a PIN field. `POST /api/login` compares the entry with `STUDIO_PIN` from `.env.local` and sets an httpOnly cookie, signed with HMAC using `STUDIO_SECRET`, valid for 30 days.
- `src/proxy.ts` redirects any request without a valid cookie to `/login`, and returns 401 for `/api/*`. The matcher skips `/login`, `/api/login` and static assets.
- After 5 wrong PINs in 10 minutes from one IP, the login is blocked for 10 minutes (an in-memory counter).
- The agent signs in through the same login. There is no second secret.

### 2. Local data store

- `studio-data/` is gitignored:
  - `jobs.json` holds the tracker.
  - `question-usage.json` maps a question id to the job ids and dates it was used in.
  - `settings.json` holds defaults such as the cooldown days and the default voice.
- It is read and written only through API route handlers. Writes are atomic (write a temp file, then rename) and serialized by an in-process queue, so the UI and the agent cannot corrupt each other's writes.
- The question bank and title banks are content, so they are committed under `data/` and go through the existing `build:data` merge and validation.

### 3. USA question bank and text-question engine

- Source files are `data/incoming/usa_questions.partNN.json`, merged into `data/usa_questions.json`. Fields:
  - `id`, `category`, `question`, `answer`, `wrong` (3 items), `difficulty` (1–5)
  - `fact` (optional), `image` (optional)
  - `source` (URL), `verified` (boolean)
  - `spoken` (optional pronunciation)
- Categories: `geography`, `capitals`, `history`, `presidents`, `brands`, `general`, `culture`, `science`, `food`.
- The validator rejects:
  - a `wrong` list that does not have 3 unique items or that contains the answer
  - a missing `source`
  - duplicate question text
  - a `brands` item without an `image`

  Only `verified: true` items are selectable.
- **Authoring workflow (owner's decision): Claude drafts, the owner verifies.**
  - Claude writes drafts in batches per category into `data/incoming/usa_questions.partNN.json`. Each draft has a `source` URL and `verified: false`, and its distractors must be plausible and clearly wrong.
  - A `/questions` review page lists the unverified drafts with:
    - question, answer, the 3 wrong options and the fact
    - a source link
    - **Verify**, **Edit** and **Reject** buttons
  - The page writes changes back to the incoming file through an API route, then runs `build:data`.
  - Rejected items are deleted, and the reason is kept so later drafts avoid the same mistake.
  - The tracker shows how many verified questions each category has against what the week's plan needs.
- New `QuizKind` values `usa-*` share a **text-question card**: question text in the card, options A–D, and a reveal that shows the answer and the fact.
  - `brands` **shows the logo** (owner's decision). Logos come from Wikimedia Commons, preferring files tagged public domain or "PD-textlogo" (below the threshold of originality). The file and its licence are recorded in a credits file, just like the landmark photos. The logo stays hidden behind the existing zoom/blur/pixel effects until the reveal, the same as in "What is it?". The quiz only shows the logo and names the brand; it never alters the logo or implies endorsement. Risk: a brand owner could still file a claim, so any brand that complains can be marked `blocked`.
  - `presidents` uses public-domain official portraits.
  - **Map questions (`map` category, owner's request).** These follow the **static-map** technique from the installed `remotion-maps` skill: a pre-rendered map image with markers drawn on top. The site renders on its own canvas, not in Remotion, so it takes only the technique, not Remotion itself.
    - An offline tool `tools/maps/build-maps.ts` (like `tools/shapes`) builds each map image ahead of time:
      - outlines from Natural Earth `admin_1_states_provinces` (already downloaded in `~/YouTube/usa-geo-shorts/ne`)
      - satellite imagery (owner confirmed) from **Sentinel-2 / EOX s2cloudless 2016** (CC BY 4.0, credit required, the same source and rules as usa-geo-shorts)
    - The canvas draws highlights, pins and labels live, so a reveal can animate them.
    - Question shapes:
      - **Which state is highlighted?** A US map with one state filled.
      - **Name the state by its outline**, like the existing country-shape quiz.
      - **Where is this?** A pin on the map; the options are states or cities.
      - **Satellite zoom: which state is this?** Zoomed satellite tile, revealed by zooming out.
      - **Which state borders X?** Neighbour states, computed from the geometry.
    - Map questions are generated from the geometry plus a small facts table (no hand-written answer per question). They still go through the `/questions` verify step.
  - `food` uses CC photos with credits, through the same credit path as landmarks.
- Each owner format becomes a **format preset**: categories, question count, difficulty mix and shape (short or long).
  - Short presets: 5 State Capitals (5 from `capitals`), Guess the US President (5 from `presidents`, with image), Guess 5 American Brands (5 from `brands`, logo hidden by zoom/blur until the reveal), 3 Science Questions (3 from `science`), Guess the American Food (5 from `food`, with image), 5 Hardest USA Questions (5 at difficulty 5, mixed categories), Perfect Score Challenge (10 mixed, rising difficulty).
  - Long presets: Geography, History, Brands, General Knowledge, Culture, Mixed, and Weekly Mega (mixed, the most questions).
- `quizBuilder` gets a generic `pickFromBank(preset, seed, usage, cooldown)` in place of the fixed 10-question bands. Difficulty rises across the video, and level-up lines go at the preset's breakpoints.
- The existing flag and country quizzes keep working unchanged.

### 4. Voices

- `tools/tts/voices.json` lists the voices with `{ id, label, engine: "kokoro" | "chatterbox", voice | refAudio, gender, accent, sampleText }`. It starts with a handful of Kokoro voices (for example `af_heart`, `af_bella`, `am_michael`, `am_adam`, `bf_emma`) plus a Chatterbox default voice.
- Clips are stored per voice in `public/audio/<voiceId>/` with that voice's own `manifest.json`. The current clips move to `public/audio/af_heart/`.
- Generating for one voice never deletes another voice's clips.
- `tools/tts/generate.ts` accepts `--voice <id>` and `--texts <file>`.
  - Kokoro runs through the existing `speak.py`.
  - A new `chatterbox/speak.py` runs in `~/tts-test/env` (the path comes from config), with an exaggeration setting per line type.
- **Ensure step:** before a job renders, the server works out every line the job needs, and `POST /api/tts/ensure` generates the missing clips for that job's voice (the local Python is spawned in the background). The job waits until the step finishes. Long-video questions are new text every time, so this step is required.
- The voice picker UI shows cards with a label, gender and accent tags and a ▶ sample button, following the Canva AI Voice and Mindtrip patterns found on Mobbin. Samples are generated once per voice.

### 5. Long video (same flow, landscape)

- A **render profile** (`short` or `long`) sets the canvas size, layout set, timing constants and maximum duration (59 s or 8.5 min). `layout.ts` becomes per-profile, and the 16:9 layout puts the question on the left and the options on the right, or stacks them. The builder chooses, keeping safe margins.
- Long-video timing per question: ask, a 5 s timer, the reveal, then the fact or explanation. That comes to about 10–12 s each, so 32–40 questions fit 6–8 minutes. The video adds a running score prompt, section/level cards and a final **score screen** with tiers (Beginner, Expert, Genius).
- Duration is tuned to the preset's target, not padded to 8 minutes. If the target cannot be reached without padding, the video comes out shorter.
- The encoder switches to a **streaming target**: chunks are POSTed to `POST /api/render/<jobId>/chunk`, which appends them to `output/<jobId>.mp4` on disk. The `fastStart` moov is handled by `mp4-muxer`'s fragmented or streaming mode. Shorts may use the same path.
- Each long video gets a thumbnail: a rendered still with the hook text, saved as `output/<jobId>.jpg`.

### 6. Template gallery

- The `Template` dropdown is replaced by a grid of cards. Each card has a thumbnail made by `drawFrame` on a small offscreen canvas at a representative moment (question open), plus the theme name and its mood or category.
- Filter chips come from `theme.mood` and `bestFor` (Popular, Bold, Elegant, Learning…), and there is a "Random" card. The selected card gets an outline. This is the same shape as YAQUIZO's Templates panel.
- Thumbnails are cached in memory for each profile, short or long.

### 7. Font picker

- The `Font` dropdown is replaced by a popover with:
  - a search field
  - groups: Display, Sans, Serif, Handwritten, Mono
  - each family name drawn in its own font (`@font-face` already ships from `public/fonts`)
  - a sample line in the chosen font at the top
  - "Template default" as the first entry
- Patterns: Canva's and Luma's font lists on Mobbin. The fonts are loaded lazily as the list scrolls.

### 8. Metadata for the agent

- New title banks `data/incoming/usa_titles.partNN.json` are organised per preset. They hold titles, series titles, descriptions, pinned comments, tag sets and hashtag sets.
- Titles are modelled on **competitor title patterns**: the builder pulls recent top titles from the channels in the notes (through vidIQ where available) and writes templates in those styles, such as "Only 1% Can Answer All 40 USA Questions 🇺🇸" or "How Much Do You Know About America? (Part {part})". Competitor titles are never copied word for word.
- `buildMetadata` outputs `output/<jobId>.json`:
  - `title` (70 characters or fewer), `description`, `tags` (500 characters or fewer in total), `hashtags` (3)
  - `pinnedComment`, `categoryId: "27"` (Education), `madeForKids: false`, `language: "en"`
  - `videoFile`, `thumbnailFile` (long videos), `credits`
  - `chapters` (long videos: YouTube timestamps per section, also written into the description)
- The `.txt` download stays for manual export.

### 9. Tracker (plan / publish checklist)

- A job record:
  - identity: `id`, `kind` (`short` | `long`), `preset`, `seed`, `voiceId`, `themeId`, `font`
  - `status`: `planned` → `rendering` → `rendered` → `uploaded`, or `failed`
  - `fingerprint`, `questionIds`
  - files: `files`
  - YouTube: `youtubeUrl`, `scheduledFor`, `uploadedAt`
  - `repurposeOf` (optional), `error`
  - `createdAt`, `updatedAt`
- `/tracker` page:
  - counts by status
  - a list filterable by kind, preset and status
  - per-row links to the files and the YouTube video
  - **"Make a week's plan"**: choose the long and short counts and their presets, and it creates `planned` jobs that already satisfy the uniqueness rules
  - **"Split into Shorts"** on a long video: creates linked short jobs from its questions
- Layout pattern: Buffer's list and calendar on Mobbin, starting with the list view only.
- Agent API, all behind the PIN cookie:
  - `GET /api/jobs?status=planned`
  - `POST /api/jobs` (create)
  - `PATCH /api/jobs/:id` (status, youtubeUrl, error)
  - `GET /api/jobs/:id`

### 10. Uniqueness

- `fingerprint = sha256(kind + preset + ordered questionIds)`. A job whose fingerprint already exists in `jobs.json` cannot be created; the system re-picks with a new seed, up to N tries, then fails with a clear message.
- Question selection order:
  1. never-used questions
  2. questions whose last use is older than the cooldown (90 days, configurable), oldest first
  3. otherwise a clear error: "need X more verified questions in category Y"
- The seed also randomises the question order, option order, template (when set to random), music track and voice (when set to random). Two renders therefore differ in look even when content overlaps after the cooldown.
- Repurposed Shorts (`repurposeOf`) are exempt from the cooldown with their own parent only.
- Question usage is recorded when a job is **created**, so planned jobs cannot claim the same questions twice.

### 11. Agent render flow

`npm run agent:render -- --job <id>` (or `--next` to take the oldest planned job):

1. Make sure `next start` is up, then launch headless Chromium with Playwright (WebCodecs needs a Chromium with H.264; check `detectSupport`).
2. Log in with the PIN.
3. Open `/render?job=<id>`. That page runs the ensure-voice step, `prepare`, `mixFor` and the streaming encoder, then writes the metadata JSON and the thumbnail.
4. Mark the job `rendered`, or `failed` with the error.

Uploads follow the owner's standing rule in `~/YouTube/CLAUDE.md`: nothing goes live until the owner taps **Approve in Telegram**. The intended uploader is therefore the existing `shortsflow-studio` bot, which uploads through the YouTube Data API. The uploader reads `output/<jobId>.json`, asks the owner for approval, uploads, then sends `PATCH /api/jobs/:id { status: "uploaded", youtubeUrl }`.

## Phasing (each phase is shippable)

1. **Studio basics:**
   - server mode and PIN
   - per-voice clip storage
   - voice registry and voice picker (Kokoro voices plus Chatterbox)
   - template gallery and font picker
2. **USA content pipeline:**
   - question bank, validator and text-question engine
   - the 7 short presets
   - metadata JSON with competitor-style titles
   - tracker with uniqueness and the cooldown
   - agent render script with the ensure-voice step
3. **Long video:**
   - render profiles and the 16:9 layout
   - long timing and the score screen
   - streaming encoder, thumbnail and chapters
   - long presets and Split into Shorts

## Left to the builder

- The exact 16:9 layout and the score-screen design (within the safe margins).
- The precise long-video timing constants, tuned so presets land in 6–8 minutes.
- Which Kokoro voices go in the first list (after listening).
- The thumbnail layout for long videos.
- The `mp4-muxer` streaming mode details.

## Risks

- **Content volume:** about 7 long and 14 short videos a week needs roughly 300+ new verified questions a week until the bank is large enough for the cooldown to recycle.
- **Chatterbox speed:** about 25 sampling steps per second on MPS, so a 40-question long video needs several minutes of TTS on its first render.
- **Monetization:** variety, facts and narration quality matter more than volume. The plan generator should mix presets and templates, not repeat one.
