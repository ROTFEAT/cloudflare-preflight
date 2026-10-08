# Cloudflare Cost Safety 开发交付报告

日期：2026-10-08。展示版本：**1.00**。实现／报告版本：**1.0.0**。Git 标签：`v1.00`。工作目录：`/home/ubuntu/github/cloudflare-preflight`。

已交付可安装 Skill、12 条 P0 规则的有限静态实现、必需语义审查协议、只读分析与本地测试、可信签名门禁、受控本地发布入口及 CI 示例。最终统一验证 **121 项测试通过，0 失败、0 跳过**，另有干净安装／打包检查通过。本报告记录提交前的本地验证，工程 CI 线上结果以仓库 Actions 为准；宿主隐式选择、生产发布接入与真实账户状态未验证，因此不宣布需求第 16.3 节的所有端到端条件均已完成。

## 已实现模块

| 模块 | 交付内容 |
| --- | --- |
| Skill | `.agents/skills/cloudflare-cost-safety/SKILL.md`、有效的 `agents/openai.yaml`、七份审查 reference、固定官方依赖 |
| 触发与配置 | 中英文发布意图；npm/pnpm/yarn 生命周期、字面量 Node 包装器只读展开；JSONC/TOML、环境非继承 binding、实际 Wrangler 元数据与锁版本检查 |
| 分析器 | TypeScript AST、本地调用／资源图、可证明的 DO 激活、SQL parser、分数据库 schema／EXPLAIN、12 条 P0 候选；动态／未知和 P1 缺口明确输出 |
| 语义与报告 | 全部 12 条规则、官方 loaded/reviewed、两层结论、真实位置／命令／指标；缺失保持 unknown/not_run，金额为 null |
| 数据协议 | policy、report、official lock、deployment identity、semantic review、trust、approval 共七种 schema；12 条规则、九个案例及来源索引 |
| 本地测试 | 36 个基础应用、20 个部署／官方场景、八个变异；沙箱／门禁／原生控制范围／发布／前向回归；17 项 workerd 测试 |
| 发布门禁 | 外部 Ed25519 信任来源，当前源码／工作树／最终产物／配置／目标／锁／工具／策略／官方内容及必需测试重新核验；限期逐项 REVIEW 审批 |
| 发布接入 | 本地先 gate 后交接，拒绝分析阶段继承 CF 凭证、等待异步发布结果；Wrangler 示例消费密封只读快照，禁止重新构建 |
| 安装与 CI | 离线安装器、附 11 个生产依赖及许可证的归档、真实解包检查；工程 workflow 和受保护发布 workflow 示例 |

默认入口只在即将 Cloudflare 远程发布时建议使用；普通编辑／解释／已确认的本地构建测试不自动触发，显式提前预检可用。安装或提示词不构成权限拦截器。

## 实际官方依赖

上游为 [cloudflare/skills 固定提交](https://github.com/cloudflare/skills/tree/41e0d19858946d18af9ee2c2feebbe2e11d829ff)，revision：`41e0d19858946d18af9ee2c2feebbe2e11d829ff`。文件按原样 vendored，保留 Apache-2.0 许可与出处；[official-skills.lock.json](../.agents/skills/cloudflare-cost-safety/official-skills.lock.json) 保存实际 SHA-256。

实际读取 workers-best-practices 的入口及 configuration／platform-apis／runtime-patterns 三份 reference、wrangler 入口；DO 场景再读 durable-objects 的入口及 rules／testing／workers 三份 reference，总计九份。独立 Agent 也读取并应用这些文件，逐规则语义记录保存在前向评估证据中。自动化测试中仅读取回执或语义替身不被计作真实 Agent 审查。

当前上游将 cf CLI／`cloudflare.config.ts` 路由至另一套能力，本版未实现适配，返回 INCOMPLETE。官方依赖不会自动跟随 main；升级需维护者审批新内容、重建 pin 并重审，旧证据失效。

## 每条规则的覆盖

全部规则都有 unsafe／safe／unknown 三个独立应用和明确断言。Agent／静态／实际测试／未覆盖范围的逐条表见 [覆盖说明](coverage.md)，机器字段见 [规则注册表](../rules/catalog.json)。

| 规则 | 静态／本地验证重点 |
| --- | --- |
| CF-DO-001 | 已激活对象的 constructor → Alarm → SQL → 重调度；真实生命周期及空任务 |
| CF-DO-002 | 内存预算在驱逐后重置；持久进度、有限任务及合法周期窗口 |
| CF-DEP-001 | preview／binding／对象创建关系；共享、独立和未知资源模型 |
| CF-SQL-001 | 非索引筛选／排序与扫描；实际多规模 rowsRead 和查询计划 |
| CF-SQL-002 | 大范围写；低选择性 WHERE、重复 upsert 的 rowsWritten |
| CF-JOB-001 | 首批重做与进度缺失；有界 checkpoint 崩溃模型 |
| CF-Q-001 | 跨文件新消息反馈；成功 ack／新 ID 与保留 root/hops 的有界模型 |
| CF-Q-002 | retryAll／副作用重放；逐项 ack、部分成功与 DLQ 模型 |
| CF-KV-001 | list／cursor 无进展；真实本地 miss 与分页 |
| CF-R2-001 | 高频 put/list；本地操作和频率／环境倍数 |
| CF-HTTP-001 | 配置 assets 中的同源轮询 → 高成本 Worker；公开入口和缓存范围 |
| CF-SAFE-001 | 假硬预算／假全停／测试 API 误用；五类原生控制范围反证 |

## 最终实际执行

运行环境为 Linux 6.8.0-124-generic、Node v24.11.1、Python 3.10.12。依赖准备使用 `npm ci --ignore-scripts --registry=https://registry.npmjs.org`，与离线测试阶段分离；候选 package 脚本及动态配置均不执行。

| 命令／阶段 | 最后结果 | 运行证据 |
| --- | --- | --- |
| `npm test` → Node test runner | 104 通过，0 失败／跳过／取消 | [unit-integration.log](test-results/unit-integration.log)，约 38.8 秒 |
| `npm test` → sandbox → Vitest/workerd | 17 通过，0 失败／跳过 | [workerd.log](test-results/workerd.log)，含外层隔离记录，约 4.8 秒 |
| `npm test` → `scripts/check-package.mjs` | 通过，11 个准备好的生产依赖、真实解包与离线 CLI／版本查询 | [package.log](test-results/package.log)，约 9.8 秒 |
| Skill Creator `quick_validate.py` | `Skill is valid!` | [交付检查记录](test-results/delivery-checks.json) |

统一命令的最终结束时间为 `2026-10-08T12:57:36.055Z`，各实际命令／退出码／耗时在 [summary.json](test-results/summary.json)。[unified.log](test-results/unified.log) 保存统一入口输出。以上零跳过仅指本项目测试集合；前向审查应用的必需运行时测试没有执行，不混入这个计数。

104 项包括：36 基础、20 DEP/OFF、八个变异、五个原生范围、十个前向回归、15 个安全／门禁、四个本地发布、四个沙箱、两个密封发布器测试。测试中的临时密钥、目标 ID 和 `MOCK_NO_MODEL_CALL` 都是合成数据，不是生产审查结果。

workerd 实际观察无索引读取 101／1,001／10,001 行，适用索引读取 1 行；返回一行不替代扫描指标。真实 DO Alarm／驱逐和 getAlarm 行为已测。本地 D1 meta 实际返回 read 1／write 0。Queue 测试使用真实辅助 API 加有界投递模型，Cron 使用有界 checkpoint 模型，二者均未运行云端调度。所有真实远程写入为零。

固定测试版本：`@cloudflare/vitest-plugin 1.3.7`、Vitest 4.1.11、Wrangler 4.148.0、Miniflare 5.20261006.0-alpha、workerd 1.20261006.1。解析器为 TypeScript 5.9.3、node-sql-parser 5.4.0、jsonc-parser 3.3.1、@iarna/toml 2.2.5、Ajv 8.20.0；完整依赖由 `package-lock.json` 固定。

打包检查中未提供实际应用语义审查，CLI 正确返回 INCOMPLETE／exit 2。内层通用 sandbox 因非零退出记录 `status: failed`，外层检查核对这正是期望拒绝结果后通过；没有把应用判为 PASS。详见 [package-check.json](test-results/package-check.json)。

## 独立前向评估、发现与修正

由独立 `/root/skill_forward_review` 会话实际显式调用 Skill，先审查 DO／Queue／SQL 三个应用，再对冻结的修正版进行两个 DO 应用复查。每批均是一轮宿主调用，不把多次 CLI 调用算成三次独立评估。宿主仅暴露 Codex／GPT-6 family，精确 backend ID／build 未暴露，记录中保留未知。

复查结果：未证明激活的 DO 为 **INCOMPLETE**，不产生原先无依据的 BLOCK；具有 stub RPC 激活、自有建表及 Alarm SQL 重调度路径的 DO 为 **BLOCK**。两者官方层完成审查，成本层保留业务／历史／运行时缺口，publisher handoff 都是 DENY。没有替这些应用伪造生命周期、计费行数或线上测试。

完整原始报告、语义记录、输入源码和哈希清单在 [forward/manifest.json](test-results/forward/manifest.json)。关键记录为 [未激活复查](test-results/forward/corrected/dormant/corrected-forward-test.md)、[已激活复查](test-results/forward/corrected/activated/corrected-forward-test.md)、[发布流程独立审查](test-results/forward/release-review.md)。保留历史错误和所审版本，不覆盖为最终通过结果。

开发期间发现并修复的问题包括：Python 3.10 SQLite authorizer 解除兼容性、安装包漏带 sandbox、未激活 DO 及跨库 schema 的误报、链式图 ID 重复、JSON 序列化后的签名一致性、分析阶段继承发布凭证、异步发布未等待、chmod 不能保证相同消费字节，以及 schema 合法的 null/not_run 导致 Markdown 崩溃。它们都有实际回归；密封快照与 Wrangler 断网 dry-run 也实际执行。

最后补测了输出 symlink 拒绝、政策与 trust 有效期取短，以及超大／FIFO JSON 拒绝。独立 DO 复查冻结版本仍含 null 渲染问题；最终实现已修复并在统一测试中通过，未把最终改动冒称再次独立审查通过。三次重复评估建议尚未完成。

## 安装包

本次生成 `.cost-safety/cloudflare-cost-safety-1.0.0.tar.gz`，16,834,798 字节，SHA-256：

```text
cb096c91e0c1170d2c9a08ffe325bb214d27de7d8e1f28f8aa01ad42285b6d02
```

归档包含 Skill、固定官方文件、11 个生产依赖及许可证；不含仓库开发依赖、生产私钥或部署凭证。检查实际解包到干净应用，通过独立断网 CLI 验证，不借用原仓库 node_modules。源目录安装见 [README](../README.md)。此二进制归档是本地生成物，不加入 Git。

## 未完成项与发布旁路

1. **宿主隐式发现／选择未验证。** `allow_implicit_invocation` 只声明偏好；没有声称能控制 Codex 调度。需要在实际安装并重新发现 Skill 的宿主中运行显式／隐式正负矩阵，并记录具体版本与漏触发。
2. **云端配置未核验。** 没有账户凭证，未访问生产资源或更改套餐／原生控制；WAF、缓存、限流、对象数量、历史后台任务、传播延迟、数据规模和外部契约仍未知。
3. **生产发布 CI 未接入。** 工程 workflow 配置为推送时验证，线上运行结果另见 Actions；受保护发布示例已经提供，但尚未配置环境保护、required check、trust、签名来源或执行真实发布。
4. **旁路为 partial。** 直接 Wrangler/cf CLI、dashboard、Workers Builds、其他 CI 与已有后台任务不受安装 Skill 自动控制。必须逐个接入或由管理员禁用后才能提高覆盖保证；本版没有自动证明全覆盖的云端适配器。
5. **分析范围有限。** 一般框架／SDK、动态 SQL／ORM、完整 schema 演化、跨语言和任意业务进度未完备；AI、DO duration/WebSocket、Workflows、R2 事件、日志／trace 属 P1，未标为支持。没有价格引擎、月费硬限额、监控或隔离功能。
6. **发布适配有限。** 示例实际执行器仅支持预构建 JavaScript deploy；preview/promote/rollback 有审查意图与身份支持，执行需组织自己的受保护发布器。远程执行阶段本次未运行。

## 维护者接入步骤

在候选仓库外安装并保护工具／依赖／policy／trust／密钥；审批固定官方版本；保护审查签名来源。为实际应用完成所有 12 条规则、官方语义审查与要求的本地测试，签名绑定最终产物，发布时不得重新构建。

按 [CI 设置说明](ci.md) 配置可信 runner、环境审批、真实目标和最小权限 token，仅在独立获授权 publisher 阶段提供凭证；核查直接 CLI／控制台／Workers Builds 等旁路。按 [信任说明](trust.md) 生成真实 pin、公钥及逐项限期 REVIEW 审批。示例中的 target、key 和 ID 不能直接用作生产配置。

本次仓库版本以 `v1.00` 标签固定，标准版本为 `1.0.0`，版本流程见 [versioning.md](versioning.md)。历史独立审查记录保留原来的 `0.1.0` 标识；它们不是当前版本签名。本次未进行 Cloudflare 远程发布。
