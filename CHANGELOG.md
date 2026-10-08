# 更新日志 / Changelog

## 1.00 — 2026-10-08

标准版本 / Package version: `1.0.0` · Git tag: `v1.00`

首个仓库版本，包含：

- Cloudflare 部署前成本安全 Skill；支持部署意图与 `/skills`／显式提及检查。
- 固定的官方 Cloudflare Skills、12 条 P0 规则、只读 AST／配置／SQL 分析。
- 36 个基础样例、20 个部署／官方集成场景、变异／沙箱／门禁测试及 workerd 验证。
- Ed25519 审查签名、当前发布身份核验、逐项限期 REVIEW 审批。
- 受控本地发布入口、密封只读产物交接、CI 示例和离线安装包。
- 默认中文与独立英文 README；九个案例、全部 32 条来源及实际测试记录。
- 随 Skill 分发的版本清单、CLI 版本查询和打包一致性检查。

This first repository release includes the predeployment Skill, pinned official Cloudflare Skills, 12 P0 rules, read-only analysis, bounded tests, signed release evidence, an independent gate, controlled publisher integration, offline installation, and Chinese/English documentation. Version identity ships with the Skill and is checked during packaging.

已知边界 / Known limits: 宿主隐式触发、实际账户状态和线上发布配置尚未完整验证；直接 CLI／控制台／未接入的 Workers Builds 仍为 partial coverage。P1、价格引擎和生产隔离未实现。详见 [覆盖说明](docs/coverage.md)与[开发报告](docs/development-report.zh-CN.md)。

Historical development evidence may show `0.1.0`; those original records are preserved and do not describe the published version. No Cloudflare production deployment is part of this release.

发布后 CI 配置修正 / Post-release CI configuration: 首次 GitHub 工程验证发现 setup-node 的 `/opt` 路径在离线沙箱内不可见。主分支补充系统 Node 准备与测试 PATH 设置；Skill 与安装包代码保持 1.00，原 `v1.00` 标签保留。首次运行记录：[37781000054](https://github.com/ROTFEAT/cloudflare-preflight/actions/runs/37781000054)。
