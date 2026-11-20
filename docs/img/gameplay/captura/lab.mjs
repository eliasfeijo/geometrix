/* global process */
// Records an AI-only battle in the lab: builds the sides in the setup form,
// sets "ninguém (só assistir)", starts, and saves JPEG frames for a GIF.
// Usage: node lab.mjs <server base url> <out dir> <arena> '<sides json>' [seconds] [seed]
// e.g. sides '[["square","triangle","circle"],["square","triangle","circle"]]'
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, arena, sidesJson, seconds = "30", seed = "7"] =
  process.argv.slice(2);
const sides = JSON.parse(sidesJson);
mkdirSync(out, { recursive: true });

const page = await launch({ port: 9334 });
await page.goto(`${base}/lab`, 3000);
const setValue = (id, value, event) =>
  page.eval(`(() => {
    const e = document.getElementById(${JSON.stringify(id)});
    e.value = ${JSON.stringify(value)};
    e.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true }));
  })()`);
const click = (text, nth = 0) =>
  page.eval(`[...document.querySelectorAll('button')]
    .filter(b => b.textContent.trim() === ${JSON.stringify(text)})[${nth}]?.click()`);

await setValue("setup-arena", arena, "change");
await setValue("setup-seed", seed, "input");
for (let s = 2; s < sides.length; s++) {
  await click("+ lado");
  await sleep(150);
}
for (let s = 0; s < sides.length; s++) {
  for (let i = 1; i < sides[s].length; i++) {
    await click("+ participante", s);
    await sleep(150);
  }
  for (let i = 0; i < sides[s].length; i++) {
    await setValue(`setup-${s}-${i}-dna`, sides[s][i], "change");
    await sleep(100);
  }
}
await setValue("setup-you", "", "change");
await sleep(300);
await click("Começar");
await sleep(400);
const start = Date.now();
for (let i = 0; Date.now() - start < Number(seconds) * 1000; i++) {
  await page.shot(`${out}/${String(i).padStart(3, "0")}.jpg`, {
    format: "jpeg",
  });
  await sleep(70);
}
page.close();
