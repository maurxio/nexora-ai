const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/e2e',
  globalTeardown: './test/e2e/cleanup.cjs',
  expect: { timeout: 10000 },
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://127.0.0.1:5179', trace: 'retain-on-failure' },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  webServer: [
    {
      command: 'PORT=3101 node --import ./test/env.js apps/api/src/server.js',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command:
        'API_PROXY=http://127.0.0.1:3101 npm run dev -w apps/web -- --host 127.0.0.1 --port 5179 --strictPort',
      url: 'http://127.0.0.1:5179',
      reuseExistingServer: false,
    },
  ],
});
