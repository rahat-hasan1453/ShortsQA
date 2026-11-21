import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 180_000,
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { channel: "chrome" } },
    { name: "chrome", dependencies: ["setup"], use: { channel: "chrome", storageState: "tests/browser/.auth.json" } },
  ],
  webServer: {
    command: "npm run dev -- --port 3197",
    url: "http://localhost:3197",
    reuseExistingServer: false, // a shared port could hand the tests some other project's server
    timeout: 120_000,
    env: { STUDIO_PIN: "111111", STUDIO_SECRET: "test-secret" },
  },
  use: { baseURL: "http://localhost:3197" },
});
