import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './quals',
  use: { baseURL: 'http://localhost:8973' },
  webServer: {
    command: 'python3 -m http.server 8973',
    url: 'http://localhost:8973',
    reuseExistingServer: true,
  },
});
