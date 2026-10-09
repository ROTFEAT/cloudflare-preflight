# 实际运行证据

## 1.0.3 — 2026-10-09

本次版本 **1.0.3** 的实际输出保存在 [v1.0.3/](v1.0.3/)。[summary.json](v1.0.3/summary.json) 记录统一命令全部三个阶段通过：112 个 Node 测试、22 个 workerd 测试，以及干净安装／离线打包检查。原始日志：[统一命令](v1.0.3/unified.log)、[Node](v1.0.3/unit-integration.log)、[workerd](v1.0.3/workerd.log)、[打包](v1.0.3/package.log)。这些文件是实际输出的原字节副本。

新增集成回归覆盖应用时间边界／停止／源站证据缺失、伪造必需测试集合、真实局部 fetch 与 service binding，以及报告中的未知值。新增 workerd 模型覆盖虚拟第 23／30 天、重复时间戳、错过刷新、非法／回退时钟、持久停用与排队回调重放。模型统计逻辑刷新和控制读取，不是生产计费指标；停止后两个模拟回调仍发生两次状态读取，没有新增刷新或调度。

[package-check.json](v1.0.3/package-check.json) 记录 `1.0.3`／`v1.0.3`、安装包字节数、实际 SHA-256，以及干净离线解包和 CLI 版本核验结果。测试没有连接 Cloudflare 账户；包检查中的 INCOMPLETE / exit 2 是缺少应用语义审查时的预期拒绝，不是应用发布许可。源站检查是应用证据门禁，未验证云端源站或 WAF 配置，也未取消正在执行的远程工作。

The actual 1.0.3 outputs preserve 112 passing Node tests, 22 passing workerd tests, and the clean package check. New delayed-state and stop fixtures use bounded injected-clock models. Application-specific origin, time-boundary and stop evidence is still required; these engineering tests are not cloud verification or application release approval.

## 1.0.2 — 2026-10-09

本次版本 **1.0.2** 的实际输出保存在 [v1.0.2/](v1.0.2/)。[summary.json](v1.0.2/summary.json) 记录统一命令全部三个阶段通过：104 个 Node 测试、17 个 workerd 测试，以及干净安装／离线打包检查。原始日志：[统一命令](v1.0.2/unified.log)、[Node](v1.0.2/unit-integration.log)、[workerd](v1.0.2/workerd.log)、[打包](v1.0.2/package.log)。这些文件是实际输出的原字节副本。

[package-check.json](v1.0.2/package-check.json) 记录统一后的版本号 `1.0.2`、标签 `v1.0.2`、安装包字节数、实际 SHA-256，以及干净离线解包和 CLI 版本核验结果。测试没有连接 Cloudflare 账户；包检查中的 INCOMPLETE / exit 2 是缺少应用语义审查时的预期拒绝，不是应用发布许可。

The actual 1.0.2 outputs preserve all 104 passing Node tests, 17 passing workerd tests, and the clean package check. The manifest and packaged CLI use the same three-part version. Historical records below retain their original identifiers.

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
