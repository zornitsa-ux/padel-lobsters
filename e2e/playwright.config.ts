import { defineConfig, devices } from '@playwright/test'

// http://127.0.0.1:5173 is not arbitrary — vite.config.js pins host+port
// because auth redirects and the Supabase config.toml allow-list are tied to
// that exact origin (see the comment there). Do not point this at
// `localhost` or a different port.
const baseURL = 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuses a dev server the developer already has running (the common local
  // case); CI always starts its own so a stale one can't mask a regression.
  webServer: {
    command: 'npm run dev:local',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // 60s, not 30s: a cold CI runner has no node_modules/.vite cache, so the
    // first request pays for dep pre-bundling.
    timeout: 60_000,
  },
})
