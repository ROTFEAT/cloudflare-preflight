# 更新日志 / Changelog

## 1.0.3 — 2026-10-09

Git tag: `v1.0.3`

- 默认中文、独立英文及中文样本的 README 标题统一为仓库名 `cloudflare-preflight`，保留现有 Skill 和 CLI 名称。
- 参考 [ZPVIP/no-billshock@1250f01](https://github.com/ZPVIP/no-billshock/tree/1250f01a085cfe955e1189e38502b5a4428734da) 的延迟刷新、源站绕过、停止后剩余工作量与报告分层，纳入现有 12 条 Cloudflare P0 规则及只读审查流程。
- 为适用路径增加 `do-time-boundaries`、`background-stop` 和 `origin-access` 应用证据要求；缺失记录或伪造必需测试集合会拒绝门禁。
- 修正对象／类方法被误当作模块局部函数的问题，避免 Worker 的 `fetch()` 方法遮蔽全局外部 `fetch()` 调用。
- 增加 8 个集成回归及 5 个 workerd 测试，覆盖时间边界、陈旧时间戳、持久停用、源站路径和报告未知值；报告摘要区分代码证据、本地验证及未核验的云端控制。

Uses the repository name for README titles and adopts delayed-state, origin-access, bounded-stop and reporting ideas within the existing Cloudflare preflight. Adds conditional application test requirements, fixes lexical fetch resolution, and retains the read-only reviewer and independent publisher boundary. No AWS account integration or live cloud controls are added.

验证记录 / Verification: [1.0.3 离线测试与包检查](docs/test-results/v1.0.3/summary.json)。历史记录与标签保持原样。

## 1.0.2 — 2026-10-09

Git tag: `v1.0.2`

- 统一使用 `MAJOR.MINOR.PATCH` 三段式版本号，README、Skill、软件包、报告与 Git 标签不再维护单独的两位小数展示编号。
- 保留“每次提交都升版”的约定；文档和 CI 改动也至少递增 PATCH，兼容新增和不兼容改动分别递增 MINOR、MAJOR。
- 同步版本清单、Skill 元数据、规则表和双语文档；为兼容现有 CLI 输出，`display_version` 字段保留且与 `version` 相同。

Uses one SemVer across the README, Skill, package, reports, and Git tags. Every commit still increments the version, including documentation and CI changes. The retained `display_version` field equals `version`. Historical records and published tags keep their original identifiers.

验证记录 / Verification: [1.0.2 离线测试与包检查](docs/test-results/v1.0.2/summary.json)。

## 1.01 — 2026-10-09

标准版本 / Package version: `1.0.1` · Git tag: `v1.01`

- 重写默认中文与独立英文 README，直接说明部署前检查的用途和四类常见成本问题。
- 增加真实 SQL 读取量对比、历史 Alarm 报告摘录和检查流程图；完整保留 9 个案例与 32 条来源。
- 将详细安装、CLI 与受控发布说明移到双语使用指南，保留独立中文文案样本。
- 明确从本次起每次提交都递增版本号，文档和 CI 改动同样升版；同步 Skill、软件包、规则表和文档中的版本标识。

Rewrites the Chinese and English READMEs around the deployment review and common cost problems, adds examples backed by retained evidence, preserves all sources, and moves detailed operations into bilingual usage guides. Every commit now increments the display and package versions, including documentation and CI changes. Review behavior and the pinned official dependencies are unchanged.

验证记录 / Verification: [1.01 离线测试与包检查](docs/test-results/v1.01/summary.json)。历史记录与已发布的 `v1.00` 标签保持原样。

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
