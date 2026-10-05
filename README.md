#  AI 应用项目集

四个 AI 辅助项目的源码、功能说明、程序下载与制作记录。

|项目|主要功能|说明|体验与下载|
|---|---|---|---|
|抖店商品编辑skill|主图生图、图文整理、价格库存与尺码表、保存草稿、批量接续|[功能说明](projects/doudian/README.md)|[安装 Skill](docs/SKILL-INSTALL.md) · [制作记录](docs/evidence/doudian.md)|
|TFCC康复训练应用|阶段导航、动作选择、独立播放与扫码网页|[功能与源码](projects/tfcc/README.md)|[网页体验](https://luxinyuan-tfcc.netlify.app) · [Windows 下载](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/tag/portfolio-2026-10-02)|
|AI桌面宠物|桌面角色、技能素材、状态配置与素材准备|[功能与源码](projects/doudou/README.md)|[Windows 下载](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/tag/portfolio-2026-10-02) · [工厂 Skill](skills/desktop-character-pack-factory)|
|交互圣诞树|3D 粒子场景、手势切换与本地照片展示|[功能与原始 HTML](projects/christmas-tree/README.md)|下载后打开 [演示页](projects/christmas-tree/demo/index.html)|

## 项目预览

从 [Releases 下载](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/tag/portfolio-2026-10-02) `portfolio-preview.zip`，解压后打开 `index.html`，即可浏览项目汇总页、功能截图与制作记录。GitHub 的 HTML 文件页面显示源码；下载后在浏览器中打开才能运行。圣诞树演示需要联网加载外部库。

## 安装 Skill

下载 Release 中的 `codex-skills.zip`，解压后阅读 `docs/SKILL-INSTALL.md`。也可以把 Skill 文件夹链接交给 Codex 安装。完整方法见 [安装与使用说明](docs/SKILL-INSTALL.md)。

## 文件内容

- `projects/`：各项目源码、功能与运行说明。
- `skills/`：三个可分别安装的 Skill 目录。
- `docs/evidence/`：制作记录。
- `assets/screenshots/`：功能界面及制作过程截图。
- `scripts/`：Skill 安装与 TFCC 媒体准备脚本。

较大的 Windows 程序和 TFCC 视频位于 Releases。`tfcc-media.zip` 在仓库根目录解压后，恢复 `projects/tfcc/desktop/content/` 下的视频；文件校验值见附件 `SHA256SUMS.txt`。

[版本与验证记录](docs/VERIFICATION.md) · [截图来源](docs/SCREENSHOTS.md)

当前仓库为私有，查看与下载需要访问权限。第三方库和素材保留原有权利；本仓库尚未指定整包开源许可证。

项目三补充：[WebM 转换器](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/download/portfolio-2026-10-02/Doudou-WebM-Converter.exe) · [制作记录](docs/evidence/doudou.md) · [原始需求文档](projects/doudou/records/小狗修改文案.doc)。
