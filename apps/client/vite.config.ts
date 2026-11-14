import { defineConfig } from "vitest/config";

// The dev server proxies the API and the WebSocket to `npm run server`.
const server = "http://localhost:8080";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  server: {
    proxy: {
      "/api": server,
      "/ws": { target: server, ws: true },
    },
  },
  test: { environment: "node" },
});
