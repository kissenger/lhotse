import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv();

// Allow pointing Playwright at an already-running server (e.g. npm run serve on :4000)
// without launching a new one. If unset, Playwright starts ng serve on :4200.
const externalBaseURL = process.env['TEST_APP_BASE_URL'];
const isLocalBaseURL = !externalBaseURL || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(externalBaseURL);
const baseURL = isLocalBaseURL ? 'http://127.0.0.1:4000' : externalBaseURL;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/dead-links.spec.js'],
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
  webServer: isLocalBaseURL ? {
    command: 'npm run start -- --host 127.0.0.1 --port 4000',
    url: 'http://127.0.0.1:4000',
    env: {
      SKIP_SEO_DB_LOOKUPS: 'true'
    },
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000
  } : undefined
});
