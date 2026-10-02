# 抖店商品草稿编辑发布流程

Use this reference when processing live 抖店商品草稿. The workflow below captures the user's demonstrated process and later corrections.

## Product Loop

For each draft:

1. Open the first/next row in `商品管理 > 草稿箱`.
2. In `图文信息`, inspect/download/screenshot the first 1:1 main image.
3. Use the main image, not only the row title, to decide category/title plausibility, materials, and color SKU values.
4. Edit the sections below.
5. Click `发布商品`.
6. Confirm the page says `商品提交成功`.
7. Return to/open 草稿箱 and continue until the list shows `共0条` or `暂无数据`.

## 基础信息

- `商品类目` and `商品标题`: determine from the 1:1 main image. If the existing title/category are plausible and publishing passes, do not over-edit them.
- `类目属性`:
  - Clear/delete `货号`.
  - Set `鞋面材质` from the image when the UI clearly supports it. Common choice for mesh/knit running shoes: `织物`.
  - Set `鞋底材质` from the image when needed. Common choice: rubber / `防滑橡胶`.
  - Do not block publishing if material dropdown automation is unreliable and the existing values are plausible.

## 图文信息

Ideal main-image workflow:

1. Click `AI智能创作`.
2. Prompt: `换一个场景`.
3. Wait until generated images finish.
4. Apply generated images to the product.
5. Keep only the first three AI-generated main images.

If the platform repeatedly returns `抱歉，由于系统繁忙生成失败，请您稍后再试。`, do not get stuck indefinitely. Retry briefly, then continue the non-AI workflow and tell the user which items could not receive AI-generated main images.

After main images:

1. Click `从1:1主图智能裁剪` for `主图3:4`.
2. In `商品详情`, delete the original first three detail images if present.
3. Click `从主图填入`.
4. Ensure the first three detail images are the first three current 1:1 main images. Reorder them if needed.

## 价格库存 / 商品规格

Leave these unchanged:

- `发货模式`
- `现货发货时间`
- `预售发货时间`

For `商品规格 > 颜色分类`:

- Turn off `添加规格图`.
- Choose colors from the 1:1 main image.
- If one color: keep one value and delete the extra color value.
- If two colors: keep two values and modify both.
- If three colors: add a third color value, then confirm the dropdown popup if it uses a multi-select `确定 (n)` button.
- After changing color count, re-run price/stock actions because new SKU rows may be generated.

Color heuristics:

- Single white/cream shoe: `米白色`.
- Black plus white/cream: `黑色`, `米白色`.
- Single black shoe: `黑色`.
- Grey/black single shoe: `灰色`.
- Grey and cream/white variants: `灰色`, `米白色`.
- Light blue / blue-green gradient: `浅蓝色` unless green is clearly dominant.
- Bright green / lime: `绿色`.
- Yellow/mustard: `姜黄色` if plain `黄色` is unavailable.
- White shoe with different colored accents can use accent colors if they distinguish variants, e.g. blue-heart and burgundy-heart variants: `蓝色`, `红色`.
- Multi-color athletic three-variant image: use the dominant variant colors, e.g. `绿色`, `红色`, `黑色`.

## 尺码表

- Use template `均码`.
- If the button text is `一键复用尺码信息`, click it and select `均码`.
- Preserve the draft's existing shoe sizes. The template name is the requirement, not changing every shoe to a single physical size.

## 价格与库存

- Set sale price to `99`.
- Use `批量设置`.
- Use `可售库存清零` and then `全部清零`.
- The UI may still display old `现货库存` values in some logs; the requirement is that `可售库存` is zero.

## 服务与履约

Do not modify service and fulfillment settings unless the user explicitly requests it.

## Publishing And Verification

Click `发布商品`. Success text should include `商品提交成功` and usually says review takes `1-2个工作日`.

Quality score notes:

- A score around 84 may appear for multi-color products because `添加规格图` is off. This matches the user's requested workflow.
- Report low scores or warnings, but do not undo requested settings unless the user asks.

## Recovery

If a step fails:

1. Inspect the current page before closing tabs.
2. Avoid destructive browser actions such as deleting image chips unless the workflow requires it.
3. If AI generation failed but the product can publish, continue non-AI edits and report the platform issue.
4. If a three-color addition creates an empty color box, reopen the color dropdown, choose the option, tick it if needed, click the popup `确定 (n)`, then verify the color is visible before publishing.
5. If a product was published with an incorrect color count, click `编辑商品`, fix the colors, re-run price/stock, and publish again.

## Useful Helper Commands

Verify helper paths before using them:

```powershell
$node = "node"
$work = "$env:USERPROFILE\codex-browser-tools"
Set-Location $work
```

Common helpers from the user's browser-tools workspace:

- `open-first-draft.mjs`: open the next draft row.
- `scroll-to-text.mjs 图文信息`: scroll to the image section.
- `screenshot-current-main-images.mjs`: save current main images for inspection.
- `property-tools.mjs clear 货号`: clear the item number field.
- `select-color.mjs <颜色> <index>`: set a color value.
- `delete-color-value.mjs <index>`: remove an extra color value.
- `add-color-value.mjs <颜色>`: add a third color; verify it persists.
- `sku-toggle-color-spec-image.mjs`: turn off color spec images.
- `detail-delete-three-fill-main.mjs`: delete first three detail images and fill from main images.
- `detail-reorder-main-first.mjs`: ensure main images are first in detail.
- `price-stock-actions.mjs`: set price 99 and clear saleable stock.
- `publish-current-product.mjs`: click publish and inspect success.
- `finish-current-after-colors-no-ai.ps1`: after colors are set, run crop/detail/size/price/stock/publish without AI main-image generation.

Always inspect command output or page screenshots when a helper reports an unexpected state.
