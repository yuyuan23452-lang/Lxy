---
name: doudian-draft-publisher
description: Automate or guide the user's confirmed Douyin Shop / Doudian / 抖店商品草稿箱 editing and publishing workflow in Google Chrome. Use when the user asks Codex to process remaining 抖店商品草稿, edit product drafts, choose category/title/properties from 1:1 main images, run AI 智能创作 with prompt “换一个场景”, crop 主图3:4, refill 商品详情 from main images, set SKU colors/specs/sizes, set price 99, clear saleable stock, publish products, resume interrupted draft work, or verify that the draft box is empty.
---

# Doudian Draft Publisher

## Core Rules

Operate on live 抖店 seller data carefully. This skill is for the user's confirmed full workflow that ends with `发布商品`; use it only when the user asks to edit and publish drafts, or explicitly invokes this skill.

Before processing live drafts, read [references/workflow.md](references/workflow.md). Follow the user's newest message over the saved defaults if they conflict.

## Export scope

This archive includes this instruction-based skill and its workflow reference. Historical helper filenames in the reference are examples from the original workstation, not bundled executable scripts. Use available browser tools or write/verify helpers for the current page. Do not treat saved prices, sizes or attribute defaults as universal business rules; confirm those inputs for the new store before applying changes.

## Quick Start

1. Use Google Chrome with the user logged into 抖店.
2. Prefer browser automation through Chrome CDP when available; otherwise guide or perform the workflow manually in Chrome.
3. Open 草稿箱 and process one draft at a time.
4. Inspect the 1:1 main image before choosing title, attributes, and SKU colors.
5. Complete the full edit flow, publish, verify success, then continue to the next draft.
6. Stop when 草稿箱 shows `共0条` or `暂无数据`.

## Browser Automation

If local helper scripts are available, prefer them over re-creating fragile browser actions. This user's existing helper workspace has often been:

```powershell
$work = "$env:USERPROFILE\codex-browser-tools"
$node = "node"
```

Use those paths only after verifying they exist. If they are absent, inspect the current Chrome page and build small Playwright/CDP helpers as needed.

Chrome CDP usually defaults to:

```text
http://127.0.0.1:9222
```

If CDP is unavailable, ask the user to open Chrome with remote debugging and log into 抖店, or start a separate Chrome profile and wait for login.

## Reporting

Keep the user updated while working. At completion, report:

- How many drafts were submitted in this run.
- Whether 草稿箱 is empty.
- Any product IDs that needed recovery or differed from the ideal AI image workflow.
- Any platform limitation, especially AI 智能创作 returning system busy.
