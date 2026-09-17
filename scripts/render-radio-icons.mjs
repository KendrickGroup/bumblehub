/**
 * Rasterize Latigo Radio app icon + iOS splash screens.
 *
 * Usage: node scripts/render-radio-icons.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "radio-icon.html");
const outDir = path.join(__dirname, "..", "public", "radio");

const SPLASHES = [
  { file: "splash-1290x2796.png", width: 1290, height: 2796 },
  { file: "splash-1179x2556.png", width: 1179, height: 2556 },
  { file: "splash-1170x2532.png", width: 1170, height: 2532 },
  { file: "splash-1125x2436.png", width: 1125, height: 2436 },
  { file: "splash-1242x2688.png", width: 1242, height: 2688 },
  { file: "splash-750x1334.png", width: 750, height: 1334 },
];

const ogOnly = process.argv.includes("--og");

async function main() {
  const browser = await chromium.launch();
  const url = pathToFileURL(htmlPath).href;

  if (!ogOnly) {
  const iconPage = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  await iconPage.goto(url, { waitUntil: "networkidle" });
  await iconPage.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('800 148px "Bricolage Grotesque"');
  });
  await iconPage.waitForTimeout(300);

  const master = await iconPage.locator("#icon").screenshot({
    type: "png",
    omitBackground: false,
  });

  async function writeScaled(size, dest) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const dataUrl = `data:image/png;base64,${master.toString("base64")}`;
    await page.setContent(
      `<img src="${dataUrl}" style="width:${size}px;height:${size}px;image-rendering:auto;display:block" />`,
      { waitUntil: "load" },
    );
    await page.locator("img").screenshot({
      path: path.join(outDir, dest),
      type: "png",
    });
    await page.close();
    console.log(`Wrote ${dest}`);
  }

  await writeScaled(512, "icon-512.png");
  await writeScaled(192, "icon-192.png");
  await writeScaled(180, "apple-touch-icon.png");
  await iconPage.close();

  for (const splash of SPLASHES) {
    const page = await browser.newPage({
      viewport: { width: splash.width, height: splash.height },
      deviceScaleFactor: 1,
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      document.getElementById("icon")?.setAttribute("hidden", "");
      document.getElementById("splash")?.removeAttribute("hidden");
      await document.fonts.ready;
      await document.fonts.load('800 42px "Bricolage Grotesque"');
    });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(outDir, splash.file),
      type: "png",
    });
    await page.close();
    console.log(`Wrote ${splash.file}`);
  }
  }

  const ogPage = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await ogPage.goto(url, { waitUntil: "networkidle" });
  await ogPage.evaluate(async () => {
    document.getElementById("icon")?.setAttribute("hidden", "");
    document.getElementById("og")?.removeAttribute("hidden");
    await document.fonts.ready;
    await document.fonts.load('800 42px "Bricolage Grotesque"');
  });
  await ogPage.waitForTimeout(200);
  await ogPage.locator("#og").screenshot({
    path: path.join(outDir, "og.png"),
    type: "png",
  });
  await ogPage.close();
  console.log("Wrote og.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
