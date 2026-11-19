# Country shape quiz: status and what is left

Done: outlines for all 197 countries (`public/shapes.json`, 820 KB), builder (bands from `shapeDifficulty`, wrong options from the same sub-region), outline rendering (white shape; the reveal fills it with the flag), UI card, voice clips, tests.

## Data
- Source: Natural Earth (public domain) through the `world-atlas` npm package (50m, with 10m for coarse tiny countries). Rebuild with `npx tsx tools/shapes/build-shapes.ts`.
- Far-flung territories are dropped (French Guiana, Alaska, Hawaii...), so France and the USA show the main land mass.
- 14 scattered-atoll countries are marked `ok: false` and never used (VU FM MH TO SB SC PW MU MV KI FJ CV BS TV): they would show as specks.

## Left to do
1. Eyeball more outlines (this was checked on about 30); `shapeDifficulty` comes from model-written data and is not fact-checked.
2. Hints during the timer (e.g. continent highlighted on a small globe) would make the harder ones fairer.
3. A playwright snapshot for a country-shape frame.
4. Disputed borders follow Natural Earth (Western Sahara, Crimea, Kosovo): check this is acceptable for the audience.
