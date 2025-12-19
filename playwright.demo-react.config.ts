import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright-demo-react",
  reporter: "list",
  webServer: {
    command:
      "npm -w @extable/core run build && npm -w @extable/react run build && npm -w @extable/demo-react run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    userAgent: `${devices["Desktop Chrome"].userAgent} PlaywrightBot`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        userAgent: `${devices["Desktop Chrome"].userAgent} PlaywrightBot`,
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], userAgent: `${devices["Desktop Firefox"].userAgent} PlaywrightBot` },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], userAgent: `${devices["Desktop Safari"].userAgent} PlaywrightBot` },
    },
  ],
});
