# 豆豆透明 WebM 转换工具

将剪映导出的带 Alpha 透明通道的 MOV 转为桌面宠物可播放的 VP9 WebM。

[下载 Windows 程序](https://github.com/yuyuan23452-lang/ai-project-portfolio/releases/download/portfolio-2026-10-02/Doudou-WebM-Converter.exe)

1. 在剪映中完成抠图，导出保留 Alpha 通道的 MOV 文件。
2. 打开转换工具，选择输入视频和输出位置。
3. 检查界面是否显示已检测到透明通道，再选择画布与画质。
4. 点击开始转换，完成后将 WebM 导入桌宠技能库并预览。

工具使用 FFmpeg 完成转换；若提示找不到 FFmpeg，需按提示配置运行环境。转换过程会移除音轨，工具本身不负责绿幕抠图。

本文件为现有 Windows 程序的原件归档，未重新编译。校验值见 Release 的 `SHA256SUMS.txt`。
