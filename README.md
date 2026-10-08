# Cloudflare Cost Safety

**简体中文** | [English](README.en.md)

**当前版本：1.00** · npm／报告版本：`1.0.0` · Git 标签：`v1.00` · [更新日志](CHANGELOG.md) · [版本管理](docs/versioning.md)

一个在 **Cloudflare 部署前检查成本风险**的 Codex Skill，名称为 `cloudflare-cost-safety`。它结合官方最佳实践、源码／配置分析、受控本地测试与独立发布门禁，帮助发现 Alarm 自我调度、Queue 新消息反馈、SQL 扫描与写入放大、预览环境倍增、轮询和同步频率失控等问题。

它要回答四个问题：**费用从哪里产生、用量如何放大、上限在哪里执行、还有哪些证据缺失。** 检查结果会给出实际代码位置、执行路径、测试记录和需要补齐的控制措施。

**预检不发布、不连接账户、不停服，也不承诺月度金额硬上限。** 规则未完成、依赖缺失、目标不明或必需测试未执行都会拒绝放行。安装 Skill 不会自动拦截任意 CLI、控制台或 Workers Builds。

## 为什么会有这个 Skill

代码正常运行、消息成功 ack、SQL 返回一行，都不能单独说明费用有界。项目根据公开账单自述、事故复盘和社区实践，把以下问题整理成部署前可检查的规则：

- **没有用户，后台仍在工作：** DO 激活和 Alarm 重新调度可以持续触发存储操作，内存预算在重启后还可能重置。
- **单条消息结束，逻辑任务继续：** Queue 消费者调用会重新入队的 API，每次创建新消息，单消息重试设置未必限制整条业务链。
- **一次查询影响大量数据：** 缺少索引、丢失 WHERE、重复 upsert 或批处理进度不推进，会扩大实际读取／写入行数。
- **小任务乘上频率与环境数量：** preview 后台任务、R2 备份和客户端轮询，可能把看似轻量的操作持续放大。
- **控制措施的作用域被误解：** 预算邮件、CPU 限制、Queue 暂停和本地测试 reset，不能直接证明账户费用已封顶。

### 案例与全部消息／社区来源

以下 9 个案例、15 条消息／社区来源来自项目原始需求。表中区分作者自述、原帖片段和二手归档；本项目未独立审计其账单或完整生产代码，案例用于选择风险机制，技术判断另以官方资料与测试支撑。金额和因果限制见 [原始需求第 5 节](docs/requirements.zh-CN.md)。

| 案例 | 资料中描述的问题与本项目关注点 | 消息来源与资料类型 |
| --- | --- | --- |
| C01 · shmily7 | DO Alarm 循环与持续读写；检查自我调度和累计工作量 | [X 原帖](https://x.com/shmily7/status/2107481028726251762)、[Billflare 二手归档](https://billflare.dev/cases/shmily7-durable-object-alarm)；完整叙述主要来自二手资料 |
| C02 · Will Moss | 唤醒／初始化反复安排 Alarm，多个 preview 放大后台工作 | [Hacker News 自述](https://news.ycombinator.com/item?id=47787042)、[Reddit 自述](https://www.reddit.com/r/CloudFlare/comments/1snckwa/cautionary_tale_for_anyone_using_cloudflare/)；同一事件的两个来源 |
| C03 · RetainDB | Queue → API → Queue 新消息反馈，重复写入、KV 回退扫描及外部流量共同放大 | [Reddit 自述与后续更正](https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/)；不能把全部费用归结为单一循环 |
| C04 · Nathan Schram | Cron／批处理反复处理同批数据；检查持久进度和故障重放 | [作者复盘](https://littlebearapps.com/blog/d1-billing-disaster-circuit-breakers/) |
| C05 · OSM | 重构移除 WHERE，让按 ID 更新变成全表 UPDATE | [作者复盘与代码片段](https://www.ofsecman.io/post/postmortem-5-000-incident-in-10-seconds-due-to-cloudflare-d1) |
| C06 · Daryl Ginn | D1 高读取量；归档把放大原因指向迁移遗漏索引 | [X 原帖](https://x.com/darylginn/status/2082413530243043780)、[Billflare 二手归档](https://billflare.dev/cases/darylginn-d1-missing-index)；原帖片段与二手原因说明 |
| C07 · Justin Schroeder | 少量 DO 内部循环；不能以实例少推断费用低 | [X 原帖](https://x.com/jpschroeder/status/2086144942657712500)、[Billflare 二手归档](https://billflare.dev/cases/standard-agents-durable-objects)；缺少完整代码，不指定为某种 Alarm 实现 |
| C08 · Lucian Ghinda | Litestream／R2 复制操作密集；检查同步周期与环境乘数 | [X 原帖](https://x.com/lucianghinda/status/1957738066816446683)、[Billflare 二手归档](https://billflare.dev/cases/lucianghinda-r2-replication)；原帖片段与二手机制说明 |
| C09 · KurosawaGeeker | 投票站与社区成本审查经验；关注轮询、缓存和 Worker 请求路径 | [cloudflare-cost-playbook](https://github.com/KurosawaGeeker/cloudflare-cost-playbook)、[社区 cloudflare-cost-review Skill](https://raw.githubusercontent.com/KurosawaGeeker/cloudflare-cost-playbook/refs/heads/docs/cloudflare-cost-playbook/SKILL.md)；社区仓库自述与参考实现 |

这些来源各自保留出处；多个平台转载同一事故不重复计数。机器可读记录见 [案例索引](.agents/skills/cloudflare-cost-safety/assets/incidents.json)和[来源索引](.agents/skills/cloudflare-cost-safety/assets/sources.json)。

## 什么时候触发检查

支持 **部署前触发**和 **`/` 命令手动触发**两种入口，也可使用显式 Skill 提及提前检查。

### 1. 部署前触发

当任务即将向 Cloudflare 执行 deploy、publish、preview、staging、版本晋升或 rollback 时，Skill 的描述会引导 Codex 进入预检，包括 npm／框架／Node 脚本包装的发布入口。例如：

```text
把这个项目部署到 Cloudflare production，先完成成本安全检查。
```

普通修改 Alarm／Queue／SQL、解释命令或已确认的纯本地 build／test 不属于默认触发范围；只改文案但要求发布仍需检查。宿主是否隐式选中 Skill 取决于实际版本与匹配结果，因此受控发布入口始终显式运行 gate；本项目尚未验证完整的宿主隐式触发矩阵。

### 2. `/` 命令或显式提及

在支持的 Codex CLI／IDE 客户端中，输入 `/skills`，选择 **cloudflare-cost-safety**，再给出项目和检查目标。也可直接输入：

```text
$cloudflare-cost-safety 检查当前项目的 Cloudflare 成本风险，生成报告，先不要部署。
```

这里的 `/` 入口使用宿主的 `/skills` 选择器；具体菜单以客户端版本为准。调用方式见 [OpenAI 官方 Skills 文档](https://developers.openai.com/codex/skills/)。安装后应确认 Skill 已被宿主发现；未显示时重新启动客户端。

## 本地准备与验证

需要 Node ≥22、Python ≥3.10、Linux、bubblewrap 和 libseccomp2。依赖下载只发生在独立准备阶段，禁止 npm lifecycle 脚本：

离线沙箱使用 `/usr/bin/node`。若 Node 来自 nvm 或工具缓存，应先把核验过的二进制安装到受保护的系统路径，并使用同一 Node 运行测试；GitHub CI 的准备步骤包含此设置。

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm test
```

统一命令依次执行规则／集成／门禁／沙箱检查、真实 workerd 测试、干净安装与打包检查。实际日志写入 `.cost-safety/test-results/`；任何阶段失败都会非零退出。workerd 在断网 namespace、只读工作目录和父进程 watchdog 下运行。命名空间不可用时明确失败，不降级为联网测试。

## 安装 Skill

```sh
npm run install-skill -- --project /ABSOLUTE/APPLICATION
# 或放入由维护者保护的工具目录，供审查器使用：
npm run install-skill -- --skills-dir /ABSOLUTE/TRUSTED/skills
```

安装器不联网、不覆盖现有 Skill，复制已准备的 11 个生产依赖及许可证，包含 Python 沙箱。`npm run check:package` 会生成 `.cost-safety/cloudflare-cost-safety-1.0.0.tar.gz`，实际解包并在只能看到干净应用的离线环境中运行 CLI。也可解包到应用的 `.agents/skills/`。宿主需重新发现技能；本项目未验证当前 Codex build 的自动重载或隐式匹配。

安装后的版本信息保存在 Skill 内的 [version.json](.agents/skills/cloudflare-cost-safety/version.json)。运行 `node /TRUSTED/skill/scripts/cli.mjs version` 可查看展示版本、标准版本和 Git 标签；`--version` 仅输出标准版本号。

项目级 Skill 用于发现与审查。真正的发布验证器、信任文件和签名私钥必须放在候选仓库之外，使用受保护的安装版本。不要让候选代码修改验证器后再获得签名或发布凭证。

## 命令行预检与报告

在命令行／CI 中可以显式运行只读分析器。以下大写路径和版本均需替换为实际值；使用外部受保护的工具安装：

```sh
node /TRUSTED/skill/scripts/cli.mjs preflight \
  --root /APPLICATION --config wrangler.jsonc --env production \
  --artifact dist --builder ACTUAL_BUILDER_VERSION --action deploy \
  --local-tests --output /APPLICATION/.cost-safety
```

`main` 必须指向被审查的最终产物；提前完成构建，预检不会替你执行构建脚本。`--env default` 明确选择顶层配置；`production` 在存在 `env.production` 时选择该命名环境，否则选择顶层。JSONC/TOML 配置路径相对于仓库，配置内 `main` 相对于配置文件解析。

CLI 只读实际安装的 Wrangler package 元数据及候选 lockfile；二者版本必须一致。若发布器的 CLI 安装在外部，审查和门禁都传入 `--wrangler-package /TRUSTED/node_modules/wrangler/package.json`。读取版本文件不等同于运行候选 CLI；发布示例还会核对受保护发布器的实际版本和元数据摘要。

第一遍通常返回 **INCOMPLETE / exit 2**。读取 `report.json`、`report.md`、`official-context.json`；完成真实语义审查和所需应用测试后，用 `--review /EXTERNAL/semantic-review.json` 再运行。不能把静态无发现、SQLite probe 成功或官方文件读取回执当成已完成审查。

语义记录遵循 [schema](.agents/skills/cloudflare-cost-safety/assets/semantic-review.schema.json)：包含全部 12 条规则、实际文件／行号、官方读取文件摘要、模型／调用方式、真实测试命令与 runner 摘要。未运行的测试用 `not_run` 和 null；不要伪造通过记录。可信审查人需要对语义质量负责，签名本身不能证明程序终止。

| 退出码 | 含义 |
| --- | --- |
| 0 | PASS，或 REVIEW 已有有效的逐项签名审批 |
| 1 | 已知 BLOCK，优先于其他缺数据 |
| 2 | INCOMPLETE 或未批准 REVIEW |
| 3 | 工具调用／执行错误 |

## 官方依赖与规则

实际 vendored `cloudflare/skills` 的 `workers-best-practices`、`wrangler`、`durable-objects`，固定 commit `41e0d19858946d18af9ee2c2feebbe2e11d829ff`，保留 Apache-2.0 许可。每次读取入口和适用 references，按 [lock](.agents/skills/cloudflare-cost-safety/official-skills.lock.json) 核对文件摘要；从不静默更新 main。报告分别记录 loaded/reviewed 以及官方／成本两层结论。

12 条 P0 的正式契约、案例映射与来源在 [规则表](rules/catalog.json)。实现采用 TypeScript AST、本地调用闭包、真实 JSONC/TOML 与 SQL parser；支持范围及逐条测试证据见 [覆盖说明](docs/coverage.md)。ORM、动态派发、外部 SDK、未知云端状态及 P1 产品有明确缺口，不能由没有静态候选推出安全。

## 独立门禁与受控入口

可信外部审查人用 `attest --review ... --private-key /EXTERNAL/key.pem --key-id ... --origin ... --run-id ...` 生成 Ed25519 envelope。`gate` 只接受外部信任文件允许的公钥／来源，重新核对当前源码、产物、配置、目标、锁、策略、规则、工具和必需测试。普通 PASS JSON 不够。REVIEW 需要逐项、有期限、有补偿措施的签名审批；BLOCK 和 INCOMPLETE 不可豁免。

[签名与信任示例](docs/trust.md) 给出具体数据结构和本地流程。[本地受控入口](scripts/release.mjs) 默认只做门禁与只读交接，只有显式传入外部发布器和 `--execute` 才调用发布器。分析阶段拒绝继承 Cloudflare 凭证；本次开发没有调用远程发布阶段。

[Wrangler 发布示例](examples/publisher-wrangler.mjs) 只支持预构建 JavaScript deploy，拒绝 build.command，以密封 memfd 和只读 namespace 消费同一批核验字节；禁用 bundle／重建。本地已验证其断网 dry-run。管理员、受保护发布器及拥有同宿主调试权限的人属于信任边界，文件 chmod 本身不是不可变性保证。

[GitHub Actions 示例与设置说明](docs/ci.md) 把门禁和凭证发布放在独立步骤，并从受保护工具安装运行。工程 CI 配置为在 push／pull request 时验证，线上结果以仓库 Actions 为准；真实 Cloudflare 发布流程尚未执行。直接 CLI、控制台、未接入的 Workers Builds 和其他 CI 仍为 **partial coverage**。

实际完成情况、测试数量、独立前向评估及未执行项见 [开发交付报告](docs/development-report.zh-CN.md)。原始要求保存在 [requirements.zh-CN.md](docs/requirements.zh-CN.md)。

## 官方参考资料与致谢

上述案例表列出全部 15 条消息／社区来源。以下再列出来源索引中的全部 17 条官方参考，共 32 条；官方能力、计量单位和命令语义使用相应官方资料核对，社区材料用于问题背景与实践参考。

| 主题 | 官方来源 |
| --- | --- |
| DO Alarm 与存储计量 | [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)、[SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) |
| D1 行计量 | [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Queues 重试与暂停范围 | [Batching and retries](https://developers.cloudflare.com/queues/configuration/batching-retries/)、[Pause and purge](https://developers.cloudflare.com/queues/configuration/pause-purge/) |
| 本地运行时测试 | [Workers Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/) |
| Workers 限制与计费 | [Platform limits](https://developers.cloudflare.com/workers/platform/limits/)、[Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| KV 计费 | [Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| R2 请求类别与计费 | [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) |
| 预算告警 | [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/) |
| 官方 Agent Skills | [cloudflare/skills](https://github.com/cloudflare/skills)、[workers-best-practices 入口](https://raw.githubusercontent.com/cloudflare/skills/main/skills/workers-best-practices/SKILL.md)、[durable-objects 入口](https://raw.githubusercontent.com/cloudflare/skills/main/skills/durable-objects/SKILL.md)、[wrangler 入口](https://raw.githubusercontent.com/cloudflare/skills/main/skills/wrangler/SKILL.md) |
| Workers Builds 发布配置 | [Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) |
| Codex Skill 发现与调用 | [OpenAI Skills](https://developers.openai.com/codex/skills/) |

上表的上游 main 链接用于定位资料；实际运行使用前文列出的固定 commit 和内容摘要。感谢 Cloudflare 官方 Skill 与文档作者、公开分享事故的开发者，以及 KurosawaGeeker 社区项目。来源状态和核验日期保存在 [sources.json](.agents/skills/cloudflare-cost-safety/assets/sources.json)。

## 许可

本项目代码采用 [MIT License](LICENSE)。随包分发的 Cloudflare 官方 Skill 保留其 [Apache-2.0 许可](.agents/skills/cloudflare-cost-safety/vendor/CLOUDFLARE-LICENSE)及[出处说明](.agents/skills/cloudflare-cost-safety/vendor/NOTICE)；准备好的第三方依赖保留各自许可证。
