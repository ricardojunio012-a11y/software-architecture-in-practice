import { defineConfig } from "vitest/config";

// The configuration the pipeline uses to run the tests of one commit
export default defineConfig({ test: { include: ["src/commits/**/*.test.ts"] } });
