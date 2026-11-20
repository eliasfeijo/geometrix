/* global process */
// Renders the mockups (../maquetes/*.html) to PNG, cropped to their content.
// Usage: node maquetes.mjs <out dir> [names...] (default: all four)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [out, ...names] = process.argv.slice(2);
const list = names.length > 0 ? names : ["fichas", "kits", "liga", "arco"];
const page = await launch({ port: 9335, width: 1400, height: 1000 });
for (const name of list) {
  await page.goto(
    `file://${join(here, "..", "maquetes", `${name}.html`)}`,
    1200,
  );
  const box = await page.eval(`({
    width: Math.ceil(document.body.getBoundingClientRect().width),
    height: Math.ceil(document.body.scrollHeight),
  })`);
  await page.viewport(Math.max(box.width, 400), box.height);
  await sleep(300);
  await page.shot(`${out}/${name}.png`, { clip: { x: 0, y: 0, ...box } });
  await page.viewport(1400, 1000);
}
page.close();
