/* global process, fetch, URLSearchParams */
// Captures a live world as one Blue player sees it: creates a world with a
// bot on each team, joins Blue, and screenshots the client every 20 s. Every
// third shot it toggles the chronicle panel (it starts open) for an extra
// shot, and the eighth shot adds a burst of JPEG frames for a GIF.
// Usage: node mundo.mjs <server base url> <out dir> [minutes] [seed] [mult]
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, minutes = "9", seed = "42", mult = "360"] =
  process.argv.slice(2);
mkdirSync(`${out}/mundo`, { recursive: true });
mkdirSync(`${out}/rajada`, { recursive: true });

const post = async (path, body) =>
  (
    await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
const world = await post("/api/worlds", {
  seed: Number(seed),
  multiplier: Number(mult),
  botTeams: [0, 1],
});
const me = await post(`/api/worlds/${world.id}/join`, {
  name: "Você",
  team: 0,
});
const query = new URLSearchParams({ world: String(world.id), slot: "0" });
const session = new URLSearchParams({
  token: me.token,
  player: String(me.playerId),
  team: "0",
  name: "Você",
});

const page = await launch();
await page.goto(`${base}/?${query}#${session}`, 5000);
const clock = () =>
  page.eval(
    `document.body.innerText.match(/dia \\d+ · \\d\\d:\\d\\d/)?.[0] ?? '?'`,
  );
const toggleChronicle = () =>
  page.eval(`(() => {
    const h = [...document.querySelectorAll('button, summary, header, div')]
      .find(e => /^Crônica/.test(e.textContent.trim()) && e.textContent.trim().length < 20);
    h?.click();
  })()`);

const start = Date.now();
for (let n = 0; Date.now() - start < Number(minutes) * 60_000; n++) {
  const name = `${String(n).padStart(3, "0")}-${(await clock()).replace(/[^0-9a-z]+/gi, "-")}`;
  await page.shot(`${out}/mundo/${name}.png`);
  if (n % 3 === 2) {
    await toggleChronicle();
    await sleep(600);
    await page.shot(`${out}/mundo/${name}-cronica.png`);
    await toggleChronicle();
  }
  if (n === 7) {
    for (let i = 0; i < 96; i++) {
      await page.shot(`${out}/rajada/${String(i).padStart(3, "0")}.jpg`, {
        format: "jpeg",
      });
      await sleep(90);
    }
  }
  await sleep(20_000);
}
page.close();
