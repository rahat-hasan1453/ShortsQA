# Shorts Quiz Generator

A static website that builds a YouTube Shorts quiz video entirely in your browser and downloads it as an upload-ready MP4 (1080×1920, H.264 + AAC, under 59 seconds), plus a text file with the title, description, hashtags and pinned comment.

Version 1 makes one format: **10 Flags Rapid** (three easy, three medium, three hard flags, then one impossible one).

## Use it

```bash
npm install
npm run dev        # http://localhost:3000
```

Pick a theme, a seed and a part number, press **Play** to preview, then **Export MP4**. The same seed gives the same quiz. **Export batch** makes several videos in a row with random seeds and rising part numbers (allow multiple downloads in the browser).

**Browser:** Chrome or Edge on desktop. Export needs WebCodecs (H.264 and AAC encoding); other browsers show "Open in Chrome or Edge".

Page URL options: `?seed=abc&theme=retro-arcade&part=3&twist=1`.

## Build and deploy

```bash
npm run build      # merges and validates data, checks voice clips, then builds out/
```

`out/` is a plain static site (Vercel, Netlify, any web server). There is no server code.

## Tests

```bash
npm test               # unit tests (Vitest)
npm run test:browser   # golden frames, safe zone, audio, export, UI (Playwright, needs Google Chrome)
```

## How it works

`QuizBuilder` (seed → quiz) → `Timeline` (exact seconds for every scene and sound) → `Renderer` (one pure `drawFrame(t)`, shared by preview and export) + `AudioMixer` (offline mix of voice, synthesized music and effects) → `Encoder` (WebCodecs + mp4-muxer).

Voice clips are generated ahead of time with Edge TTS (voice `en-US-JennyNeural`) and committed in `public/audio/`. Flags come from the MIT-licensed `flag-icons`; fonts from `@fontsource` (OFL).

Design spec: `docs/superpowers/specs/2026-11-09-shorts-quiz-generator-design.md`. Plan: `docs/superpowers/plans/2026-11-09-shorts-quiz-generator.md`. Changing content: `docs/how-to-add-content.md`. The first prototype is kept in `prototype/`.
