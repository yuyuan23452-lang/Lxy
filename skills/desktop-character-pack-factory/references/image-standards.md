# Image standards

## Standard-image selection

Prefer a source that has:

1. unmistakable identity and accurate markings;
2. a sharp, well-lit face;
3. the complete role, including ears, tail, paws, hair, or accessories;
4. little or no obstruction;
5. a neutral front or three-quarter pose reusable across several actions;
6. enough surrounding space for clean extraction.

Use other images as identity references when they show important angles or markings. Do not combine conflicting ages, haircuts, clothes, or designs without telling the user.

## Master transparent PNG

- Format: PNG with RGBA alpha.
- Canvas: 1024 x 1024.
- Subject: one role only.
- Background: fully transparent, including between legs and around loose fur where appropriate.
- Placement: horizontally centered on the bottom-center anchor.
- Ground line: keep the lowest visible contact point near 90% of canvas height.
- Safe margin: keep every visible part at least 6% from each canvas edge.
- Appearance: preserve face, eye color, markings, proportions, coat/hair texture, accessories, and source style.
- Shadow: omit drop shadows unless the user explicitly requests one.

## Pose references

- Preserve apparent body scale; do not enlarge a sleeping or lying pose merely to fill the canvas.
- Preserve the common ground line and bottom-center anchor even when the pose becomes shorter.
- Use the same canvas, camera distance, lighting style, and green color for all references.
- A start and end reference should match the desktop role's ordinary idle state whenever a smooth return is required.

## Pure-green reference

- Composite the approved transparent PNG over solid `#00FF00`.
- Do not add gradients, texture, horizon, floor, shadows, or green spill.
- Do not redraw or resize between transparent and green versions.
- Save as PNG.

## Visual acceptance

Reject or regenerate when:

- markings, face, body proportions, or accessories change;
- the subject is cropped;
- the subject moves vertically without action-related reason;
- the background is not uniform;
- alpha contains a rectangular opaque background;
- green contamination removes real green features from the role;
- thin fur/hair edges become heavily haloed.
