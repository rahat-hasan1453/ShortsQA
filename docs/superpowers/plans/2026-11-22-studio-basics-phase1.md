# Studio Basics (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ShortsQA runs as a PIN-protected local server. It offers a choice of several open-source voices (Kokoro plus Chatterbox) with sample playback, a YAQUIZO-style template gallery with thumbnails, and a searchable font picker that shows each font.

**Architecture:**
- Drop the static export and run `next start`. A `src/proxy.ts` (Next 16's name for middleware) checks an HMAC-signed session cookie that `POST /api/login` issues for the right PIN.
- Voice clips move to one folder per voice (`public/audio/<voiceId>/`), each with its own manifest. A registry `tools/tts/voices.json` drives the generator, the checker and the picker.
- The gallery and the font picker are client components that reuse `drawFrame` and the existing font files.

**Tech Stack:** Next 16.4.5 (App Router, `proxy.ts`), React 19.3, Web Crypto (HMAC-SHA256), Vitest, Playwright (Chrome), Kokoro (`tools/tts/.venv-kokoro`), Chatterbox (`~/tts-test/env`, `chatterbox_tts 0.1.7`), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-22-usa-gk-studio-design.md` (sections 1, 4, 6, 7; phase 1 of "Phasing")

## Global Constraints

- PIN comes from `STUDIO_PIN` in `.env.local` (the owner's value, which lives only in `.env.local`), and the signing key from `STUDIO_SECRET`. Neither value may appear in client code or be committed.
- The session cookie is httpOnly, `SameSite=Lax`, and valid for **30 days**.
- Lockout: **5 wrong PINs within 10 minutes** from one IP blocks that IP for **10 minutes**.
- If `STUDIO_PIN` or `STUDIO_SECRET` is unset, login fails closed: it returns 500 with "Server PIN not configured", and nothing is reachable.
- Generating clips for one voice must never delete or alter another voice's clips.
- The existing 8 quiz types, `af_heart` as the default voice, and all current render snapshots must keep working unchanged.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md). The proxy docs are at `01-app/01-getting-started/16-proxy.md` and `01-app/02-guides/authentication.md`.
- UI hint text may stay Banglish, matching the current `Controls.tsx` style. Code and identifiers are English.

## Review Focus

1. **Tampered, expired or garbage cookie:** a person sees `/login`, not an error page or the app. Covered by a test in Task 1 (`verifySession` rejects) and Task 2 (browser).
2. **Correct PIN typed while locked out:** it is still refused until the block expires, and the message says how long to wait. Covered by a test in Task 1 and a browser check in Task 2.
3. **A voice is selected that has no clips yet** (Chatterbox before its long generation finishes): the picker shows it as "clips not generated" and it cannot be chosen. A `?voice=` URL pointing at it falls back to `af_heart` with a warning instead of crashing. Covered by a test in Task 5.
4. **A voice with partially generated clips:** `prepare` fails with an error naming the voice and the missing line, not a bare "no voice clip". Covered by a test in Task 3.
5. **Rapid template or font switching:** the preview shows the last choice, and thumbnails render in the background without freezing the page. Covered by a test in Task 6.

---

### Task 1: Session and lockout library

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/unit/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = "sqa_session"`
  - `SESSION_TTL_MS = 30 * 24 * 3600 * 1000`
  - `signSession(secret: string, now: number): Promise<string>` returns `"<expiresAtMs>.<base64url hmac>"`.
  - `verifySession(token: string | undefined, secret: string, now: number): Promise<boolean>`
  - `pinMatches(input: string, pin: string): boolean` (constant-time compare; trims whitespace)
  - `createLoginLimiter(opts?: { max?: number; windowMs?: number; blockMs?: number }): LoginLimiter`, where `LoginLimiter = { check(ip: string, now: number): { allowed: boolean; retryAfterMs: number }; fail(ip: string, now: number): void; reset(ip: string): void }`. The defaults are max 5, window 600000 and block 600000.
  - Use Web Crypto (`crypto.subtle`) so the same code runs in the proxy and in route handlers.

- [ ] **Step 1: Write the failing tests**

```ts
test("signed session verifies until it expires", async () => {
  const t = await signSession("s", 1000);
  expect(await verifySession(t, "s", 1000 + SESSION_TTL_MS - 1)).toBe(true);
  expect(await verifySession(t, "s", 1000 + SESSION_TTL_MS)).toBe(false);
});
test("wrong secret, tampered expiry, garbage and undefined are rejected", async () => {
  const t = await signSession("s", 1000);
  const [exp, mac] = t.split(".");
  expect(await verifySession(t, "other", 1000)).toBe(false);
  expect(await verifySession(`${Number(exp) + 1}.${mac}`, "s", 1000)).toBe(false);
  for (const bad of [undefined, "", "abc", "1.2.3", "x.y"]) expect(await verifySession(bad, "s", 1000)).toBe(false);
});
test("pinMatches is exact after trimming", () => {
  expect(pinMatches(" 123456 ", "123456")).toBe(true);
  expect(pinMatches("123457", "123456")).toBe(false);
  expect(pinMatches("", "123456")).toBe(false);
});
test("5 failures in 10 minutes block for 10 minutes, even for a correct PIN", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 5; i++) { expect(l.check("ip", i).allowed).toBe(true); l.fail("ip", i); }
  expect(l.check("ip", 10)).toEqual({ allowed: false, retryAfterMs: 600000 - 6 });
  expect(l.check("ip", 4 + 600000).allowed).toBe(true);
  expect(l.check("other", 10).allowed).toBe(true);
});
test("failures older than the window do not count", () => {
  const l = createLoginLimiter();
  for (let i = 0; i < 4; i++) l.fail("ip", 0);
  l.fail("ip", 600001);
  expect(l.check("ip", 600002).allowed).toBe(true);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: FAIL, "Cannot find module '../../src/lib/auth'"

- [ ] **Step 3: Implement `src/lib/auth.ts` with the signatures above**

The block starts at the fifth failure and lasts `blockMs` from that failure. `retryAfterMs` is the time left.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/unit/auth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat: signed session tokens and login lockout"
```

---

### Task 2: Server mode, login page, login route and proxy

**Files:**
- Modify: `next.config.ts` (remove `output: "export"` and keep `images.unoptimized`)
- Modify: `package.json`: `"start": "next start -p 3111"`
- Create: `src/proxy.ts`
- Create: `src/app/api/login/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `.env.example` with `STUDIO_PIN=` and `STUDIO_SECRET=`, no values
- Modify: `playwright.config.ts`: `webServer.env = { STUDIO_PIN: "111111", STUDIO_SECRET: "test-secret" }`; add a `setup` project that logs in and saves `tests/browser/.auth.json`; the `chrome` project depends on it and uses that `storageState`.
- Modify: `.gitignore`: add `tests/browser/.auth.json`, `studio-data/` and `output/`
- Modify: `README.md`: run instructions (`.env.local`, `npm run build && npm start`, open `http://localhost:3111`)
- Test: `tests/browser/auth.setup.ts`, `tests/browser/auth.spec.ts` (that spec runs with an empty `storageState`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `POST /api/login` takes the JSON body `{ pin: string }`. It answers:
    - `200 { ok: true }` and sets the cookie
    - `401 { error: "Wrong PIN" }`
    - `429 { error: "Too many tries. Try again in N minutes.", retryAfterMs }`
    - `500 { error: "Server PIN not configured" }`
  - The IP is read from `x-forwarded-for` (first entry), or `"local"` if that header is missing.
  - `src/proxy.ts` exports `proxy(request)` and `config.matcher = ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"]`. Without a valid session, `/api/*` gets a `401` JSON response and every other path redirects to `/login?next=<path>`.

- [ ] **Step 1: Write the failing browser tests** (`auth.spec.ts`, with `test.use({ storageState: { cookies: [], origins: [] } })`)

```ts
test("unauthenticated visit redirects to /login", async ({ page }) => {
  await page.goto("/?seed=demo");
  await expect(page).toHaveURL(/\/login\?next=/);
});
test("API without a session is 401", async ({ request }) => {
  expect((await request.get("/audio/af_heart/manifest.json")).status()).toBe(401);
});
test("garbage cookie still lands on /login", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "sqa_session", value: "1.abc", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
test("wrong PIN shows an error, right PIN opens the app at the requested page", async ({ page }) => {
  await page.goto("/?seed=demo");
  await page.getByLabel("PIN").fill("000000"); await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong PIN");
  await page.getByLabel("PIN").fill("111111"); await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/\?seed=demo/);
  await expect(page.locator("canvas")).toBeVisible();
});
test("lockout after 5 wrong PINs refuses the right PIN too", async ({ request }) => {
  const h = { "x-forwarded-for": "10.9.9.9" };
  for (let i = 0; i < 5; i++) expect((await request.post("/api/login", { data: { pin: "0" }, headers: h })).status()).toBe(401);
  const r = await request.post("/api/login", { data: { pin: "111111" }, headers: h });
  expect(r.status()).toBe(429);
  expect((await r.json()).error).toMatch(/Try again in 10 minutes/);
});
```

`auth.setup.ts` logs in with `111111` through the login form and writes `tests/browser/.auth.json`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test tests/browser/auth.spec.ts`
Expected: FAIL (there is no `/login` route, and the page loads without redirecting)

- [ ] **Step 3: Implement the config change, the proxy, the route and the page**

- The login page is a centred card with a numeric `inputMode` field labelled "PIN", an "Enter" button and a `role="alert"` error line. On success it navigates to `next` (relative paths only; anything else goes to `/`).
- The route keeps one module-level `createLoginLimiter()`.

- [ ] **Step 4: Run the auth tests, then the whole browser suite with the setup project**

Run: `npx playwright test`
Expected: all pass, including the existing `app`, `render`, `audio` and `export` specs, which now go through the stored login.

- [ ] **Step 5: Check the production build boots**

Run: `STUDIO_PIN=111111 STUDIO_SECRET=x npm run build && STUDIO_PIN=111111 STUDIO_SECRET=x npx next start -p 3112 & sleep 8; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3112/`
Expected: `307` (redirect to login). Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts package.json src/proxy.ts src/app/api/login src/app/login .env.example playwright.config.ts tests/browser/auth.setup.ts tests/browser/auth.spec.ts .gitignore README.md
git commit -m "feat: PIN login with signed session cookie, lockout and proxy guard"
```

---

### Task 3: Per-voice clip storage and voice registry

**Files:**
- Create: `tools/tts/voices.json`
- Create: `src/engine/voices.ts`
- Modify: `src/engine/clipIndex.ts`
- Modify: `src/app/prepare.ts` (manifest cache per voice; `Settings.voice`)
- Modify: `src/app/components/Controls.tsx` (`Settings` gets `voice: string`); `src/app/page.tsx` reads `?voice=`
- Modify: `tools/tts/generate.ts`, `tools/tts/check.ts`, `tools/tts/clips.ts`
- Move: `public/audio/*.mp3` and `public/audio/manifest.json` → `public/audio/af_heart/` (`git mv`)
- Test: `tests/unit/voices.test.ts`; update `tests/unit/tts.test.ts` and `tests/unit/assets.test.ts` where they assume the old paths

**Interfaces:**
- Produces:
  - `voices.json` is an array of `VoiceDef = { id: string; label: string; engine: "kokoro" | "chatterbox"; voice?: string; refAudio?: string; gender: "female" | "male"; accent: "US" | "UK"; sampleText: string; default?: boolean }`.
  - Initial entries:
    - `af_heart` (default, US female)
    - `af_bella` (US female)
    - `am_michael` (US male)
    - `am_adam` (US male)
    - `bf_emma` (UK female)
    - `chatterbox` (engine chatterbox, label "Chatterbox (expressive)", US female, no `refAudio` = the model's built-in voice)

    Every Kokoro entry has `voice` equal to its id. `sampleText` is `"Can you name all ten? Only one in a hundred gets every answer right!"`.
  - `src/engine/voices.ts` exports:
    - `VOICES: VoiceDef[]` (imports the JSON)
    - `DEFAULT_VOICE_ID`
    - `voiceById(id: string): VoiceDef | undefined`
    - `voiceTag(v: VoiceDef): string`, which returns `kokoro:<voice>` (identical to today's tag, so the existing clip keys stay valid) or `chatterbox:<refAudio basename or "default">`
    - `audioDir(id: string): string`, which returns `/audio/<id>`
  - `makeClipIndex(manifest: Manifest, voiceId: string): ClipIndex`. `file()` returns `/audio/<voiceId>/<file>`. A missing text throws `no "<voiceId>" voice clip for "<text>" — run npm run tts -- --voice <voiceId>`.
  - `getClips(voiceId)` in `prepare.ts` fetches `/audio/<voiceId>/manifest.json`, cached per id.
  - CLI: `npm run tts -- --voice <id>` (default: the default voice) and `npm run check:assets -- --voice <id>` (default: the default voice). `generate.ts` writes only inside `public/audio/<id>/`, and its stale-entry pruning only touches that voice's manifest.

- [ ] **Step 1: Write the failing tests**

```ts
test("registry: unique ids, exactly one default, kokoro entries name their voice", () => {
  expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length);
  expect(VOICES.filter((v) => v.default).map((v) => v.id)).toEqual(["af_heart"]);
  for (const v of VOICES.filter((x) => x.engine === "kokoro")) expect(v.voice).toBe(v.id);
});
test("voiceTag keeps the existing af_heart clip keys", () => {
  expect(voiceTag(voiceById("af_heart")!)).toBe("kokoro:af_heart");
});
test("clip files live in the voice folder and a missing line names the voice", () => {
  const idx = makeClipIndex({ k: { file: "k.mp3", durationMs: 5, text: "Hi" } }, "am_adam");
  expect(idx.file("Hi")).toBe("/audio/am_adam/k.mp3");
  expect(() => idx.ms("Bye")).toThrow('no "am_adam" voice clip for "Bye"');
});
test("af_heart folder has every clip the app needs", () => {
  // what check:assets does, for the default voice: every collectClipRequests key exists in public/audio/af_heart/manifest.json with its file
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/voices.test.ts`
Expected: FAIL (`voices` module missing)

- [ ] **Step 3: Implement the registry, the clip index change, the prepare and settings plumbing and the CLI flags; `git mv` the clips into `public/audio/af_heart/`**

`collectClipRequests` keeps its signature, and the caller passes `voiceTag(v)`. A test helper `pruneStale(manifest, wanted)` operates on one voice's manifest object only.

- [ ] **Step 4: Run the unit tests, the asset check and the browser suite**

Run: `npx vitest run && npm run check:assets && npx playwright test`
Expected: everything passes, the render snapshots are unchanged, and the check prints `assets ok`.

- [ ] **Step 5: Commit**

```bash
git add -A tools/tts src/engine/voices.ts src/engine/clipIndex.ts src/app public/audio tests/unit
git commit -m "feat: per-voice clip folders and voice registry (af_heart moved, keys unchanged)"
```

---

### Task 4: Chatterbox engine, voice samples and Kokoro voice generation

**Files:**
- Create: `tools/tts/chatterbox/speak.py`
- Modify: `tools/tts/config.json` (add `"chatterboxPython": "~/tts-test/env/bin/python"`)
- Modify: `tools/tts/generate.ts` (pick the engine per `VoiceDef`; add a `--samples` flag)
- Create: `tools/tts/engines.ts`
- Test: `tests/unit/tts.test.ts` (add cases)

**Interfaces:**
- Consumes: `VoiceDef` and `voiceTag` from Task 3.
- Produces:
  - `engineCommand(v: VoiceDef, cfg: { chatterboxPython: string }, root: string, home: string, outDir: string, itemsFile: string): { cmd: string; args: string[] }`
    - Kokoro: `[<root>/tools/tts/.venv-kokoro/bin/python, kokoro/speak.py, v.voice, outDir, itemsFile]`
    - Chatterbox: `[expanded chatterboxPython, chatterbox/speak.py, v.refAudio ?? "default", outDir, itemsFile]`
  - `chatterbox/speak.py <ref|default> <out_dir> <items.json>` writes `<out_dir>/<key>.wav` at the model's sample rate. It loads the model the same way `~/tts-test/test.py` does (MPS if available, with the `torch.load` map_location patch), using `exaggeration=0.5` and `cfg_weight=0.5`, and passes `audio_prompt_path` when a ref is given. It prints `ok <key>` per item.
  - `npm run tts -- --voice <id> --samples` writes only `public/audio/samples/<id>.mp3` from `sampleText`, through the same ffmpeg trim and loudnorm.

- [ ] **Step 1: Write the failing tests**

```ts
test("kokoro command uses the project venv and the voice name", () => {
  expect(engineCommand(voiceById("am_adam")!, { chatterboxPython: "~/x/python" }, "/r", "/h", "/o", "/i.json"))
    .toEqual({ cmd: "/r/tools/tts/.venv-kokoro/bin/python", args: ["/r/tools/tts/kokoro/speak.py", "am_adam", "/o", "/i.json"] });
});
test("chatterbox command expands ~ and defaults the reference", () => {
  expect(engineCommand(voiceById("chatterbox")!, { chatterboxPython: "~/tts-test/env/bin/python" }, "/r", "/h", "/o", "/i.json"))
    .toEqual({ cmd: "/h/tts-test/env/bin/python", args: ["/r/tools/tts/chatterbox/speak.py", "default", "/o", "/i.json"] });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/tts.test.ts`
Expected: FAIL (`engineCommand` is not exported)

- [ ] **Step 3: Implement `engines.ts`, `speak.py` and the `generate.ts` dispatch, plus `--samples`**

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/unit/tts.test.ts`
Expected: PASS

- [ ] **Step 5: Generate the samples for all 6 voices and the full clip sets for the 4 new Kokoro voices**

Run: `for v in af_heart af_bella am_michael am_adam bf_emma chatterbox; do npm run tts -- --voice $v --samples; done && for v in af_bella am_michael am_adam bf_emma; do npm run tts -- --voice $v && npm run check:assets -- --voice $v; done`
Expected: 6 files in `public/audio/samples/`, and `assets ok` for each Kokoro voice.

Then start the full Chatterbox set in the background (it runs for hours): `npm run tts -- --voice chatterbox > tmp/chatterbox-tts.log 2>&1 &`. It is not needed to finish this task, because the picker disables voices that have no clips (Task 5).

- [ ] **Step 6: Listen to all 6 samples and confirm each is clear English with no artefacts.** Drop any Kokoro voice that sounds wrong from `voices.json`, and say which in the commit message.

- [ ] **Step 7: Commit**

```bash
git add tools/tts public/audio tests/unit/tts.test.ts
git commit -m "feat: Chatterbox TTS engine, voice samples, four more Kokoro voices"
```

---

### Task 5: Voice picker

**Files:**
- Create: `src/app/components/VoicePicker.tsx`
- Modify: `src/app/components/Controls.tsx` (replaces nothing; it adds a "Voice" field above Template)
- Modify: `src/app/page.tsx` (`?voice=` fallback and warning)
- Test: `tests/browser/pickers.spec.ts`

**Interfaces:**
- Consumes: `VOICES`, `DEFAULT_VOICE_ID` and `audioDir` from Task 3; the sample files from Task 4.
- Produces: `<VoicePicker value={voiceId} onChange={(id: string) => void} disabled={boolean} />`.
  - On mount it HEADs `/audio/<id>/manifest.json` for each voice. Missing voices render with `aria-disabled="true"` and the hint "clips not generated".
  - Each card shows the label plus gender and accent tags, has a ▶ button that plays `/audio/samples/<id>.mp3` (a second click stops it), and is selected with `aria-pressed`.
  - Pattern: the Canva AI Voice cards and Mindtrip's voice rows (Mobbin).
  - `page.tsx`: if `?voice=` names an unknown voice or one without clips, settings use `af_heart` and the page shows the warning `Voice "<id>" has no clips yet; using Heart.`

- [ ] **Step 1: Write the failing browser tests**

```ts
test("voice picker lists the registry and switching voice re-prepares the quiz", async ({ page }) => {
  await page.goto("/?seed=demo");
  const group = page.getByRole("group", { name: "Voice" });
  await expect(group.getByRole("button", { pressed: true })).toContainText("Heart");
  await group.getByRole("button", { name: /Adam/ }).click();
  await expect(page.getByTestId("first-country")).not.toBeEmpty({ timeout: 60000 });
  const files = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("/audio/am_adam/")));
  expect(files.length).toBeGreaterThan(0);
});
test("a voice without clips is disabled, and ?voice= to it falls back with a warning", async ({ page }) => {
  await page.route("**/audio/chatterbox/manifest.json", (r) => r.fulfill({ status: 404 }));
  await page.goto("/?seed=demo&voice=chatterbox");
  await expect(page.getByText('Voice "chatterbox" has no clips yet; using Heart.')).toBeVisible();
  await expect(page.getByRole("button", { name: /Chatterbox/ })).toHaveAttribute("aria-disabled", "true");
});
```

The first test confirms the switch through the resource list; the real check is that the export audio is mixed from the `am_adam` folder. Adjust to read `prepared.clips` if the resource timing API is flaky, but keep the assertion on the `am_adam` folder.

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test tests/browser/pickers.spec.ts`
Expected: FAIL (there is no "Voice" group)

- [ ] **Step 3: Implement `VoicePicker` and wire it into `Controls` and `page.tsx`**

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx playwright test tests/browser/pickers.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app tests/browser/pickers.spec.ts
git commit -m "feat: voice picker with samples; voices without clips are disabled"
```

---

### Task 6: Template gallery

**Files:**
- Create: `src/app/components/TemplateGallery.tsx`
- Create: `src/app/themeTags.ts`
- Modify: `src/engine/render/assets.ts`: extract `loadThemeFonts(theme: Theme): Promise<{ ok: boolean; warnings: string[] }>` from `loadAssets`, which then calls it with no behaviour change
- Modify: `src/app/components/Controls.tsx` (the Template `<select>` is replaced by the gallery)
- Test: `tests/unit/themeTags.test.ts`; add cases to `tests/browser/pickers.spec.ts`

**Interfaces:**
- Consumes: `Prepared` (`src/app/prepare.ts`), `drawFrame`, `W` and `H`, `themes`.
- Produces:
  - `THEME_TAGS = ["Popular", "Bold", "Calm", "Playful", "Elegant", "Dark", "Light"] as const`
  - `themeTags(t: Theme): ThemeTag[]` rules:
    - `Popular` if `featured`
    - `Bold` if the mood has any of `loud|bold|energetic|high-energy|game-show|dramatic|poster`
    - `Calm` if `calm|clean|fresh|airy|focused|minimal|crisp`
    - `Playful` if `playful|funny|cheerful|bouncy|sweet|comic`
    - `Elegant` if `elegant|premium|dreamy|epic`
    - `Dark` if the average relative luminance of `palette.bgFrom` and `palette.bgTo` is below 0.3
    - `Light` otherwise
  - `<TemplateGallery prepared={Prepared | null} value={themeId | "random"} onChange={(id) => void} disabled />` renders:
    - a filter chip row (`All` + `THEME_TAGS`)
    - a "Random" card first
    - one card per theme: a thumbnail 216×384, the name, and its first tag
  - Thumbnail = `drawFrame` on an `OffscreenCanvas(W, H)` at `start + 1.0` of the first `timer` scene of `prepared.timeline`, with `theme` replaced, after `loadThemeFonts(theme)`, drawn down to 216×384.
  - Thumbnails render one at a time, yielding to the UI with `requestIdleCallback`, falling back to `setTimeout`. They are cached by `${themeId}|${prepared.spec.seed}|${prepared.spec.quiz}`. Cards show a skeleton until their thumbnail is ready.
  - Pattern: YAQUIZO's Templates panel (owner's 3rd image).

- [ ] **Step 1: Write the failing tests**

```ts
// unit
test("every theme gets Dark or Light and featured ones are Popular", () => {
  for (const t of themes) expect(themeTags(t).filter((x) => x === "Dark" || x === "Light").length).toBe(1);
  expect(themes.filter((t) => t.featured).every((t) => themeTags(t).includes("Popular"))).toBe(true);
  expect(themeTags(themes.find((t) => t.id === "comic-pop")!)).toEqual(expect.arrayContaining(["Bold", "Playful"]));
});
// browser
test("gallery shows Random + 21 cards, filters, and picking one changes the template", async ({ page }) => {
  await page.goto("/?seed=demo");
  const g = page.getByRole("group", { name: "Template" });
  await expect(g.getByRole("button")).toHaveCount(22);
  await g.getByRole("button", { name: "Popular" }).click();
  await expect(g.locator("[data-theme-card]")).toHaveCount(6);
  await g.getByRole("button", { name: /Game Show/ }).click();
  await expect(page.getByText("template: Game Show")).toBeVisible({ timeout: 60000 });
});
test("rapid template clicks end on the last choice", async ({ page }) => {
  await page.goto("/?seed=demo");
  const g = page.getByRole("group", { name: "Template" });
  for (const n of [/Neon Night/, /Arctic Ice/, /Mono Bold/]) await g.getByRole("button", { name: n }).click();
  await expect(page.getByText("template: Mono Bold")).toBeVisible({ timeout: 60000 });
});
```

Card counts: the filter chips are buttons too, so scope the count to the cards (`[data-theme-card]` plus the Random card) if the chips are inside the group. Make the first assertion `toHaveCount(22)` on `[data-theme-card]`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/themeTags.test.ts && npx playwright test tests/browser/pickers.spec.ts -g gallery`
Expected: FAIL

- [ ] **Step 3: Implement `themeTags`, extract `loadThemeFonts`, then build `TemplateGallery` and replace the select**

- [ ] **Step 4: Run the unit tests, the browser tests and the render snapshots**

Run: `npx vitest run && npx playwright test`
Expected: PASS, with render snapshots unchanged.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: template gallery with live thumbnails and mood filters"
```

---

### Task 7: Font picker with previews

**Files:**
- Create: `src/app/fonts.ts`
- Create: `src/app/components/FontPicker.tsx`
- Modify: `src/engine/render/assets.ts`: export `ensureFont(family: string): Promise<boolean>`, which loads the 400 and 700 faces once per family; `loadThemeFonts` uses it
- Modify: `src/app/components/Controls.tsx` (the Font `<select>` is replaced)
- Test: `tests/unit/fonts.test.ts`; add cases to `tests/browser/pickers.spec.ts`

**Interfaces:**
- Consumes: `fontFamilies(themes)` (40 families), `ensureFont`.
- Produces:
  - `FONT_GROUP: Record<string, "Display" | "Sans" | "Serif" | "Handwritten" | "Mono">` covering all 40 families:
    - Display: Anton, Bebas Neue, Bangers, Luckiest Guy, Lilita One, Archivo Black, Alfa Slab One, Audiowide, Orbitron, Press Start 2P, Righteous, Unbounded, Chewy, Fredoka, Baloo 2
    - Mono: JetBrains Mono
    - Handwritten: Permanent Marker, Kalam, Comic Neue
    - Serif: Fraunces, Playfair Display, Cinzel
    - Sans: everything else
  - `fontMatches(family: string, query: string): boolean` is a case-insensitive substring match on the family name or its group.
  - `<FontPicker value={family | "theme"} onChange={(f) => void} sample={string} disabled />`:
    - The button shows the current family in its own face and opens a popover. The popover has:
      - a search box with `aria-label="Search fonts"`
      - "Template default" first
      - grouped lists, each item rendered in its own font
    - A sample line at the top uses the hovered or selected font. The sample is the current question text, or "Which planet is known as the Red Planet?" when there is none.
    - Each family's face loads when its row scrolls into view (IntersectionObserver → `ensureFont`).
    - Esc and outside clicks close the popover.
    - Pattern: Canva's and Luma's font lists (Mobbin).

- [ ] **Step 1: Write the failing tests**

```ts
// unit
test("every theme font has a group", () => {
  expect(fontFamilies(themes).filter((f) => !FONT_GROUP[f])).toEqual([]);
});
test("search matches name or group", () => {
  expect(fontMatches("Bebas Neue", "bebas")).toBe(true);
  expect(fontMatches("Kalam", "hand")).toBe(true);
  expect(fontMatches("Inter", "serif")).toBe(false);
});
// browser
test("font search filters and each row is drawn in its own font", async ({ page }) => {
  await page.goto("/?seed=demo");
  await page.getByRole("button", { name: /Font/ }).click();
  await page.getByLabel("Search fonts").fill("bebas");
  const row = page.getByRole("option", { name: "Bebas Neue" });
  await expect(page.getByRole("option")).toHaveCount(1);
  expect(await row.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("Bebas Neue");
  await row.click();
  await expect(page).toHaveURL(/./); // popover closed
  await expect(page.getByRole("button", { name: /Bebas Neue/ })).toBeVisible();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/fonts.test.ts && npx playwright test tests/browser/pickers.spec.ts -g font`
Expected: FAIL

- [ ] **Step 3: Implement `fonts.ts`, `ensureFont` and `FontPicker`; replace the select**

- [ ] **Step 4: Run the full suites**

Run: `npx vitest run && npx playwright test && npm run lint`
Expected: everything passes, and the lint is clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: searchable font picker with live previews"
```

---

### Task 8: Phase 1 check on the production build

**Files:** none (verification only)

- [ ] **Step 1: Run a production build and start it with the owner's `.env.local`**

Run: `npm run build && npm start`
Expected: the server is on `http://localhost:3111`.

- [ ] **Step 2: Walk through the app in the browser pane**

1. `/` redirects to `/login`. the owner's PIN opens the app.
2. Pick the voice Michael and play its sample. Pick the Game Show template and the Anton font.
3. Export one MP4. It plays with Michael's voice, the Game Show look and Anton text.

Expected: all three steps work, with no console errors. Take a screenshot of the editor.

- [ ] **Step 3: Report what was not verified:** the full Chatterbox clip set, if its background generation is still running.
