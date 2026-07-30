/**
 * One-time rasterize of E1 Gusset & Rivet frame → public/brand/cabinet-card-frame.png
 *
 * Usage: node scripts/render-cabinet-frame.mjs
 * Requires: playwright (npx will download browsers on first run)
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "cabinet-frame-e1.html");
const outDir = path.join(__dirname, "..", "public", "brand");
const outPath = path.join(outDir, "cabinet-card-frame.png");

const FRAME_W = 1600;
const FRAME_H = 1480;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const url = pathToFileURL(htmlPath).href;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: FRAME_W, height: FRAME_H },
    deviceScaleFactor: 1,
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Force-load the three frame faces
    await Promise.all([
      document.fonts.load('52px "Rye"'),
      document.fonts.load('22px "IM Fell English SC"'),
      document.fonts.load('15px "Special Elite"'),
    ]);
  });
  // Brief settle for webfont paint
  await page.waitForTimeout(400);

  await page.locator("#frame").screenshot({
    path: outPath,
    omitBackground: true,
    type: "png",
  });

  await browser.close();
  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath} (${Math.round(stat.size / 1024)} KB)`);
  console.log(
    "Window constants: x=140 y=120 w=1320 h=990 (see cabinet-card.ts)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
