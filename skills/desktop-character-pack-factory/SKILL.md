---
name: desktop-character-pack-factory
description: Prepare first-stage desktop-character assets from one or more role images. Use when Codex needs to collect a role name/category/personality, inspect and rank source images, create a consistent transparent PNG and pure-green reference set, or plan Kling animations with reference choices, durations, and copy-ready prompts containing @image references. This first version stops before video generation, matting, WebM conversion, app import, or final character-package export.
---

# Desktop Character Pack Factory

Build a reusable, reviewable image-and-prompt project before the user spends video-generation credits.

## Boundaries

- Produce role information, source-image assessment, transparent PNG assets, green reference assets, animation plans, and Kling prompts.
- Do not operate Kling, generate/download videos, use Jianying/CapCut, convert WebM, import into the desktop app, or export a finished character package.
- Preserve originals. Never overwrite a user source image.
- Before sending source files to an online image model, state which files will be processed and obtain confirmation unless the user explicitly authorized that upload in the current request.

## Workflow

### 1. Collect and initialize

Require:

- role name
- category: `宠物`, `人物`, or `其他`
- personality description
- one or more source images

Use reasonable defaults for optional items:

- style: preserve the supplied design
- canvas: 1024 x 1024
- anchor: bottom center
- green: `#00FF00`

Run `scripts/prepare_project.py` to create a project folder and image inventory. Use a user-selected output folder; otherwise create `character-factory-output/<role-name>` in the current workspace.

### 2. Inspect and select the standard image

View every source image. Read `references/image-standards.md` before selecting.

Rank images by identity accuracy, complete body visibility, sharpness, lack of obstruction, neutral reusable pose, and available margin. Do not select by resolution alone.

Write `动画规划/标准图选择.md` with:

- chosen standard image and concise reasons
- backup images and what each contributes
- limitations that later generations must protect

If no image can support a stable character, explain the exact missing view instead of fabricating certainty.

### 3. Create transparent and green references

Use the available image-generation/editing capability to create the transparent master. Preserve the role's face, markings, colors, proportions, fur/hair, clothing, and style. Do not redesign the character unless requested.

Generate additional pose references only when the animation plan requires them. Keep identity and apparent body scale consistent across all poses.

For every approved transparent PNG:

1. keep RGBA transparency;
2. use a 1024 x 1024 canvas;
3. align the role to the bottom-center anchor;
4. retain safe margins around all visible parts;
5. run `scripts/normalize_reference.py` when the model output is not exactly 1024 x 1024;
6. run `scripts/make_green_reference.py` to composite the exact PNG over `#00FF00`;
7. run `scripts/inspect_images.py` again and visually verify the result.

Do not ask an image model to redraw the green version when an approved transparent PNG already exists. Deterministic compositing prevents identity, size, and position drift.

### 4. Plan animations and Kling prompts

Read `references/animation-planning.md`.

Create `动画规划/动画规划表.md` and `动画规划/可灵提示词.md`. For every proposed animation include:

- animation name and category
- purpose in the desktop app
- transparent-role animation or scene animation
- recommended duration within 3-15 seconds
- reference mode: image reference, first/last frame, or multiple image references
- exact reference filenames
- exact copy-ready Kling prompt containing `@文件名`
- required start pose, end pose, camera, background, scale, position, and anchor
- one shorter fallback prompt for regeneration

Do not force every animation to five seconds. Allocate time according to action complexity. Prefer one clear action per short clip; use a longer opening clip only when its sequence is deliberate.

Reference tokens must match the names the user sees after uploading. If Kling renames them to `图片1`, `图片2`, update the prompt tokens accordingly before the user generates.

### 5. Review before handoff

Verify:

- the standard and pose images depict the same role;
- transparent PNGs have real alpha;
- green versions are exactly aligned with their transparent sources;
- no ears, tail, paws, hair, or accessories touch the canvas edge;
- each prompt explicitly locks identity, camera, size, position, background, start state, and end state;
- all prompts contain usable `@` references;
- the plan distinguishes required assets from optional ideas.

Show the generated images and summarize the first recommended video to generate. Stop there and wait for the user to create and import videos manually.

## Resources

- `references/image-standards.md`: selection, canvas, identity, transparency, and anchor rules.
- `references/animation-planning.md`: duration guidance, default animation set, and Kling prompt structure.
- `scripts/prepare_project.py`: create the role workspace and inventory source images.
- `scripts/inspect_images.py`: report dimensions, alpha, and green-background characteristics.
- `scripts/normalize_reference.py`: resize an approved square RGBA reference to the standard canvas.
- `scripts/make_green_reference.py`: produce an exactly aligned pure-green reference from an RGBA PNG.
