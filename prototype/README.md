# ShortsQA Studio

A browser-based editor for creating vertical quiz videos for YouTube Shorts, TikTok, and Instagram Reels.

## Features

- 9:16, 1080 × 1920 canvas-based video composition
- Multiple questions per project, with add, duplicate, and delete controls
- Templates for math, flags, trivia, mystery reveals, and blank quizzes
- Four answer choices and configurable correct answer
- Per-question countdown and answer reveal
- Five visual themes and optional sound effects
- Image URLs, two-letter country flag codes, and local image uploads
- Live preview, video recording, and PNG thumbnail export
- JSON project import/export and browser autosave
- Optional platform safe-zone overlay

## Run locally

This is a standalone HTML application. Open `index.html` in a modern browser, or serve the repository with any static web server:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

No build step or backend is required. Tailwind is not required at runtime; the interface uses local CSS. Google Fonts are loaded from Google Fonts when online.

## Create a video

1. Open `index.html`.
2. Choose a template or edit the question fields.
3. Add more questions to create a multi-round quiz.
4. Select a theme, footer text, countdown, and reveal duration.
5. Use **Preview quiz** to watch the sequence.
6. Use **Render & export video** to record the canvas and download the resulting file.

The export format is selected from codecs supported by the current browser. Chromium browsers typically export WebM; MP4 is used only when the browser reports a compatible MP4 MediaRecorder codec. The export is rendered at 1080 × 1920 with a 60 FPS canvas capture request. Actual frame rate and codec support depend on the device and browser.

## Project backup

Use **Export JSON** to save a portable project file. **Import JSON** restores a previously exported project. The editor also autosaves the current project in the browser's local storage.

## Notes and limitations

- External images must be reachable by the browser. Some image hosts block cross-origin canvas access; use a local upload when an image cannot be exported.
- Video recording requires browser support for `HTMLCanvasElement.captureStream` and `MediaRecorder`. Use a current desktop version of Chrome or Edge for the most predictable results.
- This is a client-side tool: projects and uploaded images are kept in the browser and are not sent to a server.
