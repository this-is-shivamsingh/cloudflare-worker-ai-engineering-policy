import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import agents from "agents/vite";
import { defineConfig, type Plugin } from "vite";

const forbiddenBuildAssetPatterns = [
  /(^|\/)\.dev\.vars(?:\..+)?$/,
  /(^|\/)\.env(?:\..+)?$/,
  /(^|\/)(?:\.cloudflare|\.config|\.wrangler)(?:\/|$)/,
  /(^|\/)(?:wrangler-oauth.*|cloudflare-api-token.*|.*\.(?:pem|key|token))$/i
];

function removeSensitiveBuildAssets(): Plugin {
  return {
    name: "remove-sensitive-build-assets",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (forbiddenBuildAssetPatterns.some((pattern) => pattern.test(fileName))) {
          delete bundle[fileName];
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [agents(), react(), cloudflare(), removeSensitiveBuildAssets()],
  build: {
    sourcemap: true
  }
});
