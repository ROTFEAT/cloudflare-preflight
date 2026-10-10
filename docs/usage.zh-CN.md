# 使用指南

**简体中文** | [English](usage.en.md) · [返回项目首页](../README.md)

本页保留安装、命令行预检与受控发布的完整操作说明。当前版本为 **1.1.0**，Git 标签为 `v1.1.0`；README、Skill、软件包和报告使用同一个三段式版本号。首次了解项目可先阅读首页的检查示例。

## 本地准备与验证

需要 Node ≥22、Python ≥3.10、Linux、bubblewrap 和 libseccomp2。依赖下载只发生在独立准备阶段，禁止 npm lifecycle 脚本：

离线沙箱使用 `/usr/bin/node`。若 Node 来自 nvm 或工具缓存，应先把核验过的二进制安装到受保护的系统路径，并使用同一 Node 运行测试；GitHub CI 的准备步骤包含此设置。

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm test
```

统一命令依次执行规则／集成／门禁／沙箱检查、真实 workerd 测试、干净安装与打包检查。实际日志写入 `.cost-safety/test-results/`；任何阶段失败都会非零退出。workerd 在断网 namespace、只读工作目录和父进程 watchdog 下运行。命名空间不可用时明确失败，不降级为联网测试。

## 通用检查方法

每次从代码推导执行路径、计费操作、继续调度、进度／停止条件和工作量上限，不依赖事故调查文档。`coverage.execution_bounds` 列出必须交代的路径；适用应用需提供 `execution-bounds` 测试记录，指标格式为 Skill 的 `assets/execution-bounds.schema.json`。缺项或不一致保持 INCOMPLETE，发布门禁独立重算并拒绝。具体场景、实际观测与限制作用范围见[通用方法](../.agents/skills/cloudflare-cost-safety/references/execution-bounds.md)。工具升级后需更新外部 trust pins 和应用证据。

## 安装 Skill

```sh
npm run install-skill -- --project /ABSOLUTE/APPLICATION
# 或放入由维护者保护的工具目录，供审查器使用：
npm run install-skill -- --skills-dir /ABSOLUTE/TRUSTED/skills
```

安装器不联网、不覆盖现有 Skill，复制已准备的 11 个生产依赖及许可证，包含 Python 沙箱。`npm run check:package` 会生成 `.cost-safety/cloudflare-cost-safety-1.1.0.tar.gz`，实际解包并在只能看到干净应用的离线环境中运行 CLI。也可解包到应用的 `.agents/skills/`。宿主需重新发现技能；本项目未验证当前 Codex build 的自动重载或隐式匹配。

安装后的版本信息保存在 Skill 内的 [version.json](../.agents/skills/cloudflare-cost-safety/version.json)。运行 `node /TRUSTED/skill/scripts/cli.mjs version` 可查看版本和 Git 标签；`--version` 仅输出版本号。

项目级 Skill 用于发现与审查。真正的发布验证器、信任文件和签名私钥必须放在候选仓库之外，使用受保护的安装版本。不要让候选代码修改验证器后再获得签名或发布凭证。

## 部署前 Hook

`--project` 安装会同时在应用的 `.codex/hooks.json` 注册同步 `PreToolUse` Hook，并保留其他 Hook。在支持且启用了 Hooks 的 Codex CLI 中打开 `/hooks`，审阅并信任新定义；项目配置层也必须可信。仅安装不会自动信任或证明客户端已加载 Hook。`--skills-dir` 或手动解压不注册 Hook，已有安装可单独运行：

```sh
npm run install-hook -- --project /APPLICATION --skill /TRUSTED/skills/cloudflare-cost-safety
```

Hook 识别 Wrangler／cf 发布、远程预览、版本与 secret 写入，以及实际执行这些操作的 npm 前后置脚本、字面量 Node／shell 包装、框架、HTTP 和 MCP 调用。命中后先拒绝工具调用，提示 Agent 真实执行 `$cloudflare-cost-safety`。无法展开的相关脚本保持 INCOMPLETE；不会执行候选脚本或动态配置来试探效果。

普通 PASS 文件不会解锁直接发布。要在受保护入口完成检查后继续，给新安装传入 `--release-entry /PROTECTED/cloudflare-preflight/scripts/release.mjs`，或给 `install-hook` 传入同一选项及 `--replace` 更新现有本项目 handler，再重新信任。入口必须在应用外且匹配本版本源码；Hook 固定其 SHA-256，只允许规定格式的调用，实际证据仍由独立 gate 核验。完整步骤与命令表见 [Hook 说明](../.agents/skills/cloudflare-cost-safety/references/deployment-hook.md)。

Hook 仅覆盖已加载的、可信的 Codex 工具调用；外部终端、控制台、未接入 CI／Workers Builds、交互式 shell 输入和任意动态代码仍有缺口。本版本已验证离线协议与打包后的实际执行，未验证每种客户端的加载／自动选择，也没有进行远程发布。

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

语义记录遵循 [schema](../.agents/skills/cloudflare-cost-safety/assets/semantic-review.schema.json)：包含全部 12 条规则、实际文件／行号、官方读取文件摘要、模型／调用方式、真实测试命令与 runner 摘要。未运行的测试用 `not_run` 和 null；不要伪造通过记录。可信审查人需要对语义质量负责，签名本身不能证明程序终止。

报告顶部摘要分别呈现风险、工作量上限、代码限制、本地测试及未核验的云端控制。适用的 Alarm 路径需要 `do-time-boundaries`，后台 Alarm／Cron／Queue 需要 `background-stop`，公共 Worker 到外部／动态 fetch 的路径需要 `origin-access`。检查要求与边界见[补充说明](../.agents/skills/cloudflare-cost-safety/references/delayed-and-origin-checks.md)；缺少实际应用证据时仍为 INCOMPLETE，本工具自己的回归测试不能代替应用验收。

| 退出码 | 含义 |
| --- | --- |
| 0 | PASS，或 REVIEW 已有有效的逐项签名审批 |
| 1 | 已知 BLOCK，优先于其他缺数据 |
| 2 | INCOMPLETE 或未批准 REVIEW |
| 3 | 工具调用／执行错误 |

## 官方依赖与规则

实际 vendored `cloudflare/skills` 的 `workers-best-practices`、`wrangler`、`durable-objects`，固定 commit `41e0d19858946d18af9ee2c2feebbe2e11d829ff`，保留 Apache-2.0 许可。每次读取入口和适用 references，按 [lock](../.agents/skills/cloudflare-cost-safety/official-skills.lock.json) 核对文件摘要；从不静默更新 main。报告分别记录 loaded/reviewed 以及官方／成本两层结论。

12 条 P0 的正式契约、案例映射与来源在 [规则表](../rules/catalog.json)。实现采用 TypeScript AST、本地调用闭包、真实 JSONC/TOML 与 SQL parser；支持范围及逐条测试证据见 [覆盖说明](coverage.md)。ORM、动态派发、外部 SDK、未知云端状态及 P1 产品有明确缺口，不能由没有静态候选推出安全。

## 独立门禁与受控入口

可信外部审查人用 `attest --review ... --private-key /EXTERNAL/key.pem --key-id ... --origin ... --run-id ...` 生成 Ed25519 envelope。`gate` 只接受外部信任文件允许的公钥／来源，重新核对当前源码、产物、配置、目标、锁、策略、规则、工具和必需测试。普通 PASS JSON 不够。REVIEW 需要逐项、有期限、有补偿措施的签名审批；BLOCK 和 INCOMPLETE 不可豁免。

[签名与信任示例](trust.md) 给出具体数据结构和本地流程。[本地受控入口](../scripts/release.mjs) 默认只做门禁与只读交接，只有显式传入外部发布器和 `--execute` 才调用发布器。分析阶段拒绝继承 Cloudflare 凭证；本次开发没有调用远程发布阶段。

[Wrangler 发布示例](../examples/publisher-wrangler.mjs) 只支持预构建 JavaScript deploy，拒绝 build.command，以密封 memfd 和只读 namespace 消费同一批核验字节；禁用 bundle／重建。本地已验证其断网 dry-run。管理员、受保护发布器及拥有同宿主调试权限的人属于信任边界，文件 chmod 本身不是不可变性保证。

[GitHub Actions 示例与设置说明](ci.md) 把门禁和凭证发布放在独立步骤，并从受保护工具安装运行。工程 CI 配置为在 push／pull request 时验证，线上结果以仓库 Actions 为准；真实 Cloudflare 发布流程尚未执行。直接 CLI、控制台、未接入的 Workers Builds 和其他 CI 仍为 **partial coverage**。

实际完成情况、测试数量、独立前向评估及未执行项见 [开发交付报告](development-report.zh-CN.md)。原始要求保存在 [requirements.zh-CN.md](requirements.zh-CN.md)。
