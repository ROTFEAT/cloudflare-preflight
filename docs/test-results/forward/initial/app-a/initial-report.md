# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-08T10:20:35.895Z

Official best practices: **INCOMPLETE**. Cost safety: **BLOCK**.

Target: app-a / production / deploy. Input: `5b56de0eed6c9df4dd067ac302c48c9320a9ea7f5910574bd51a82ff55eecb40`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | finding |  |
| CF-DO-002 | unknown | No verified cumulative logical-job or periodic-window budget |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | pass |  |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | not_applicable |  |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-DO-001** (cost_safety, high, high_for_supported_pattern) main.js:4 — Object activation starts an alarm that performs storage work and schedules another alarm without a durable work boundary
  Path: alarm → setAlarm. Units: alarm invocations, SQL rows read/written, active duration.
  用官方Alarm行为核验；deleteAlarm是对象内操作，不是账户级停用；优先寻找实际可用平台控制，禁止捏造pause接口。

## Tests and unknowns

- bounded-local-probe: passed (49 ms); python3 trusted-skill/scripts/lib/probe.py
- Required test not completed: do-lifecycle
- Required test not completed: do-getalarm
- Required test not completed: sql-plan
- Required test not completed: sql-rows

## Native control coverage

- Workers/cpu_limit: CPU per invocation; not SQL, wait time, cross-event or monthly usage. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/workers/platform/limits/).
- Billing/budget_alert: Notification only; no pause or hard cap. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/billing/manage/budget-alerts/).
- Durable Objects/deleteAlarm: Scheduled alarm on one object; not account isolation or cancellation of running work. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/durable-objects/api/alarms/).

## Remaining coverage

Unknown edges: 0. Excluded products: AI/external charges, Workflows, DO WebSocket/active duration, R2 object event loops, logs/traces. Dollar estimate: unknown.

- Unverified release path: Direct CLI
- Unverified release path: Cloudflare dashboard
- Unverified release path: Unverified Workers Builds deployment and preview commands
- Unverified release path: Independent CI
