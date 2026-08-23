import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: { baseURL, trace: "on-first-retry", ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } } : {}) },
  webServer: baseURL === "http://127.0.0.1:5173"
    ? { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 30_000 }
    : undefined,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-360", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 360, height: 800 } } },
    { name: "mobile-390", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "mobile-430", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 430, height: 932 } } }
  ]
});
