# 实现与验证覆盖

本版本把静态候选、Agent 语义审查、真实本地运行和线上状态分开记录。12 条规则均有独立 unsafe/safe/unknown 应用目录，共 36 个基础测试；这些小样例的通过率不是现实代码检出率。未解析路径、未完成审查或缺少应用必需测试时不能 PASS。

## 从代码推导通用检查

每次审查先执行[通用工作量边界方法](../.agents/skills/cloudflare-cost-safety/references/execution-bounds.md)，不要求事故报告。脚本从可达入口、初始化、生命周期、本地调用闭包、资源操作、循环和递归生成 `coverage.execution_bounds`。每条路径要求应用级 `execution-bounds` 记录：限制的作用范围、事件／工作量上限、源码执行依据和适用的正常、无进展、放大、耗尽、重启、重放、停止、时间边界或部分失败观测。具体时间点与状态从应用代码推导，现有第 23／30 天 fixture 只是一个模型。

独立门禁重算当前路径集合并核对记录，缺路径、缺场景、单次限制冒充跨事件限制、无效源码位置、缺单位或观测超上限均不能放行。新增集成测试覆盖跨文件辅助函数、改名、Alarm／Cron／Queue／timer、递归、死代码、有限任务／合法周期窗口及签名报告篡改；测试中的成功记录仍明确为 `MOCK_NO_MODEL_CALL`，不当成应用真实用量。

这层提供的是审查义务和证据一致性检查。静态图不完整时，Agent 仍需追踪动态调度、SDK、既有对象和外部激活；脚本不证明任意程序终止，不验证任意测试器的真实性，也不自动执行被审查项目的测试脚本。12 条 P0 规则继续检查产品语义，公开事故用于检验方法是否漏查。

## 逐条规则

所有规则都要求 Agent 实际审查当前源码、适用官方内容和证据；静态分析不能替代这一层。下表“本地测试”指本项目实际执行的机制测试，不是自动替被审查应用完成了测试。审查应用仍需提交绑定其输入摘要的真实记录。

| 规则 | 已实现静态范围 | 实际本地测试 | 仍需 Agent／应用证据或未覆盖范围 |
| --- | --- | --- | --- |
| CF-DO-001 | 本地 stub RPC/fetch 激活 → 对应类 constructor → Alarm → SQL／存储 → 重调度；SQL 要求 DO 自有建表依据 | workerd 激活、运行 Alarm、驱逐后再激活、空任务；虚拟第 23／30 天刷新与过期、重复时间戳、时钟回退 | 旧对象／旧 Alarm、外部激活、SDK hook、条件初始化及云端历史 |
| CF-DO-002 | 内存 attempts／预算重置与重调度；区分持久化读取守卫 | workerd 驱逐后内存重置、持久状态保留、有限任务、合法周期窗口 | 任意业务进度、事务和故障边界；变量名或一次 storage 调用不能独立证明预算 |
| CF-DEP-001 | newUniqueId 与可达后台 Alarm；真实环境配置和 binding 关系 | 共享／独立／未知配置样例、配置漂移门禁；不按 URL 数虚构 Namespace | 实际环境／对象数量、资源到期、已有后台任务和生成器效果 |
| CF-SQL-001 | 已执行 D1 prepare 链／DO exec；已知 schema 下的热路径非索引筛选排序；LIMIT 不作扫描上限 | SQLite EXPLAIN；workerd DO 100／1,000／10,000 行、有效／无效索引；D1 本地 meta | 复杂 JOIN、分布与选择性、ORM、动态 SQL、复杂 schema 迁移和实际线上行数 |
| CF-SQL-002 | 已知表的全表 UPDATE／DELETE；有限维护任务保留业务审查 | DO 大范围写、低选择性 WHERE、重复 upsert 的实际 rowsWritten | 一般 WHERE 上限、索引／触发器写放大、事务、外部调用；不把所有维护任务判错 |
| CF-JOB-001 | scheduled／alarm 首批 SELECT LIMIT 加写入且无可见进度提交 | 有上限的 Cron checkpoint 崩溃模型：30 行、35 次写；有限 DO 跨驱逐完成 | 一般业务待办是否减少、外部 checkpoint／事务；Cron 测试不是云端调度测试 |
| CF-Q-001 | 同仓库跨文件 consumer → producer → 新消息；root/hops 传递守卫候选 | 真实 Queue 测试辅助 API 下 20 步新 ID／成功 ack 回环；保留 root/hops 后 4 步停止 | 外部 API／服务生产者、生产 Queue 调度、持久化全任务预算和真实 DLQ 回放 |
| CF-Q-002 | 可计费副作用加显式 retryAll，缺少逐项 ack | Queue 辅助 API 的部分成功、写后 ack 前重放与有限 DLQ 模型 | 外部副作用幂等契约、exactly-once、实际投递与长期回灌行为 |
| CF-KV-001 | AST 无界分页循环中 list／cursor 不推进；区分有限循环 | 本地 KV miss、list、cursor 分页；cursor 变异 | 热点命中率、key 分布、跨区域状态和全局准入；缓存不是强一致限流 |
| CF-R2-001 | 可达快速 timer／Alarm 无条件 put/list；变更守卫候选 | 本地 R2 put/list；每分钟／每秒及环境倍数的有限算术模型 | S3／公开访问、真实同步器默认值、重试和变更检测、R2 事件回写 |
| CF-HTTP-001 | 配置 assets 的 HTML 引用字面量脚本，快速同源相对地址轮询，加高成本 Worker handler；公共 handler 的外部／动态 fetch 选择源站访问验收 | 独立 assets fixture、入口／缓存范围检查；跨文件源站验收缺失拒绝、局部 fetch／service binding 误报回归 | 动态路由／模板、真实 WAF／缓存／限流／套餐、公开流量和多租户预算；无在线源站或 WAF 测试 |
| CF-SAFE-001 | 结构化伪控制声明及可达测试 reset API；预算声明缺执行证据保留 unknown | 预算邮件、测试 reset、对象内 deleteAlarm、CPU、Queue pause 五种范围反证；伪硬上限拒绝 | 企业合同、线上控制状态与传播；本工具不执行任何生产隔离 |

完整契约、来源和案例映射见 [规则注册表](../rules/catalog.json)。独立 Agent 实际审查了 DO、Queue 和 SQL 应用；最后的 DO 复查覆盖全部 12 条规则，并把不适用和未知逐项列出。其余确定性测试中的语义审查记录明确标记 `MOCK_NO_MODEL_CALL`，用于测试编排和门禁，不能算实际 Agent 覆盖。

## 延迟、源站与停止验证

本次沿用现有 12 条 P0 规则，补充条件必需测试：可达 `setAlarm` 要求 `do-time-boundaries`；可达 Alarm、Cron handler 或配置的 Queue consumer 要求 `background-stop`；公共 Worker handler 经本地调用闭包到达外部／动态 `fetch` 时要求 `origin-access`。缺少通过且绑定当前输入的实际记录会保持 INCOMPLETE；签名报告也不能删掉这些要求来绕过独立门禁。

本地新增 5 个 workerd 测试覆盖 30 天 TTL／提前 7 天刷新、重复已到期时间戳、错过刷新后的过期、非法／回退时钟，以及停用后排队回调与驱逐重放。这里的时间是显式注入的模型时钟，`work` 统计逻辑刷新，停止后的两个回调仍有两次控制状态读取；不是生产计费指标或云端自动调度验证，也未证明取消已在执行的远程副作用。

源站访问目前落实为静态路径识别、语义审查要求和缺失证据拒绝测试，不自动验证线上鉴权或限流。公开端点可以合法存在，需证明收费工作有界；Worker 内的校验也不消除 Worker 调用本身。外部 SDK、完整跨云账单和未知 origin 契约仍属覆盖缺口。详细验收与设计出处见 [补充检查说明](../.agents/skills/cloudflare-cost-safety/references/delayed-and-origin-checks.md)。

## 解析与执行图的边界

TypeScript compiler API 解析 JS/TS；入口来自实际 Worker 默认导出及可证明激活的本地 DO 类。收集本地 import、函数调用、callback、模块初始化、Alarm 与资源操作。图节点／边保留实际文件和行号；未知目标不能凭字符串推成已知调用。未使用 DO stub 不自动算对象激活，名为 fetch 的死函数不自动算 Worker 入口，D1 migration 不自动算 DO schema。

配置使用 JSONC／TOML parser；环境 binding 按非继承语义解析，入口相对配置文件。支持已安装 Wrangler 元数据与 npm lock 的版本核验；其他锁格式仅清单记录。动态配置、cf CLI 新路由、未解析版本／绑定保留 INCOMPLETE，不执行它们探测效果。一般框架代码生成、完整类型／别名推导、任意跨语言和外部 SDK 调用尚未实现；Agent 必须检查这些缺口。

SQL 使用 `node-sql-parser` 的 SQLite 语法及 Python SQLite EXPLAIN。schema 提取支持简单 CREATE TABLE／INDEX；不声称完整模拟 ALTER／DROP／trigger／条件 migration。无法解析的 SQL 和 ORM 路径保留未知。EXPLAIN 不执行业务 SELECT／UPDATE；其计划不是实际计费行数。真实 DO 指标来自已消费 cursor；D1 本地 meta 不冒充生产账单。

## 触发、官方依赖与门禁

DEP-01…10／OFF-01…10 共 20 个自动化场景实际执行意图分类、静态脚本展开、官方文件读取、门禁及模拟发布器断言。npm/pnpm/yarn 生命周期和字面量 Node 包装器只读展开；动态命令需要确认目标。这些测试不等同于 Codex 宿主的隐式 Skill 选择。

1.0.4 增加同步 `PreToolUse` Hook，项目安装自动注册定义，现有无关 Hook 保留；定义必须由宿主审阅信任后运行。17 项新增集成测试覆盖命令／包装／生命周期识别、工作目录、Cloudflare MCP／HTTP 发布、只读负例、异常与不可信输入，以及登记入口到实际 gate 和模拟发布器的交接。干净打包检查实际在断网只读 namespace 中运行解包后的 Python／Node Hook，分别核验 deny 和 allow；未声称完成 Codex 宿主实际加载或隐式前向评估。

Hook 拒绝直接发布并提示真实执行 Skill；有效签名也不让直接命令绕过 gate。登记的外部入口固定本版本发布代码 SHA-256，只允许精确的字面量调用，由入口核验当前签名／源码／产物／目标后执行已经授权的受信发布器。详情见 [Hook 说明](../.agents/skills/cloudflare-cost-safety/references/deployment-hook.md)。外部终端、交互式 `write_stdin` 输入、任意解释器／SDK／插件和未接入云端入口仍是覆盖缺口。启动后的分析异常有显式 deny；未加载、未信任、禁用或 launcher 启动前失败不能由脚本强制拦截。

首版完成两个独立显式前向评估批次：第一批三个应用，修正后针对两个 DO 应用复查；不是每个场景重复三次。1.1.0 另有[通用方法独立评估](test-results/v1.1.0/forward/README.md)：没有提供事故材料，完成六次受限模型探测，将无进展反馈路径判为 BLOCK；有限进度任务因证据未齐保持 INCOMPLETE。静态图未追到事务回调的 storage 别名读写，Agent 人工审查补充了路径及计数，不能据零未知边断言完整覆盖。当前会话没有可查询的精确宿主 build／模型后端 ID，也没有安装后重载和隔离宿主隐式选择测试接口，因此隐式触发为 **未验证**。受控发布入口总是显式调用独立 gate，不依赖隐式选择。

固定官方 `cloudflare/skills` commit 为 `41e0d19858946d18af9ee2c2feebbe2e11d829ff`。普通 Worker 实际读取 workers-best-practices 入口及三份 reference、wrangler 入口；DO 场景再读 durable-objects 入口及三份 reference，共九份。loaded 与 reviewed 分开；来源、版本、缺文件或内容漂移均有拒绝测试。

gate 验 Ed25519 来源／角色／run，重新计算源码和 dirty tree、最终产物、有效配置、目标／环境、锁、工具、策略、官方版本、规则和必需测试。有效期采用 trust 与 policy 的较短值。REVIEW 只能逐 finding、逐输入摘要、限期批准，结果仍为 REVIEW。BLOCK／INCOMPLETE 不可普通豁免。已验证伪 PASS、未调用 Agent、缺规则、缺测试、证据过期及各种漂移会拒绝发布。

本地发布入口已用模拟发布器验证失败调用数为零、同一产物交接、等待异步完成、发布失败及目录修改检测。实际 Wrangler 发布适配器另以 **断网 dry-run** 验证，消费封印 memfd 的只读文件，禁止重建。没有进行远程 deploy。工程 CI 配置为推送时验证，线上结果以仓库 Actions 为准；生产发布示例尚未在线执行，也未配置 required checks／environment protection。直接 CLI、控制台、Workers Builds、其他 CI 均保持 partial coverage。

## 测试资源限制

| 层级 | 实际执行约束 |
| --- | --- |
| 源码快照 | 最多 2,000 文件、24 MiB 总量、单文件 1 MiB；排除凭证、拒绝 symlink／越界；超限留下缺口 |
| JSON 协议输入 | 普通文件、最多 16 MiB；拒绝 FIFO，不跟随数据增长无界读取 |
| CLI preflight | 独立分析进程、清洁环境、Node heap 384 MiB、父进程 30 秒 kill process group |
| SQLite probe | 干净环境、网络 syscall 拒绝、只允许受限建表／索引与 EXPLAIN；最多 50 查询／25 schema 组、输入 250 KiB、schema 100 KiB、2M VM steps、CPU 5 秒、内存不超过 256 MiB、父进程限时 |
| 通用本地 sandbox | bubblewrap 断网 namespace、只读 checkout、屏蔽凭证文件、清洁环境；默认 512 MiB、显式超时、输出上限及整个进程组清理 |
| workerd 测试 | 同样断网及只读，父 watchdog 50 秒、RSS 上限 1,024 MiB；最多 10,000 fixture 行，反馈模型 20 步，操作前扣预算；运行时外连另返回 403 |

操作数限制约束本项目测试模型，不是给任意应用自动安装的云端配额。同步死循环、微任务死循环、超内存／输出和孤儿进程清理均做了实际子进程测试。命名空间不可用直接失败，不退化到联网执行。

## 明确未支持

AI 递归／外部费用、DO WebSocket／活跃时长、Workflows 重试／实例复制、R2 事件回写、日志／trace 放大仍属 P1，未实现对应全面分析。发现相关高风险绑定会留下覆盖缺口；没有产品绑定也不等于已证明源码不使用外部服务。所有货币估算为 null；未实现价格引擎、月度金额硬上限、线上监控、停服、删数据或账户控制。

真实账户配置、原生控制生效、历史 Alarm／Queue、数据规模、套餐和外部调用契约都未在线核验。当前工程提供可安装工具和本地证据，不把这些未完成项描述为端到端通过。
