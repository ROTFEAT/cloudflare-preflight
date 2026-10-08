# CI 与本地发布入口

## 已提供的路径

`.github/workflows/verify.yml` 是本项目工程验证流程：联网准备依赖时禁止 lifecycle，随后执行 `npm test`，保存真实日志。它没有签名或 Cloudflare secrets；工程测试通过不代表某个应用可以发布。

沙箱仅挂载受保护的系统路径，运行 Node 使用 `/usr/bin/node`。GitHub setup-node 默认的 `/opt` 缓存不会暴露给沙箱，因此准备阶段将其已安装的 Node 二进制复制到 `/usr/bin/node`，测试阶段保留该 npm 入口并优先使用系统 Node。这样无需把整个工具缓存挂入沙箱，也不改变断网、只读和凭证隔离约束。

`examples/github-release.yml` 是应用仓库可采用的生产发布流程，尚未在 GitHub 执行。它要求受保护、独立的 self-hosted runner，标签为 `cost-safety-publisher`，以及需要维护者批准的 `cloudflare-production` environment。候选仓库不得获得写入 `/opt/cloudflare-cost-safety` 的权限，不要在曾运行不可信 PR 代码的常驻 runner 上保留发布凭证。

步骤顺序为：下载签名证据 → 使用受保护公钥验签取得 commit → checkout 该 commit（不持久化 GitHub 凭证）→ 下载同一次审查的最终源码／产物 → 独立 gate → 核验全部文件并准备交接 → 仅在发布步骤注入 Cloudflare token → 只读密封快照发布。任何失败都会阻止发布步骤。使用 actions 固定 SHA，实际通过对应官方 Git 仓库 tag refs 核验过。

## 维护者需要配置

1. 将本仓库经过审阅的工具版本、固定依赖和 Wrangler 4.148.0 安装到 `/opt/cloudflare-cost-safety`，使用隔离的只读工具目录／镜像及同一 Node 精确版本。工具与 policy/official lock 变化后重建 trust pin、重审应用。
2. 在候选目录外创建受保护的 trust JSON、公钥和发布目标 JSON。签名私钥仅在独立审查／批准流程可用，不能进入候选 build 或发布进程。
3. 配置 environment reviewers、最小权限的 Cloudflare deploy token，保护工作流、工具、策略、规则、测试和信任配置。不要让写代码的 Agent 同时修改这些内容以降低门禁。
4. 在可信审查流程中先构建最终产物，再实际读官方文件、审查所有规则、完成必需本地测试，最后签名。上传两个不可覆盖的 artifact：`cost-safety-evidence` 包含 `attestation.json` 和可选 `approvals.json`；`cost-safety-candidate` 包含签名报告 `scope.files` 列出的全部文件（包括隐藏的必要文件、最终配置／产物／锁），不包含凭证和 node_modules。
5. 候选 artifact 与签名证据必须来自同一审查过程。例子选择已签名 commit 重新 checkout，并比较完整工作树文件摘要；不只比较 Git SHA。不要上传审查后再构建的产物，不要在 publish 前运行 npm install/build/postinstall。
6. 将示例复制到应用的 `.github/workflows/`，选择可信 review run ID 运行。工作流中只有最后的 publisher 步骤能读取部署 token。

受保护的 `/opt/cloudflare-cost-safety/trust/production-target.json` 形如：

```json
{
  "config": "dist/wrangler.jsonc",
  "environment": "production",
  "artifact": "dist",
  "builder": "维护者核验过的精确构建器身份",
  "account": "真实目标账户ID",
  "action": "deploy",
  "wranglerPackage": "/opt/cloudflare-cost-safety/node_modules/wrangler/package.json",
  "trust": "/opt/cloudflare-cost-safety/trust/review-trust.json"
}
```

这段是待管理员填写的示例，不是已核验的生产目标。若使用自定义 policy，在该对象加入外部 `policy` 路径，审查和门禁都使用同一内容。示例发布器只支持 JavaScript deploy；preview/promote/rollback 已有审查身份和意图支持，但实际发布适配需使用组织已有的受保护发布器。历史版本仍须核验产物、配置及数据兼容，不能只重用旧 PASS。

## 本地调用

外部 release request JSON 在目标设置基础上增加绝对 `root`、`attestation`，可选 `approvals`。运行受保护的 `scripts/release.mjs --request /EXTERNAL/release.json`，默认不会执行远程发布。需要单独授权发布时，使用 `--execute --publisher /TRUSTED/examples/publisher-wrangler.mjs`。

不要向分析进程注入 Cloudflare token。本地发布器可在门禁完成后从外部凭证管理器获取 token，示例支持 `COST_SAFETY_DEPLOY_TOKEN_FILE` 指向外部文件；该文件只由 publisher 读取。CI 使用独立发布步骤直接注入 token。

交接目录只有受保护流程可访问；chmod 用于减少误改。实际示例发布器重新核验后把文件写入禁止写入／增长／缩短的 Linux memfd，再交给 bubblewrap 的只读文件挂载，Wrangler 只看到密封文件，临时日志和 dry-run 产物写在独立 tmpfs。测试实际证明修改原目录不会替换消费字节，namespace 内写入失败。拥有宿主控制权的人仍可绕过整个发布流程；本项目不声称防御管理员或恶意受信发布器。

## 仍未受控的路径

直接 Wrangler/cf CLI、Cloudflare dashboard、Workers Builds 的独立 deploy/preview command、其他 CI、已有后台 Alarm/Queue 任务不会被本项目自动禁止或停止。PR required check 不能覆盖这些路径。管理员需要逐个接入真实命令或禁用旁路，再更新 `deployment_gate_coverage`；本实现始终保守报告 partial，尚未实现通过云端配置核验证明全覆盖的适配器。

本次未修改组织权限、branch protection、Workers Builds、账户设置或 secrets。真实目标、账户套餐、传播延迟、已有任务与原生控制执行状态均未在线核验。
