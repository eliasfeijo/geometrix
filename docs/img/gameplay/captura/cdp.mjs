/* global process, fetch, WebSocket, setTimeout, Buffer */
// A minimal Chrome DevTools Protocol driver for the gameplay captures: it
// launches Playwright's cached headless Chromium, opens a page, sends
// commands, evaluates JS and captures PNG/JPEG. No dependencies (Node 26 has
// fetch and WebSocket). Set GEO_CHROME to use another Chromium binary.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";

const CHROME =
  process.env.GEO_CHROME ??
  `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, width = 1440, height = 900 } = {}) {
  const proc = spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--window-size=${width},${height}`,
      "--hide-scrollbars",
      "--no-sandbox",
      "--force-color-profile=srgb",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    try {
      targets = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
      ).json();
    } catch {
      await sleep(200);
    }
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let next = 1;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === undefined || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const viewport = (w, h) =>
    send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await viewport(width, height);
  return {
    send,
    viewport,
    async goto(url, wait = 3000) {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(
          r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
        );
      }
      return r.result.value;
    },
    async shot(path, { format = "png", quality = 85, clip } = {}) {
      const r = await send("Page.captureScreenshot", {
        format,
        ...(format === "jpeg" ? { quality } : {}),
        ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
      });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    close() {
      ws.close();
      proc.kill();
    },
  };
}
