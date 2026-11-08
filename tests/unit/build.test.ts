import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("build pipeline", () => {
  test("npm run build runs data build, asset check, then next build", () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts;
    expect(scripts.build).toBe("npm run build:data && npm run check:assets && next build");
  });

  test("check:assets exits non-zero when a manifest key is missing, zero when complete", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
    fs.mkdirSync(path.join(tmp, "data"));
    fs.mkdirSync(path.join(tmp, "public/audio"), { recursive: true });
    for (const f of ["countries.json", "voice_lines.json"]) fs.copyFileSync(path.join(root, "data", f), path.join(tmp, "data", f));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/audio/manifest.json"), "utf8"));
    for (const e of Object.values<any>(manifest)) fs.copyFileSync(path.join(root, "public/audio", e.file), path.join(tmp, "public/audio", e.file));
    const run = () => spawnSync("npx", ["tsx", "tools/tts/check.ts"], { cwd: root, env: { ...process.env, ASSET_ROOT: tmp }, encoding: "utf8" });

    fs.writeFileSync(path.join(tmp, "public/audio/manifest.json"), JSON.stringify(manifest));
    expect(run().status).toBe(0);

    const [firstKey] = Object.keys(manifest);
    const broken = { ...manifest }; delete broken[firstKey];
    fs.writeFileSync(path.join(tmp, "public/audio/manifest.json"), JSON.stringify(broken));
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no manifest entry");
  }, 60_000);
});
