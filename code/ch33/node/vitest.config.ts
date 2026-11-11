import { defineConfig } from "vitest/config";

// The lab tests live in test/. The tests of each commit, in src/commits, are run by
// the pipeline, one commit at a time.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
