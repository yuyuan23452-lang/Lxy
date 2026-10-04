# 圣诞树交互 HTML

最早的 AI 辅助制作项目。根据本人回顾：2025 年 12 月参考同类短视频效果，以 Gemini 辅助从空白页面制作，约三天完成；2025-12-15 开始分享。

![树形场景](../../assets/screenshots/christmas-tree.png)
![星云场景](../../assets/screenshots/christmas-nebula.png)
![照片特写](../../assets/screenshots/christmas-photo.png)

## 功能

|交互|效果|实现|
|---|---|---|
|握拳|粒子聚合为圣诞树|更新粒子目标位置并插值过渡|
|张开手掌|粒子展开为星云，照片形成展示云|Three.js 场景与图片纹理|
|伸出单指|选取一张已导入照片特写，带随机倾斜|本地文件读取与纹理显示|
|OK 手势|节日文字效果|Canvas 文本纹理与场景切换|
|手掌位置变化|影响场景旋转|MediaPipe 手部关键点位置映射|
|多图导入|选择本地多张照片，供照片云/特写使用|FileReader，不需要自建图片上传后台|

原代码包含 1100 个方块、600 个球体、300 个框和 400 个礼物实例；使用 Three.js r128 与 MediaPipe Hands。通过关键点距离规则判断手势，没有训练自有识别模型。

## 三种体验入口

- [交互版](https://luxinyuan-ai-projects.netlify.app/projects/christmas-tree/demo/?mode=gesture)：点击开启摄像头后识别手势，保留按钮作为备用入口。
- [按键版](https://luxinyuan-ai-projects.netlify.app/projects/christmas-tree/demo/?mode=buttons)：无需摄像头，点击按钮体验四种效果。
- [手机版](https://luxinyuan-ai-projects.netlify.app/projects/christmas-tree/demo/?mode=mobile)：扫码或直接打开，底部触控按钮、拖动旋转、手机相册导入。

三种入口共用场景代码。手机入口使用 800 个造型粒子、250 个雪花粒子，限制像素密度，导入最多 12 张照片并缩小到最长边 1024 像素。替换照片时释放旧纹理与展示对象。照片只在当前页面内读取，不上传服务器、不调用数据库；刷新后需重新导入。默认示例为项目集已有桌宠截图。

Three.js r128 随站点托管（MIT，版权头保留），手势依赖在用户点击开启摄像头后从 CDN 加载。手势版需要 HTTPS、摄像头权限以及模型资源可访问；按键版和手机版不会请求摄像头。

`source/10.html` 保留原始文件；本次新增和优化均在 `demo/index.html`。原版加载层依赖手势结果返回，演示版独立进入场景。

## 制作流程与证据

见 [Gemini 制作记录](../../docs/evidence/christmas-tree.md)。截图记录了旋转方向、滑动惯性、照片选择等需求讨论；讨论不等于每个方案都已进入现存代码。现存代码仍采用随机照片。

本次通过 DOM 与真实 Three.js 场景对象检查三种入口初始化、四种状态切换、拖动事件及尺寸变化；此验证不包含实际 GPU 渲染或真实摄像头识别，手机实机体验仍需测试。
