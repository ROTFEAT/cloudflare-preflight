# 实际运行证据

## 1.01 — 2026-10-09

本次版本 **1.01**（标准版本 **1.0.1**）的实际输出保存在 [v1.01/](v1.01/)。[summary.json](v1.01/summary.json) 记录统一命令全部三个阶段通过：104 个 Node 测试、17 个 workerd 测试，以及干净安装／离线打包检查。原始日志：[统一命令](v1.01/unified.log)、[Node](v1.01/unit-integration.log)、[workerd](v1.01/workerd.log)、[打包](v1.01/package.log)。这些文件是实际输出的原字节副本。

[package-check.json](v1.01/package-check.json) 记录安装包的版本、字节数、实际 SHA-256，以及干净离线解包和 CLI 版本核验结果。测试没有连接 Cloudflare 账户；包检查中的 INCOMPLETE / exit 2 是缺少应用语义审查时的预期拒绝，不是应用发布许可。

This directory preserves the actual 1.01 test and package outputs separately from earlier records. All 104 Node tests, 17 workerd tests, and the clean package check passed. Historical records below remain unchanged.

## 1.00 — 2026-10-08

本目录保留 2026-10-08 版本 **1.00**（标准版本 **1.0.0**）的实际输出，不是期望结果模板。最后统一运行的 [summary.json](summary.json) 与三份阶段日志对应 104 个 Node 测试、17 个 workerd 测试及一次包检查；全部通过。`unified.log` 是统一命令的 stdout/stderr。原始绝对日志位置保留在 summary 中，本目录是原字节副本。

`package-check.json` 记录实际归档路径、摘要、字节数和离线干净解包结果。内层 CLI 对缺少应用审查返回 exit 2 是断言的期望拒绝，不能理解为应用可发布。

`forward/` 保存独立 Agent 的两批显式前向评估：initial 三个应用及 corrected 两个 DO 应用。每个子目录的 `input/` 是实际读过的应用输入；报告保留原来的 `/tmp` 路径和所审工具摘要，不改写历史证据。复制清单／SHA-256 在 [manifest.json](forward/manifest.json)。未重复三次，未测试宿主隐式触发，没有运行真实云端发布。

历史报告有确实发现的错误、未运行测试和非零退出；最终开发修复及验证范围见 [交付报告](../development-report.zh-CN.md)。历史报告不是最终版本签名，不能用于批准当前工具或应用发布。

`delivery-checks.json` 是最后的 Skill 结构、schema／索引／官方文件摘要／文档链接及保留证据一致性检查。该检查不替代功能测试。
