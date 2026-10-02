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

const s = (...codes) => String.fromCodePoint(...codes);

const TEXT = {
  aiTools: s(0x41, 0x49, 0x7d20, 0x6750, 0x5de5, 0x5177),
  aiCreate: s(0x667a, 0x80fd, 0x521b, 0x4f5c),
  aiBackground: s(0x41, 0x49, 0x6362, 0x80cc, 0x666f),
  whiteCurtain: s(0x767d, 0x8272, 0x7a97, 0x5e18),
  generateNow: s(0x7acb, 0x5373, 0x751f, 0x6210),
  generateAgain: s(0x518d, 0x6b21, 0x751f, 0x6210),
  upload: s(0x4e0a, 0x4f20),
  crop: s(0x4ece, 0x31, 0x3a, 0x31, 0x4e3b, 0x56fe, 0x667a, 0x80fd, 0x88c1, 0x526a),
  detail: s(0x5546, 0x54c1, 0x8be6, 0x60c5),
  fillFromMain: s(0x4ece, 0x4e3b, 0x56fe, 0x586b, 0x5165),
  saveDraft: s(0x4fdd, 0x5b58, 0x8349, 0x7a3f),
  saveSuccess: s(0x4fdd, 0x5b58, 0x6210, 0x529f),
  draftSaveSuccess: s(0x8349, 0x7a3f, 0x4fdd, 0x5b58, 0x6210, 0x529f),
  generating: s(0x751f, 0x6210, 0x4e2d),
  imageGenerating: s(0x56fe, 0x7247, 0x751f, 0x6210, 0x4e2d),
  systemBusy: s(0x7cfb, 0x7edf, 0x7e41, 0x5fd9),
  generateFailed: s(0x751f, 0x6210, 0x5931, 0x8d25),
  failed: s(0x5931, 0x8d25)
};

const START_INDEX = Number(process.env.START_INDEX || process.argv[2] || "0");
const ONLY_MAIN = process.env.ONLY_MAIN === "1";
const SKIP_MAIN = process.env.SKIP_MAIN === "1";
const CDP_URL = process.env.CDP_URL || "http://127.0.0.1:9222";

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()
  .flatMap((context) => context.pages())
  .find((candidate) => candidate.url().includes("/ffa/g/create"));

if (!page) throw new Error("create page not found");

await page.bringToFront();
await page.waitForLoadState("domcontentloaded").catch(() => {});

const productId = new URL(page.url()).searchParams.get("product_id") || "";

function canon(src) {
  return (src || "").split("?")[0];
}

async function screenshot(name) {
  const outDir = path.resolve("new-flow-inspect");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}-${productId || "unknown"}-${Date.now()}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function bodyText() {
  return await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " "));
}

async function closeFloatingPanels() {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    for (const button of Array.from(document.querySelectorAll("button[aria-label='Close'], .ecom-g-modal-close"))) {
      const r = button.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) button.click();
    }
  }).catch(() => {});
  await page.waitForTimeout(700);
}

async function clickVisibleText(label, options = {}) {
  const target = await page.evaluate(({ label, minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity, exact = true, preferBottom = false, preferTop = false }) => {
    const candidates = Array.from(document.querySelectorAll("button,[role='button'],a,span,div,label"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(),
          disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          area: r.width * r.height
        };
      })
      .filter((item) => {
        const textMatches = exact ? item.text === label : item.text.includes(label);
        return textMatches
          && !item.disabled
          && item.rect.w > 0
          && item.rect.h > 0
          && item.rect.x >= minX
          && item.rect.x <= maxX
          && item.rect.y >= minY
          && item.rect.y <= maxY
          && item.area < 50000;
      });

    if (preferBottom) candidates.sort((a, b) => b.rect.y - a.rect.y || a.area - b.area);
    else if (preferTop) candidates.sort((a, b) => a.rect.y - b.rect.y || a.area - b.area);
    else candidates.sort((a, b) => a.area - b.area || a.rect.y - b.rect.y);
    return candidates[0] || null;
  }, { label, ...options });

  if (!target) throw new Error(`visible text not found: ${label}`);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(Number(options.afterMs || 800));
  return target;
}

async function scrollToText(label) {
  const ok = await page.evaluate((label) => {
    const nodes = Array.from(document.querySelectorAll("body *"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(),
          area: r.width * r.height
        };
      })
      .filter((item) => item.text === label)
      .sort((a, b) => a.area - b.area);
    if (!nodes[0]) return false;
    nodes[0].el.scrollIntoView({ block: "center", inline: "nearest" });
    return true;
  }, label);
  await page.waitForTimeout(800);
  return ok;
}

async function scrollToMainSection() {
  await scrollToText(TEXT.crop);
  await page.waitForTimeout(500);
}

async function getMainTiles() {
  await scrollToMainSection();
  const tiles = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img"))
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src,
          rect: { x: r.left, y: r.top, w: r.width, h: r.height },
          rounded: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        };
      })
      .filter((img) => {
        if (!img.src || img.src.startsWith("data:")) return false;
        const aspect = img.rect.w / Math.max(1, img.rect.h);
        return img.rect.w >= 70
          && img.rect.w <= 135
          && img.rect.h >= 70
          && img.rect.h <= 135
          && aspect > 0.86
          && aspect < 1.16
          && img.rect.x > 500
          && img.rect.x < 1300
          && img.rect.y > 220
          && img.rect.y < window.innerHeight - 100;
      })
      .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));

    if (!images.length) return [];
    const firstRowY = images[0].rect.y;
    const firstRow = images
      .filter((img) => Math.abs(img.rect.y - firstRowY) < 35)
      .sort((a, b) => a.rect.x - b.rect.x);

    const unique = [];
    for (const img of firstRow) {
      const duplicate = unique.some((seen) => Math.abs(seen.rect.x - img.rect.x) < 3 && Math.abs(seen.rect.y - img.rect.y) < 3);
      if (!duplicate) unique.push(img);
    }
    return unique;
  });

  return tiles;
}

async function openSingleImageAi(index) {
  const tiles = await getMainTiles();
  if (index >= tiles.length) {
    throw new Error(`main image index ${index} not found; visible main images: ${tiles.length}`);
  }

  const tile = tiles[index];
  const center = {
    x: tile.rect.x + tile.rect.w / 2,
    y: tile.rect.y + tile.rect.h / 2
  };

  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(700);

  const action = await page.evaluate(({ label, tile }) => {
    const candidates = Array.from(document.querySelectorAll("button,[role='button'],a,span,div,label"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          area: r.width * r.height
        };
      })
      .filter((item) => item.text === label
        && item.rect.w > 0
        && item.rect.h > 0
        && item.area < 5000
        && item.rect.x >= tile.rect.x - 180
        && item.rect.x <= tile.rect.x + tile.rect.w + 80
        && item.rect.y >= tile.rect.y - 140
        && item.rect.y <= tile.rect.y + 20)
      .sort((a, b) => a.area - b.area || Math.abs((a.rect.x + a.rect.w / 2) - (tile.rect.x + tile.rect.w / 2)) - Math.abs((b.rect.x + b.rect.w / 2) - (tile.rect.x + tile.rect.w / 2)));
    return candidates[0] || null;
  }, { label: TEXT.aiCreate, tile });

  if (!action) {
    const shot = await screenshot(`missing-single-ai-${index + 1}`);
    throw new Error(`single-image AI action not found for image ${index + 1}; screenshot: ${shot}`);
  }

  await page.mouse.click(action.x, action.y);
  await page.waitForTimeout(2500);
  await page.waitForFunction((aiTools) => (document.body.innerText || "").includes(aiTools), TEXT.aiTools, { timeout: 20000 });
  return { tile: tile.rounded, action };
}

async function waitForUploadButton(timeoutMs = 150000) {
  const started = Date.now();
  let lastState = null;

  while (Date.now() - started < timeoutMs) {
    const state = await page.evaluate((text) => {
      const body = (document.body.innerText || "").replace(/\s+/g, " ");
      const uploadButtons = Array.from(document.querySelectorAll("button,[role='button']"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(),
            disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            x: r.left + r.width / 2,
            y: r.top + r.height / 2
          };
        })
        .filter((item) => item.text === text.upload
          && !item.disabled
          && item.rect.w > 0
          && item.rect.h > 0
          && item.rect.x > 950)
        .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
      return {
        hasBusy: body.includes(text.systemBusy),
        hasFailed: body.includes(text.generateFailed) || body.includes(text.failed),
        hasGenerating: body.includes(text.generating) || body.includes(text.imageGenerating),
        upload: uploadButtons[0] || null,
        bodyTail: body.slice(-500)
      };
    }, TEXT);

    lastState = state;
    if (state.upload) return state.upload;
    if ((state.hasBusy || state.hasFailed) && !state.hasGenerating) return { failed: true, state };
    await page.waitForTimeout(1000);
  }

  const shot = await screenshot("wait-upload-timeout");
  throw new Error(`generated upload button did not appear; screenshot: ${shot}; state: ${JSON.stringify(lastState)}`);
}

async function generateBackgroundAndUpload() {
  await clickVisibleText(TEXT.aiBackground, { minX: 500, maxX: 950, afterMs: 900 });
  await clickVisibleText(TEXT.whiteCurtain, { minX: 600, maxX: 1050, afterMs: 500 });

  let attempt = 0;
  while (attempt < 8) {
    attempt += 1;
    const label = attempt === 1 ? TEXT.generateNow : TEXT.generateAgain;
    let clicked;
    try {
      clicked = await clickVisibleText(label, { minX: 650, maxX: 1050, preferBottom: true, afterMs: 1500 });
    } catch {
      clicked = await clickVisibleText(TEXT.generateNow, { minX: 650, maxX: 1050, preferBottom: true, afterMs: 1500 });
    }

    const upload = await waitForUploadButton();
    if (!upload.failed) {
      await page.mouse.click(upload.x, upload.y);
      await page.waitForTimeout(7000);
      await page.waitForFunction((aiTools) => !(document.body.innerText || "").includes(aiTools), TEXT.aiTools, { timeout: 30000 }).catch(() => {});
      return { attempt, clicked, upload };
    }

    if (attempt >= 8) {
      const shot = await screenshot("generation-failed");
      throw new Error(`AI background generation failed after ${attempt} attempts; screenshot: ${shot}; state: ${JSON.stringify(upload.state)}`);
    }
    await page.waitForTimeout(5000);
  }
}

async function processMainImages() {
  const initialTiles = await getMainTiles();
  if (!initialTiles.length) throw new Error("no 1:1 main images found");
  const total = initialTiles.length;
  const processed = [];

  for (let index = START_INDEX; index < total; index += 1) {
    await closeFloatingPanels();
    const opened = await openSingleImageAi(index);
    const uploaded = await generateBackgroundAndUpload();
    processed.push({ index, opened, uploaded });
  }

  await closeFloatingPanels();
  return { total, startIndex: START_INDEX, processed };
}

async function getVisibleImageTiles() {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img"))
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src,
          rect: { x: r.left, y: r.top, w: r.width, h: r.height },
          rounded: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        };
      })
      .filter((img) => {
        if (!img.src || img.src.startsWith("data:")) return false;
        const aspect = img.rect.w / Math.max(1, img.rect.h);
        return img.rect.w >= 70
          && img.rect.w <= 155
          && img.rect.h >= 70
          && img.rect.h <= 155
          && aspect > 0.65
          && aspect < 1.45
          && img.rect.x > 500
          && img.rect.x < 1250
          && img.rect.y > 120
          && img.rect.y < window.innerHeight - 60;
      })
      .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
  });
}

async function getMainImageSrcs() {
  await scrollToMainSection();
  const tiles = await getMainTiles();
  return tiles.slice(0, 3).map((img) => img.src);
}

async function getDetailImages() {
  const tiles = await getVisibleImageTiles();
  return tiles
    .filter((img) => img.rect.y > 240)
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
}

async function deleteFirstDetailImages(count) {
  const deletes = [];
  for (let i = 0; i < count; i += 1) {
    const images = await getDetailImages();
    const img = images[0];
    if (!img) break;
    await page.mouse.move(img.rect.x + img.rect.w / 2, img.rect.y + img.rect.h / 2);
    await page.waitForTimeout(250);
    const point = { x: img.rect.x + img.rect.w - 12, y: img.rect.y + img.rect.h - 18 };
    await page.mouse.click(point.x, point.y);
    deletes.push({ rect: img.rounded, point });
    await page.waitForTimeout(650);
  }
  return deletes;
}

async function waitForDetailImagesAtLeast(count, timeoutMs = 12000) {
  const started = Date.now();
  let images = [];
  while (Date.now() - started < timeoutMs) {
    images = await getDetailImages();
    if (images.length >= count) return images;
    await page.waitForTimeout(800);
  }
  return images;
}

async function dragDetailImageToIndex(src, index) {
  const images = await getDetailImages();
  const currentIndex = images.findIndex((img) => canon(img.src) === canon(src));
  if (currentIndex === -1) {
    throw new Error(`detail image source not found for main image ${index + 1}`);
  }
  if (currentIndex === index) return { skipped: true, index };

  const current = images[currentIndex];
  const target = images[index];
  if (!target) throw new Error(`target detail index ${index} not found`);

  const from = { x: current.rect.x + current.rect.w / 2, y: current.rect.y + current.rect.h / 2 };
  const to = { x: target.rect.x + target.rect.w / 2, y: target.rect.y + target.rect.h / 2 };
  await page.mouse.move(from.x, from.y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 18 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(900);
  return { skipped: false, index, currentIndex, from, to };
}

async function cropAndFillDetail() {
  await closeFloatingPanels();
  await scrollToMainSection();
  await clickVisibleText(TEXT.crop, { minX: 500, afterMs: 3500 });

  const mainSrcs = await getMainImageSrcs();
  if (mainSrcs.length < 3) {
    throw new Error(`could not identify first three main images: ${JSON.stringify(mainSrcs)}`);
  }

  await scrollToText(TEXT.detail);
  const deletes = await deleteFirstDetailImages(3);

  let detailImages = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickVisibleText(TEXT.fillFromMain, { minX: 500, afterMs: 1800 });
    detailImages = await waitForDetailImagesAtLeast(3, 10000);
    if (detailImages.length >= 3) break;
  }

  if (detailImages.length < 3) {
    const shot = await screenshot("detail-fill-empty");
    throw new Error(`detail images did not appear after fill from main; count=${detailImages.length}; screenshot: ${shot}`);
  }

  const moves = [];
  for (let i = 0; i < 3; i += 1) {
    moves.push(await dragDetailImageToIndex(mainSrcs[i], i));
  }

  return { mainImageCount: mainSrcs.length, deletes, moves };
}

async function saveDraft() {
  await closeFloatingPanels();
  const button = await clickVisibleText(TEXT.saveDraft, { minX: 500, preferBottom: true, afterMs: 1500 });
  let status = null;

  for (let i = 0; i < 45; i += 1) {
    await page.waitForTimeout(1000);
    status = await page.evaluate((text) => {
      const body = (document.body.innerText || "").replace(/\s+/g, " ");
      return {
        url: location.href,
        hasSuccess: body.includes(text.saveSuccess) || body.includes(text.draftSaveSuccess),
        stillEditing: location.href.includes("/ffa/g/create"),
        tail: body.slice(-1000)
      };
    }, TEXT);

    if (status.hasSuccess || !status.stillEditing) break;
  }

  const shot = await screenshot(status?.hasSuccess || !status?.stillEditing ? "save-draft-done" : "save-draft-check");
  return { button, status, screenshot: shot };
}

const result = {
  productId,
  startIndex: START_INDEX,
  onlyMain: ONLY_MAIN,
  skipMain: SKIP_MAIN,
  main: null,
  graphics: null,
  save: null
};

if (!SKIP_MAIN) {
  result.main = await processMainImages();
}

if (!ONLY_MAIN) {
  result.graphics = await cropAndFillDetail();
  result.save = await saveDraft();
}

console.log(JSON.stringify(result, null, 2));
await browser.close();

if (!ONLY_MAIN && result.save?.status?.stillEditing && !result.save?.status?.hasSuccess) {
  process.exitCode = 4;
}
