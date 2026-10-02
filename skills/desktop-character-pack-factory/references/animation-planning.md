# Animation planning and Kling prompts

## Plan the smallest useful set

Separate assets into:

- **Required foundation**: ordinary idle, inactivity-loop state, and any transition required by the user's configured flow.
- **Useful transitions**: enter inactivity and recover from inactivity.
- **Optional presentation**: opening, exit, and signature skills.
- **Scene skills**: swimming, rolling on grass/sand, bathing, or other actions whose environment should remain integrated.

Do not propose a large library before one foundation animation has been generated, processed, imported, and visually tested.

## Duration guidance

- Tiny reaction or recovery: 3-4 seconds.
- Idle or breathing loop: 4-6 seconds.
- One expressive skill: 4-7 seconds.
- Transition with posture change: 5-7 seconds.
- Multi-step opening: 6-10 seconds.
- Scene skill: 6-10 seconds.

Use the shortest duration that leaves the action readable. Allocate explicit time ranges only when they improve control.

## Reference-mode selection

- Use **first/last frame** when exact start and return poses matter.
- Use **image reference** when identity matters more than an exact ending.
- Use **multiple references** when an intermediate posture is visually difficult or identity changes across angles.
- Use a green reference for transparent-role animations.
- A scene animation may use the transparent or green master only as identity reference; explicitly describe the environment.

## Prompt structure

Write prompts in this order:

1. output duration, aspect ratio, fixed camera, and single shot;
2. `@reference` identity assignments;
3. appearance lock;
4. start pose and position;
5. action timeline;
6. end pose and hold;
7. background and anchor lock;
8. exclusions.

## Transparent-role prompt template

```text
生成一段[时长]秒、1:1构图、固定机位、单镜头的角色动画。以 @角色标准绿幕.png 作为“[角色名]”唯一的角色外形、颜色和动画风格参考；以 @姿势参考.png 作为[中间/结束]姿势参考。

严格保持[角色名]的脸型、眼睛、毛色/服装、身体比例和细节不变。视频开始时，[起始姿势和朝向]。随后：[按时间顺序描述一个清楚动作]。最后[结束姿势]并稳定保持至少0.3秒，方便衔接。

角色始终位于画面中央偏下，底部中心锚点固定，大小、镜头距离和画面位置保持一致；不得突然放大、缩小、漂移、旋转画面或裁切。背景和地面均为均匀纯绿色 #00FF00，无渐变、纹理、地平线和阴影。画面中只有一个角色，不要文字、标志、额外动物、人物或道具。
```

## Scene-animation prompt template

```text
生成一段[时长]秒、1:1构图、固定机位、单镜头的局部场景动画。以 @角色标准图.png 作为“[角色名]”唯一的外形、颜色、身体比例和风格参考。

场景为[简洁场景]。视频开始时，[起始动作]。随后：[动作过程]。最后[结束动作]并稳定保持。角色身份和比例必须始终一致，动作自然连续，角色与水面/草地/沙地等环境真实接触，不得出现身体与场景分离。

镜头不移动、不旋转、不推近、不拉远；角色完整可见，不得裁切。不要文字、标志、额外人物或动物。
```

## Fallback prompt

When a generation fails, shorten the prompt to:

- one identity reference;
- one action;
- one fixed start;
- one fixed end;
- camera, scale, anchor, and background locks;
- a short exclusion list.

Do not keep adding more constraints to a failed prompt. Reduce action complexity first.
