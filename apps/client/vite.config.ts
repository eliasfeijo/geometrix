import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The dev server proxies the API and the WebSocket to `npm run server`, on
// the same GEO_PORT the server reads.
const server = `http://localhost:${process.env.GEO_PORT ?? 8080}`;

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  // Two pages: the game and the battle lab (M2 laboratório, plan P11).
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        lab: fileURLToPath(new URL("lab.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      "/api": server,
      "/ws": { target: server, ws: true },
    },
  },
  test: { environment: "node" },
});
