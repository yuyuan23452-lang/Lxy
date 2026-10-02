---
name: doudian-draft-graphics
description: Automate the user's Douyin Shop / 抖店 product draft graphics workflow in Google Chrome. Use when the user asks Codex to edit 抖店商品草稿箱图文信息, process product draft main images, run AI换背景 with 白色窗帘, crop 主图3:4, refill 商品详情 from main images, save drafts, resume interrupted draft processing, or verify that draft products remain 待提交 without publishing.
---

# Doudian Draft Graphics

## Core Rule

Operate on live 抖店 seller data carefully. Do not publish products unless the user explicitly changes the requirement. This saved workflow ends with `保存草稿`, not `发布商品`.

## Saved Workflow

For each product draft:

1. Open the product from 抖店 `商品草稿箱`.
2. In `图文信息`, process every visible `1:1 主图` one by one.
3. For each 1:1 image, hover the image tile and click its per-image `智能创作` action, not the global `AI智能创作` entry.
4. In `AI素材工具`, click `AI换背景`, select `白色窗帘`, click `立即生成`, wait until at least one generated image has an enabled `上传` button, and upload one acceptable generated image.
5. If the AI result shows `图片生成中`, keep waiting. If some cards show `生成失败` while other cards are still generating or uploadable, do not fail the whole step.
6. If generation really fails or reports system busy with no uploadable result, retry generation. Do not skip AI main-image replacement.
7. Click `从1:1主图智能裁剪` for `主图3:4`.
8. For `商品详情`, delete the original first three detail images if they exist. If detail is empty, skip deletion.
9. Click `从主图填入`, wait until detail images appear, and ensure the first three detail images are the first three 1:1 main images.
10. Click `保存草稿`.
11. Verify the product remains in 草稿箱 / `待提交`.

## Browser Setup

The scripts connect to Chrome through CDP, defaulting to `http://127.0.0.1:9222`.

Before running automation:

- Ensure Google Chrome is open with remote debugging enabled and logged into 抖店.
- If CDP is unavailable, start a separate Chrome profile with remote debugging and ask the user to log in:

```powershell
Start-Process "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=$env:TEMP\codex-doudian-chrome",
  "https://fxg.jinritemai.com/ffa/g/draft"
)
```

If the page is not logged in or cannot enter 抖店, stop and tell the user they need to log in.

## Scripts

Use bundled scripts from this skill's `scripts/` directory.

`scripts/run-remaining-new-flow.ps1`
: Loops through draft pages, opens the next unprocessed draft, runs the full graphics workflow, saves draft, and logs progress.

`scripts/process-current-graphics-new-flow.mjs`
: Runs the workflow on the currently open product edit page. Positional argument `0` starts at the first 1:1 main image; use `1` when the first main image was already handled manually.

`scripts/open-next-unprocessed-draft.mjs`
: Opens the next draft whose product ID is not in `PROCESSED`.

`scripts/inspect-draft-pages.mjs`
: Reads draft pages and prints product IDs/status for final verification.

## Common Commands

Use the bundled Node runtime when available. The scripts load `playwright-core` from the current workspace `node_modules`, `BROWSER_TOOLS_DIR`, or `PLAYWRIGHT_CORE_MJS`.

For this user's existing workspace, `work/browser-tools` usually already has `playwright-core` installed:

```powershell
$skill = "$env:USERPROFILE\.agents\skills\doudian-draft-graphics"
$work = "$env:USERPROFILE\codex-browser-tools"
$node = "node"
```

Run remaining drafts, skipping already processed IDs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$skill\scripts\run-remaining-new-flow.ps1" `
  -WorkDir "$work" `
  -Node "$node" `
  -InitialProcessed ""
```

Run the full workflow on the current edit page:

```powershell
Push-Location "$work"
& $node "$skill\scripts\process-current-graphics-new-flow.mjs" 0
Pop-Location
```

Run only crop/detail/save on the current edit page after AI main images are already handled:

```powershell
Push-Location "$work"
$env:SKIP_MAIN = "1"
& $node "$skill\scripts\process-current-graphics-new-flow.mjs" 0
Remove-Item Env:SKIP_MAIN -ErrorAction SilentlyContinue
Pop-Location
```

Verify draft pages:

```powershell
Push-Location "$work"
& $node "$skill\scripts\inspect-draft-pages.mjs" 2
Pop-Location
```

## Recovery

If a script stops mid-product:

1. Read the log in `doudian-draft-graphics-run`.
2. Inspect the current Chrome page before closing anything.
3. If AI panel still has an enabled `上传`, click upload or rerun the current-product script from the correct start index.
4. If AI main images are already done and failure happened in crop/detail/save, rerun with `SKIP_MAIN=1`.
5. Restart `run-remaining-new-flow.ps1` with `-InitialProcessed` containing all product IDs already saved successfully, including any manually recovered product.

Always report the number of saved drafts and the final verification result. Mention any product ID that required manual recovery.
