import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:1657",
    headless: true,
  },
  reporter: "list",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 1657",
    url: "http://127.0.0.1:1657",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
