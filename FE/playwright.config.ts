import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  outputDir: "../artifacts/browser-results",
  webServer: [
    {
      command:
        process.platform === "win32"
          ? "..\\.venv\\Scripts\\python.exe -m uvicorn tests.e2e_server:app --app-dir ../BE --port 8000"
          : "python -m uvicorn tests.e2e_server:app --app-dir ../BE --port 8000",
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
