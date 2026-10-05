# Skill 安装与使用

GitHub 链接用于查看和下载文件。把 Skill 安装到 Codex 后，才能在对话中调用；打开链接本身不会启动商品操作。

本仓库已公开，可直接查看源码和下载附件，无需申请仓库访问权限。

## 方法一：让 Codex 根据链接安装

在自己的 Codex 对话中发送以下内容：

```text
请使用 $skill-installer 从以下 GitHub 目录安装 doudian-draft-graphics：
https://github.com/yuyuan23452-lang/Lxy/tree/main/skills/doudian-draft-graphics
本次只安装并检查 Skill 能否被发现，不执行商品操作。
```

无法通过链接安装时，可采用下面的手动下载方法。

## 方法二：下载 ZIP 后手动复制（Windows）

1. 打开 [项目 Releases](https://github.com/yuyuan23452-lang/Lxy/releases/tag/lxy)，在 **Assets** 中下载 `codex-skills.zip`，右键“全部解压”。这个包中有三个 Skill，可只安装所需的一项。
2. 打开解压文件夹中的 `skills`，找到 `doudian-draft-graphics`。确认该文件夹里能看到 `SKILL.md`、`agents` 和 `scripts`。
3. 在文件资源管理器地址栏输入 `%USERPROFILE%` 并回车。在自己的用户目录下创建 `.agents` 文件夹，再在里面创建 `skills` 文件夹（已存在则直接使用）。
4. 将完整的 `doudian-draft-graphics` 文件夹复制到 `.agents/skills/` 中。最终结构应如下，避免多套一层文件夹：

```text
你的用户目录/
└─ .agents/
   └─ skills/
      └─ doudian-draft-graphics/
         ├─ SKILL.md
         ├─ agents/
         └─ scripts/
```

5. 返回 Codex，新开对话，输入 `$doudian-draft-graphics`，或在技能列表中查找“抖店草稿图文处理”。若没有显示，重启 Codex 后再查找。

如果目标位置已有同名 Skill，先保留原版本并比较内容，再决定是否更新。

### 可选：用安装脚本复制

在解压文件夹中打开 PowerShell，运行：

```powershell
./scripts/install-skills.ps1
```

默认只安装 `doudian-draft-graphics`。脚本会显示安装位置；目标目录已存在时停止，不覆盖原内容。若系统禁止执行脚本，使用上面的手动复制方法即可。

另外两项可分别安装：

```powershell
./scripts/install-skills.ps1 -Skill desktop-character-pack-factory
./scripts/install-skills.ps1 -Skill doudian-draft-publisher
```

## 第一次调用

先给 Codex 这段话，让它检查环境：

```text
请检查 $doudian-draft-graphics 的运行条件：Node.js、Chrome、playwright-core、
Chrome 调试连接和抖店登录状态。先报告检查结果，暂不修改商品。
```

环境准备完成并登录自己的店铺后，再指定商品与范围：

```text
使用 $doudian-draft-graphics 处理我指定的一件草稿：逐张主图换背景、
生成 3:4 图并填入详情，最后保存草稿并核对状态。完成后报告结果。
```

安装仅复制 Skill 文件；不会提供店铺账号、平台生图额度或代替登录。

## 运行环境与手动检查

图文处理脚本使用 Windows PowerShell、Node.js、Google Chrome 与 `playwright-core`。在下载包根目录安装 Node 依赖：

```powershell
npm install
$env:BROWSER_TOOLS_DIR = (Get-Location).Path
$env:CODEX_NODE_PATH = (Get-Command node).Source
```

脚本默认连接 `http://127.0.0.1:9222`。以下命令使用独立 Chrome 用户目录启动本地调试窗口；由使用者在窗口中登录抖店：

```powershell
$chromePath = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
$profilePath = Join-Path $env:LOCALAPPDATA 'DoudianSkillDemoProfile'
Start-Process -FilePath $chromePath -WindowStyle Hidden -ArgumentList @('--remote-debugging-address=127.0.0.1','--remote-debugging-port=9222',('--user-data-dir="{0}"' -f $profilePath),'https://fxg.jinritemai.com/ffa/g/draft')
```

读取一页草稿状态：

```powershell
node ./skills/doudian-draft-graphics/scripts/inspect-draft-pages.mjs 1
```

下面的命令会实际编辑一件未处理草稿的图文并保存，运行前确认当前账号与处理范围：

```powershell
./skills/doudian-draft-graphics/scripts/run-remaining-new-flow.ps1 -WorkDir (Get-Location).Path -MaxIterations 1
```

## 包内其他 Skill

|目录|用途|运行条件|
|---|---|---|
|`doudian-draft-graphics`|主图生图、裁剪、详情填充、保存与批处理|见上文|
|`doudian-draft-publisher`|基础信息和发布步骤的指令/参考流程包|需单独确认类目、价格、规格及发布范围；不附带完整自动发布脚本|
|`desktop-character-pack-factory`|角色图筛选、透明图/绿幕图和动画提示词准备|Python、Pillow 与相应图像工具；不包含视频生成或完整角色包自动导出|

角色素材准备脚本可用 `python skills/desktop-character-pack-factory/scripts/prepare_project.py --help` 查看参数。

本地 Skill 目录与安装器用法参考 [OpenAI 官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)，核对日期 2026-10-02。
