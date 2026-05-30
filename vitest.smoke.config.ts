import { defineConfig } from "vitest/config";

/**
 * Separate config for the optional-integration smoke test. Kept out of the main
 * `npm test` so a clone without the optional (git-hosted) deps still passes.
 * Run:  npm run test:smoke
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
