import { cloudflareTest } from "@cloudflare/vitest-plugin";
import agents from "agents/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    agents(),
    cloudflareTest({
      wrangler: { configPath: "./tests/worker/wrangler.test.jsonc" },
      remoteBindings: false
    })
  ],
  test: {
    include: ["tests/worker/**/*.test.ts"]
  }
});
