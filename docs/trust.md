# 审查签名、信任与审批

可信签名不是“Agent 自称 PASS”。审查人先核对实际源码、固定官方上下文、语义记录及真实测试证据，再从外部受保护过程签名。项目提供 `semantic-review.schema.json`、`report.schema.json`、`trust.schema.json`、`approval.schema.json`；它们是本工具协议，不是 Codex 原生 schema。

## 审查流程

1. 运行 `preflight --local-tests`，读取当前 `deployment_identity.digest` 和官方上下文。所有动态／未知路径必须明确处置，未完成的必需检查保留 unknown/not_run。
2. 实际审查全部 12 条规则和适用官方文件。每个官方 reviewed_files 记录应与工具实际读到的路径／SHA 完全相同，并给出候选代码证据。记录 reviewer、model、invocation、reviewed_at；模型精确 ID 无法取得时明确说明，不能猜测。
3. 填写真实测试的 input_digest、命令数组、runner_digest、耗时与指标；没有执行的命令／耗时／摘要允许 null，状态不能 passed。SQLite probe 只给计划，billing rows 为 null。DO SQL 指标取自已消费 cursor，D1 local meta 只标记为本地运行时指标。
4. 可选 usage_assessment 以事件、投递、新消息、SQL/KV/R2 操作、对象／环境为单位。`bounded_under_assumptions` 必须给所有维度的边界、每个非零维度的执行限制与代码位置、作用域及已执行测试；缺因素不接受“有界”标签。美元目前固定 null；没有实现价格计算器或月度硬预算。
5. 用 `preflight --review /EXTERNAL/review.json --local-tests` 重建报告。语义记录不能删除静态 BLOCK；修正代码或证明分析器误报后修复规则并重跑。签名步骤再次读取当前内容。

```sh
node /TRUSTED/skill/scripts/cli.mjs attest \
  --root /APPLICATION --artifact dist --config dist/wrangler.jsonc \
  --env production --builder ACTUAL_BUILDER_VERSION \
  --wrangler-package /TRUSTED/node_modules/wrangler/package.json \
  --review /EXTERNAL/review.json --private-key /EXTERNAL/reviewer.pem \
  --key-id maintainer-review --origin TRUSTED_REVIEW_ORIGIN --run-id ACTUAL_RUN_ID \
  --output /APPLICATION/.cost-safety
```

私钥、信任文件不能放在候选仓库。`attest` 拒绝 INCOMPLETE。BLOCK 可以作为否决证据签名，仍返回 1；它不能获得发布许可。

## 信任文件

管理员批准公钥和允许的来源，分别授予 review/approval 角色。信任文件同时 pin 已安装工具、policy 和官方 lock 的摘要，不能每次从候选报告自动接受新 pin。

```json
{
  "schema_version": "1.0",
  "keys": [{
    "id": "maintainer-review",
    "public_key": "真实 Ed25519 SPKI PEM 公钥",
    "roles": ["review", "approval"],
    "origins": ["受保护审查流程的实际来源"]
  }],
  "tool_digest": "由受保护已安装 CLI fingerprint 取得的64位摘要",
  "official_skills_lock_digest": "受保护 official-skills.lock.json 的 canonical JSON digest",
  "policy_digest": "受保护 policy 的 canonical JSON digest",
  "max_age_hours": 24
}
```

这是结构说明，示例字符串不能通过正式 schema。摘要算法为按键排序的 canonical JSON SHA-256；`tool_digest` 使用 CLI `fingerprint`，其余可从受保护安装导入 `core.mjs` 的 `digest`，对真实 JSON 数据计算。发布验证器自身必须受保护，否则候选可以替换校验代码。安装后生成的 runtime dependency inventory 也属于工具内容，须在安装完成后取 fingerprint。

```sh
node /TRUSTED/skill/scripts/cli.mjs gate \
  --root /APPLICATION --config dist/wrangler.jsonc --env production \
  --artifact dist --builder ACTUAL_BUILDER_VERSION \
  --wrangler-package /TRUSTED/node_modules/wrangler/package.json \
  --account ACTUAL_ACCOUNT_ID --action deploy \
  --trust /EXTERNAL/trust.json --attestation /EVIDENCE/attestation.json
```

当前 commit、完整文件摘要、产物、有效配置、目标／环境／版本、migrations、锁、构建器、CLI、策略、规则和官方内容都影响身份。修改后旧证据不能复用；未运行 Agent、漏规则、缺测试、错误来源、过期证据或伪造摘要均拒绝。证据有效期采用 trust.max_age_hours 与 policy.max_evidence_age_hours 的较短值。Ed25519 envelope 的 key_id/origin/run_id 和 payload 一起签名；序列化到 JSON 再读回也有实际门禁测试。

## REVIEW 审批

审批 payload 使用 `approval.schema.json`，必须包含当前 input_digest、明确的 REVIEW finding_ids、approver、reason、scope、expires_at、补偿控制和审批依据。用允许 approval 角色的私钥通过库 `signEnvelope` 签名，组成 envelope 数组，通过 `gate --approvals /EXTERNAL/approvals.json` 提供。

只允许审批真实 REVIEW finding，禁止永久全库通配、伪造 BLOCK 例外或对缺失检查给予普通批准。门禁通过时报告仍为 REVIEW，gate 为 ALLOW_WITH_APPROVAL；不会改写成无条件 PASS。协议将文件／资源作用域绑定在 finding 与整个输入摘要上；本版本不提供可覆盖任意未来源码的 rule-wide 豁免。

这里的测试使用临时 Ed25519 密钥和明确标注的语义替身，不能把它们当成生产审查签名。仓库没有生产私钥或部署凭证。
