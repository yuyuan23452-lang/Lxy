# TFCC康复训练应用

![桌面版](../../assets/screenshots/tfcc-desktop.png)
![手机版](../../assets/screenshots/tfcc-mobile.png)

## 项目介绍

1. 四个阶段分阶段、分任务完成，先制作阶段说明，再制作动作动画，保持格式统一。
2. 先制作网页简单版，完成各个要素，再逐步修改完善。
3. 16 个动作动画，结合 Codex 生成的提示词与视频生成软件制作。
4. 动作独立控制，进入后点击播放，切换离开再返回时从头开始。
5. 提供网页版、桌面应用版、手机扫码版三种使用方式。

## 体验与下载

- [网页版](https://luxinyuan-tfcc.netlify.app)
- [下载window版](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/download/portfolio-2026-10-02/TFCC-Windows-1.3.1-x64.exe)
- [查看源码与说明](https://github.com/yuyuan23452-lang/ai-project-portfolio/tree/main/projects/tfcc)
- [手机版二维码](../../assets/screenshots/tfcc-qr.png)

![手机版二维码](../../assets/screenshots/tfcc-qr.png)

## 源码结构与复现

- `desktop/main.cjs`：Electron 窗口与内容加载。
- `desktop/ui`、`desktop/content`：界面、播放行为、动作内容。
- `desktop/scripts`：内容整理、版式生成和检查。
- `web/dist`：H5 页面、样式和交互；这里作为已生成的可维护页面源文件保留。
- `web/build.cjs` 与 `worker.mjs`：打包静态页面与媒体读写服务代码。运行服务需配置 R2 兼容绑定 `BUCKET`；上传令牌由运行环境注入，不随仓库提供。

桌面版：从 Release 下载 `tfcc-media.zip`，**在仓库根目录解压**，恢复 `projects/tfcc/desktop/content/*.mp4`。进入 `desktop` 后运行 `pnpm install --frozen-lockfile`，再运行 `pnpm start`；`pnpm run dist` 可生成 Windows 包。`prepare:content` 是历史素材整理脚本，引用原工作目录，不是当前干净检出的必需步骤；不要运行它覆盖已归档内容。

本地 H5：运行仓库的 `python scripts/prepare-tfcc-web.py`，将桌面媒体复制到 H5 目录，再在仓库根目录运行 `python -m http.server 8080`，访问 `/projects/tfcc/web/dist/`。部署服务代码前仍需自行准备媒体与运行环境；仓库不含历史上传状态和部署凭据。

[制作记录·codex聊天记录](../../docs/evidence/tfcc.md)
