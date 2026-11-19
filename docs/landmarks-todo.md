# Landmarks quiz: status and what is left

Done: engine (`pickLandmarks`), UI card, photo card rendering with slow zoom, voice clips, unit tests, photo credits in the exported .txt.

## Photos
- Source: lead image of each landmark's English Wikipedia article (via Wikimedia Commons), licences CC0 / CC BY / CC BY-SA / public domain. Author + licence are in `data/landmark_credits.json`; the export .txt lists them for the used photos ("add to the description"; CC BY and CC BY-SA require attribution).
- Only landmarks that have a lead photo are used: **104 of 298** (45 easy, 21 medium, 22 hard, 16 impossible; 66 countries).
- Fetch tool: `npx tsx tools/landmarks/fetch-images.ts --lead` (resumable; skips landmarks that already have a lead photo). Wikimedia throttles with HTTP 429, so it is slow; rerun it in chunks (`--limit 50`).

## Left to do
1. Get lead photos for the other ~194 landmarks (rerun the fetch tool; some have no usable lead image: those need a hand-picked Commons file).
2. Landmarks that currently fail the filters (portrait, non-JPEG, unclear licence): hand-pick a file and add it to `data/landmark_credits.json`.
3. Look through every photo once (a recognizable, landscape photo of the landmark itself, not an interior or detail shot).
4. More variety: with 104 photos the same landmarks repeat sooner than with 298.
5. Voice: the landmark name is not spoken (only on screen); the reveal says the country.
6. Reveal could show the country's flag next to the photo.
7. Playwright snapshot test for a landmarks frame.
8. Contact-sheet tooling: ffmpeg `tile` dropped frames, so use a small HTML page instead.
