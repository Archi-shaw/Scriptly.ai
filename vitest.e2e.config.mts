import { defineConfig } from "vitest/config";

// Runs against a live server started by scripts/e2e.mjs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
