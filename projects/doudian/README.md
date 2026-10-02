# 自动处理抖店草稿箱商品信息 Skill

在 Chrome 的抖店商品草稿箱中，自动整理商品图文、保存草稿并继续处理下一件商品。

![图文处理 Skill 界面](../../assets/screenshots/doudian-skill.png)

现有 Skill 界面：主图处理顺序、生成结果判断和异常重试规则。

![裁剪、详情填充与保存流程](../../assets/screenshots/doudian-workflow.png)

现有 Skill 界面：生成 3:4 图、填入商品详情，保存并核对草稿。

## 功能介绍

1. **自动利用抖店 AI 生图。** 逐张打开 1:1 主图，进入 AI 换背景，选择白色窗帘，等待可用结果并上传到商品主图。生成中继续等待；生成失败或系统繁忙时按流程重试。
2. **自动填写商品图文信息。** 从 1:1 主图智能裁剪生成 3:4 图，更新商品详情前部图片并从主图填入，检查主图与详情的对应关系。
3. **自动保存并核对草稿。** 完成图文处理后保存草稿，再核对商品是否仍处于草稿箱 / 待提交状态。
4. **自动切换下一件商品。** 按草稿列表处理下一件未完成商品，记录已完成商品 ID 与执行日志；中断后可指定已完成 ID 接续处理。

当前图文处理 Skill 的结束动作是保存草稿。标题、类目、属性、规格、价格和发布流程位于独立的 [基础信息与发布 Skill](../../skills/doudian-draft-publisher)，该模块是指令与参考流程包，需要使用者确认业务规则和发布操作。

## 安装与使用

- [下载 Skill 安装包](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/download/portfolio-2026-10-02/codex-skills.zip)
- [逐步安装说明](../../docs/SKILL-INSTALL.md)
- [查看 Skill 源码](../../skills/doudian-draft-graphics)

运行图文自动处理需 Codex、Windows PowerShell、Node.js、Chrome、`playwright-core`，以及使用者自己的抖店登录。首次使用可指定一件允许编辑的草稿，完成后检查图文和状态，再处理其余商品。

安装完成后，可向 Codex 发送：

```text
使用 $doudian-draft-graphics 处理抖店草稿箱商品图文信息。先检查运行环境，
按我指定的商品范围执行；逐张主图换背景、裁剪和填入详情，最后保存草稿。
```

## 技术组成

|文件或工具|作用|
|---|---|
|`SKILL.md`|触发条件、处理顺序、结果判断与恢复方式|
|`agents/openai.yaml`|显示名称、说明和默认提示词|
|Node.js / `playwright-core`|通过 Chrome CDP 连接浏览器，处理页面与商品图片|
|PowerShell 批处理脚本|循环定位商品、记录日志与已完成 ID|

页面更新、弹窗、素材额度和账户权限可能影响执行，遇到无法完成的步骤会记录结果，供检查与接续。图片生成由抖店平台提供。

## 制作记录

操作演示 → 文字规则 → 执行与检查 → 问题排查及流程调整 → 封装 Skill。

[查看四张原始制作截图及五个步骤说明](../../docs/evidence/doudian.md) · [版本与验证范围](../../docs/VERIFICATION.md)
