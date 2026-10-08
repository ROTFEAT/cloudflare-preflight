# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-08T10:20:38.070Z

Official best practices: **INCOMPLETE**. Cost safety: **BLOCK**.

Target: app-b / production / deploy. Input: `bac4cb0dc109bb6b8c069f5bed84fd70a7dc2376ccc572b9d8959672bedce59d`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | not_applicable | not_applicable | 0 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | not_applicable |  |
| CF-DO-002 | not_applicable |  |
| CF-DEP-001 | not_applicable |  |
| CF-SQL-001 | not_applicable |  |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | finding |  |
| CF-Q-002 | unknown | Write-before-ack, partial failure, default retry scope and DLQ replay require fault-injection evidence |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | not_applicable |  |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-Q-001** (cost_safety, high, high_for_supported_pattern) producer.js:1 — Queue consumption reaches a producer that sends a new message without a preserved, enforced logical-task hop bound
  Path: enqueue → send. Units: new messages, reads/retries, downstream writes.
  优先平台单消息重试/DLQ配置，但明确其作用域；暂停投递不能阻止生产者继续发送。

## Tests and unknowns

- bounded-local-probe: passed (52 ms); python3 trusted-skill/scripts/lib/probe.py
- Required test not completed: queue-feedback
- Required test not completed: queue-partial

## Native control coverage

- Workers/cpu_limit: CPU per invocation; not SQL, wait time, cross-event or monthly usage. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/workers/platform/limits/).
- Billing/budget_alert: Notification only; no pause or hard cap. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/billing/manage/budget-alerts/).
- Queues/pause_delivery: Stops consumer delivery; producers and retained messages remain. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/queues/configuration/pause-purge/).
- Queues/max_retries_and_DLQ: One message retry lifecycle, not newly sent logical-task messages. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/queues/configuration/batching-retries/).

## Remaining coverage

Unknown edges: 0. Excluded products: AI/external charges, Workflows, DO WebSocket/active duration, R2 object event loops, logs/traces. Dollar estimate: unknown.

- Unverified release path: Direct CLI
- Unverified release path: Cloudflare dashboard
- Unverified release path: Unverified Workers Builds deployment and preview commands
- Unverified release path: Independent CI
