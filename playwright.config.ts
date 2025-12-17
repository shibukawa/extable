import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

function detectPlaywrightMacHostOverride() {
  const base = path.join(process.cwd(), 'node_modules/playwright-core/.local-browsers');
  try {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-'));
    for (const d of dirs) {
      const arm = path.join(base, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
      if (fs.existsSync(arm)) return 'mac-arm64';
      const x64 = path.join(base, d, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell');
      if (fs.existsSync(x64)) return 'mac-x64';
    }
  } catch {
    // ignore
  }
  return null;
}

// Ensure browsers are installed into the workspace to avoid permission issues in user cache directories.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';

// Some environments incorrectly resolve the host platform on Apple Silicon.
// Detect installed local browsers and force a matching platform.
if (process.platform === 'darwin') {
  const override = detectPlaywrightMacHostOverride();
  if (override) process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE ??= override;
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
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--headless=old'] } }
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
