import { defineConfig, devices } from '@playwright/test';

// Some environments incorrectly resolve the host platform on Apple Silicon.
// Force the correct browser path to make local runs deterministic.
if (process.platform === 'darwin' && process.arch === 'arm64') {
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= 'mac-arm64';
}

export default defineConfig({
  testDir: './playwright',
  reporter: 'list',
  webServer: {
    command: 'npm -w @extable/core run build && npm -w @extable/demo run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
