# TFCC 四阶段训练应用

将分散的动作说明、静态图与动画整理为可选择阶段、可控制播放的 Windows 应用和手机网页。

![桌面应用](../../assets/screenshots/tfcc-desktop.png)
![手机网页](../../assets/screenshots/tfcc-mobile.png)

## 功能

|功能|具体行为|
|---|---|
|分阶段导航|四阶段内容与 16 个动作的选择入口；阶段说明与免责声明可阅读|
|独立播放|每个动作独立控制；选择动作后等待点击播放；切换离开再返回从头开始|
|播放控制|暂停、继续、重播以及对应动作的时间反馈；完成后停留，便于复看|
|桌面使用|Electron 封装为 Windows x64 便携程序，随包携带本地内容|
|手机入口|网页适配手机，通过二维码打开，无需先安装原生小程序|

## 体验

- [打开既有网页](https://tfcc-rehab-training.myworkspace-5247.chatgpt.site)（本次归档未重新发布或改动线上服务）。
- [下载 Windows 1.3.1](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/tag/portfolio-2026-10-02)。
- 扫码打开同一网页：

![二维码](../../assets/screenshots/tfcc-qr.png)

## 源码结构与复现

- `desktop/main.cjs`：Electron 窗口与内容加载。
- `desktop/ui`、`desktop/content`：界面、播放行为、动作内容。
- `desktop/scripts`：内容整理、版式生成和检查。
- `web/dist`：H5 页面、样式和交互；这里作为已生成的可维护页面源文件保留。
- `web/build.cjs` 与 `worker.mjs`：打包静态页面与媒体读写服务代码。运行服务需配置 R2 兼容绑定 `BUCKET`；上传令牌由运行环境注入，不随仓库提供。

桌面版：从 Release 下载 `tfcc-media.zip`，**在仓库根目录解压**，恢复 `projects/tfcc/desktop/content/*.mp4`。进入 `desktop` 后运行 `pnpm install --frozen-lockfile`，再运行 `pnpm start`；`pnpm run dist` 可生成 Windows 包。`prepare:content` 是历史素材整理脚本，引用原工作目录，不是当前干净检出的必需步骤；不要运行它覆盖已归档内容。

本地 H5：运行仓库的 `python scripts/prepare-tfcc-web.py`，将桌面媒体复制到 H5 目录，再在仓库根目录运行 `python -m http.server 8080`，访问 `/projects/tfcc/web/dist/`。部署服务代码前仍需自行准备媒体与运行环境；仓库不含历史上传状态和部署凭据。

## 本人职责与实现方式

本人定义展示内容、动作切换逻辑、播放/暂停规则和阶段阅读方式，反复检查排版和行为，并根据使用入口选择先做扫码网页。Codex 辅助页面、交互逻辑、Electron 封装与测试。内容和动画版本沿用已有项目。

这是学习与个人使用的内容呈现工具；不是诊断、个体化医疗建议或已验证疗效的医疗产品。没有临床试验或用户康复成效数据。扫码版采用 H5 网页。

[查看制作过程](../../docs/evidence/tfcc.md) · [查看验证范围](../../docs/VERIFICATION.md)
