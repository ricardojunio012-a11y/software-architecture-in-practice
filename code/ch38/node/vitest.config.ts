import { defineConfig } from "vitest/config";

// The lab's tests live in test/.
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
