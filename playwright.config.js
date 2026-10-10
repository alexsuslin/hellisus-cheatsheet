import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4180/hellisus-cheatsheet/",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs --dist --subpath",
    url: "http://127.0.0.1:4180/hellisus-cheatsheet/",
    env: { PORT: "4180" },
    reuseExistingServer: false,
  },
});
