import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/policy/**/*.test.ts", "tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"]
    }
  }
});
