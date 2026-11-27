import { defineConfig } from '@playwright/test';

// Browser tests run against the production build (npm run build first).
// Locally you can point at an installed Chrome with PW_CHROME=/path/to/chrome.
export default defineConfig({
  testDir: 'tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    launchOptions: process.env.PW_CHROME
      ? { executablePath: process.env.PW_CHROME, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }
      : { args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --bypass-lock',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
});
