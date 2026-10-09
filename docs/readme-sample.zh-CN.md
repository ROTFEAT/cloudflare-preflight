<!-- 中文 README 首页文案样本。报告部分是保留历史报告的中文摘要。 -->

# Cloudflare Cost Safety

**Cloudflare 部署前必须做的检查**

**1.0.2** · Codex Skill · [English](../README.en.md) · [MIT](../LICENSE)

`cloudflare-cost-safety` 是一个给 Codex 用的成本检查 Skill，帮你在上线前检查代码和配置，提前发现容易让 Cloudflare 费用超出预期的问题：

- **后台任务一直跑：** 没有新请求，Alarm 仍在反复触发，持续读写数据。
- **队列任务反复执行：** 一条消息处理完，又创建下一条消息，同一个任务一直重复。
- **数据库读写太多：** 查询只返回一行，却读取了很多行；本来只想改一条记录，却更新了整张表。
- **任务频率或环境数量太多：** 备份、同步、轮询过于频繁，或者多个预览环境都在运行同一套后台任务。

检查会告诉你：哪里有风险、为什么会产生额外用量、需要补什么限制，以及还有哪些测试没完成。

## 示例：Alarm 反复运行

在仓库的一个测试项目里，Alarm 每分钟读一次表，然后安排下一次执行。即使这一轮没有工作，也会继续调度。检查没有找到持久化的工作量限制或明确的停止条件。

`Alarm → 读表 → 安排下一次 Alarm → 读表 → ……`

## 如何检查

你可以在对话里这样说：

```text
$cloudflare-cost-safety 检查这个项目的 Cloudflare 成本风险，重点看看后台任务会不会一直运行。生成报告，先不要部署。
```

用中文摘要展示这份测试项目的真实历史报告：

> **BLOCK · main.js:5**
>
> 找到一条执行后会再次调度的 Alarm 路径。
>
> 对象激活会启动 Alarm；Alarm 执行存储操作后，再次调用 `setAlarm`。这条路径没有可核验的持久工作边界。
>
> 执行路径：`alarm → setAlarm`
>
> 必需测试仍有未完成项：对象生命周期、`getAlarm` 行为、SQL 行用量。

[查看被检查的代码](test-results/forward/corrected/activated/input/main.js) · [查看完整历史报告](test-results/forward/corrected/activated/report.md)

这份历史报告用于展示检查效果，不能批准当前应用发布。

修复时需要明确任务的执行范围和停止条件：

- **一次性任务：** 持久化剩余工作与进度，完成后不再安排下一次。
- **周期任务：** 明确最小间隔和每个窗口的工作额度，让额度跨对象重启保留。

修改之后，还要运行必需的本地测试，复查其他未知项，再根据完整证据给出结论。

当前规则与支持范围见 [12 条 P0 规则](../rules/catalog.json)和[覆盖说明](coverage.md)。

## 安装与触发方式

本地工具需要 Linux、Node ≥22、Python ≥3.10、bubblewrap 和 libseccomp2；沙箱使用 `/usr/bin/node`。环境准备细节见[使用指南](usage.zh-CN.md)。

```sh
git clone https://github.com/ROTFEAT/cloudflare-preflight.git
cd cloudflare-preflight
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run install-skill -- --project /ABSOLUTE/APPLICATION
```

把最后一行的路径替换为你的应用目录。安装器不覆盖已有安装；安装后确认 Codex 已发现 Skill。

**准备部署时：**

```text
把这个项目部署到 Cloudflare production，先完成成本安全检查。
```

部署、发布、preview、staging、版本晋升和 rollback 都属于检查范围。宿主的隐式选用依赖客户端版本，完整触发矩阵尚未验证；接入受控发布流程时，入口会显式执行独立门禁。

**想提前检查时：**

在支持的客户端输入 `/skills`，选择 **cloudflare-cost-safety**；也可以使用上面的 `$cloudflare-cost-safety` 对话指令。普通编辑与已确认的纯本地 build／test 不会默认触发检查。

## 为什么会有这个 Skill

开发者的公开账单经历和事故复盘里，反复出现同类问题：任务不断重新调度，成功处理的消息又创建下一条消息，一次小操作乘上频率、数据量和环境数量。

这个项目把其中的机制整理成部署前检查规则。公开资料包含作者自述、原帖片段和二手归档，账单与完整生产代码未由本项目独立审计。

[全部 9 个案例与 15 条消息／社区来源](../README.md#为什么会有这个-skill) · [全部 17 条官方参考资料](../README.md#官方资料与致谢)

## 使用边界

预检只读，不连接 Cloudflare 账户，不持有部署凭证，也不会停止正在运行的任务。

接入独立门禁的发布入口会拒绝 BLOCK、INCOMPLETE、工具错误和未批准的 REVIEW。直接 CLI、控制台与未接入的 Workers Builds 等路径仍属于部分覆盖。这个 Skill 不承诺月度金额硬上限。

[命令行与报告说明](usage.zh-CN.md) · [发布流程](ci.md) · [签名与信任](trust.md) · [实际验证记录](test-results/README.md)

当前版本为 **1.0.2**，README、Skill、软件包和报告统一使用三段式版本号，Git 标签为 `v1.0.2`。每次提交都递增版本号，包括文档与 CI 改动，具体流程见[版本管理](versioning.md)。

项目代码采用 [MIT](../LICENSE)。随包 Cloudflare 官方 Skill 的 [Apache-2.0 许可](../.agents/skills/cloudflare-cost-safety/vendor/CLOUDFLARE-LICENSE)与[出处说明](../.agents/skills/cloudflare-cost-safety/vendor/NOTICE)保持保留。
