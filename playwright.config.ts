import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv();

// Allow pointing Playwright at an already-running server (e.g. npm run serve on :4000)
// without launching a new one.  If unset, Playwright starts ng serve on :4200.
const externalBaseURL = process.env['PLAYWRIGHT_BASE_URL'];
const baseURL = externalBaseURL || 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'iphone-chromium-emulation',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium'
      }
    },
    {
      name: 'iphone-safari-webkit',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit'
      }
    }
  ],
  webServer: externalBaseURL ? undefined : {
    command: 'npm run start -- --host 127.0.0.1 --port 4200',
    url: 'http://127.0.0.1:4200',
    env: {
      SKIP_SEO_DB_LOOKUPS: 'true'
    },
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000
  }
});
