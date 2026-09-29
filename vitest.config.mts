import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/support/setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    coverage: { provider: "v8", include: ["src/domain/**", "src/ai/**", "src/application/**"] },
  },
});
