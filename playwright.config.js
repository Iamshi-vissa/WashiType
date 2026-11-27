import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build (npm run build first), in Chromium,
// Firefox and WebKit (Safari's engine). Locally you can run only Chromium against an
// installed Chrome: PW_CHROME=/path/to/chrome npx playwright test --project=chromium
const chromiumArgs = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME, args: chromiumArgs } : { args: chromiumArgs }
      }
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] }, grep: /home|real page|404|unknown font/ }
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --bypass-lock',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
});
