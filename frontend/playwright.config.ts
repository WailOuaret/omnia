import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 1080 },
  },
  webServer: [
    {
      command: `${path.join(repoRoot, ".runenv", "Scripts", "python.exe")} scripts/run_backend_server.py --host 127.0.0.1 --port 8000`,
      url: "http://127.0.0.1:8000/api/health",
      cwd: repoRoot,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `${path.join(repoRoot, ".runenv", "Scripts", "python.exe")} scripts/serve_frontend.py --root frontend/dist --host 127.0.0.1 --port 4173`,
      url: "http://127.0.0.1:4173",
      cwd: repoRoot,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
