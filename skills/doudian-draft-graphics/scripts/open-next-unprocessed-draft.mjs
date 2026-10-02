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

const editText = String.fromCodePoint(0x7f16, 0x8f91);
const processed = new Set(
  (process.env.PROCESSED || process.argv[2] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);

const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://127.0.0.1:9222");
const context = browser.contexts()[0];

for (const page of context.pages().filter((page) => !page.isClosed() && page.url().includes("/ffa/g/create"))) {
  await page.close().catch(() => {});
}

let draft = context.pages().find((page) => !page.isClosed() && page.url().includes("/ffa/g/draft"));
if (!draft) {
  draft = await context.newPage();
  await draft.goto("https://fxg.jinritemai.com/ffa/g/draft", { waitUntil: "domcontentloaded" });
}

await draft.bringToFront();
await draft.waitForLoadState("domcontentloaded").catch(() => {});
await draft.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await draft.waitForSelector("tr.ecom-g-table-row", { timeout: 20000 });

async function clickPageNumber(pageNumber) {
  const clicked = await draft.evaluate((pageNumber) => {
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
  await draft.waitForTimeout(1500);
  await draft.waitForSelector("tr.ecom-g-table-row", { timeout: 20000 });
  return true;
}

async function rowsOnCurrentPage() {
  const rows = await draft.locator("tr.ecom-g-table-row").all();
  const result = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const text = (await row.innerText()).replace(/\s+/g, " ").trim();
    const id = text.match(/ID:(\d+)/)?.[1] || "";
    result.push({ index, id, text });
  }
  return { rows, data: result };
}

async function findNextOnPage(pageNumber) {
  if (pageNumber !== 1) {
    const ok = await clickPageNumber(pageNumber);
    if (!ok) return null;
  } else {
    await clickPageNumber(1).catch(() => {});
  }

  const { rows, data } = await rowsOnCurrentPage();
  const next = data.find((row) => row.id && !processed.has(row.id));
  if (!next) return null;
  return { pageNumber, rows, next };
}

let found = await findNextOnPage(1);
if (!found) found = await findNextOnPage(2);

if (!found) {
  console.log(JSON.stringify({ done: true, processed: Array.from(processed) }, null, 2));
  await browser.close();
  process.exit(3);
}

const row = found.rows[found.next.index];
const edit = row.locator("a,button,[role='button']", { hasText: editText }).first();
if (!(await edit.count())) throw new Error(`edit action not found for product ${found.next.id}`);

const pagePromise = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
await edit.click();
let editPage = await pagePromise;
if (!editPage) {
  await draft.waitForURL(/\/ffa\/g\/create/, { timeout: 15000 }).catch(() => {});
  editPage = draft.url().includes("/ffa/g/create")
    ? draft
    : context.pages().find((page) => !page.isClosed() && page.url().includes("/ffa/g/create"));
}

if (!editPage) throw new Error(`edit page did not open for product ${found.next.id}`);
await editPage.bringToFront();
await editPage.waitForLoadState("domcontentloaded").catch(() => {});
await editPage.waitForTimeout(8000);

console.log(JSON.stringify({
  done: false,
  pageNumber: found.pageNumber,
  rowIndex: found.next.index,
  id: found.next.id,
  rowText: found.next.text,
  opened: editPage.url()
}, null, 2));

await browser.close();
