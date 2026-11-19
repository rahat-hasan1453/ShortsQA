# What is it? quiz: status and what is left

Done: engine (`pickPictures`), three hiding effects (zoom out from one spot, blur, pixelate) that clear up during the 3 s timer, UI card, photos from Wikipedia lead images, voice clips for lines and answers, tests, photo credits in the export .txt.

## Photos
- Source: lead image of each item's English Wikipedia article (Commons licences CC0 / CC BY / CC BY-SA / PD); credits in `data/what_is_it_credits.json`.
- Fetch tool: `npx tsx tools/what-is-it/fetch-images.ts` (resumable, backs off on HTTP 429). Items without a usable lead image are skipped (about 1 in 5).
- **After every fetch run `npm run tts`**: each answer is spoken on the reveal, so it needs a clip. The app only offers pictures whose answer has a clip, so a missing clip just hides that picture. A unit test checks every photo has one.

## Left to do
1. Finish downloading the 1000 items (only the first batch is committed), then `npm run tts`.
2. Look through the photos once: reject ones that are a poor quiz picture (the item is not the main subject, a logo/diagram, etc.).
3. Items without a lead image: hand-pick a Commons file.
4. `half` and `silhouette` effects exist in the data (`bestFormats`) but are not implemented; those items use zoom.
5. Only difficulty 1-3 exist, so the "impossible" slot is a fourth difficulty-3 picture.
6. Reveal could also name the category; playwright snapshot for a what-is-it frame.
