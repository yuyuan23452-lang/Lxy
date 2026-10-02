import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      process.env.PLAYWRIGHT_CORE_MJS,
      process.env.PLAYWRIGHT_CORE_DIR ? path.join(process.env.PLAYWRIGHT_CORE_DIR, "index.mjs") : "",
      process.env.BROWSER_TOOLS_DIR ? path.join(process.env.BROWSER_TOOLS_DIR, "node_modules", "playwright-core", "index.mjs") : "",
      path.join(process.cwd(), "node_modules", "playwright-core", "index.mjs"),
      path.join(here, "node_modules", "playwright-core", "index.mjs")
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return (await import(pathToFileURL(candidate).href)).chromium;
      }
    }
    throw new Error("playwright-core not found. Run from a workspace with node_modules/playwright-core, set BROWSER_TOOLS_DIR, or set PLAYWRIGHT_CORE_MJS.");
  }
}

const chromium = await loadChromium();
const pagesToRead = Number(process.env.DRAFT_PAGES || process.argv[2] || "2");
const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://127.0.0.1:9222");
const context = browser.contexts()[0];
let page = context.pages().find((candidate) => !candidate.isClosed() && candidate.url().includes("/ffa/g/draft"));

if (!page) {
  page = await context.newPage();
  await page.goto("https://fxg.jinritemai.com/ffa/g/draft", { waitUntil: "domcontentloaded" });
}

await page.bringToFront();
await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForSelector("tr.ecom-g-table-row", { timeout: 20000 });

async function clickPage(pageNumber) {
  const clicked = await page.evaluate((pageNumber) => {
    const candidates = Array.from(document.querySelectorAll("li.ecom-g-pagination-item,a,button,[role='button']"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(),
          rect: { x: r.x, y: r.y, w: r.width, h: r.height }
        };
      })
      .filter((item) => item.text === String(pageNumber) && item.rect.w > 0 && item.rect.h > 0);
    const target = candidates.sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h)[0]?.el;
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.click();
    return true;
  }, pageNumber);

  if (!clicked) return false;
  await page.waitForTimeout(1500);
  return true;
}

async function rowsOnPage(pageNumber) {
  if (pageNumber > 1) {
    const ok = await clickPage(pageNumber);
    if (!ok) return [];
  } else {
    await clickPage(1).catch(() => {});
  }

  return await page.evaluate((pageNumber) => Array.from(document.querySelectorAll("tr.ecom-g-table-row")).map((row, index) => {
    const text = (row.innerText || "").replace(/\s+/g, " ").trim();
    return {
      page: pageNumber,
      index,
      id: text.match(/ID:(\d+)/)?.[1] || "",
      isDraft: text.includes("待提交"),
      text
    };
  }), pageNumber);
}

const rows = [];
for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
  rows.push(...await rowsOnPage(pageNumber));
}

console.log(JSON.stringify({
  count: rows.length,
  ids: rows.map((row) => row.id).filter(Boolean),
  rows: rows.map((row) => ({
    page: row.page,
    index: row.index,
    id: row.id,
    isDraft: row.isDraft,
    text: row.text.slice(0, 160)
  }))
}, null, 2));

await browser.close();
