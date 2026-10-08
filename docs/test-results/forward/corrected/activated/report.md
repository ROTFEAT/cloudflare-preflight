# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-08T11:14:02.344Z

Official best practices: **PASS**. Cost safety: **BLOCK**.

Target: fixture-cf-do-001 / production / deploy. Input: `f5f2a0b19c8965be0b3d33fb89b4dfe386889b99bc4a45b6b1b565f619e0ddac`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | finding |  |
| CF-DO-002 | unknown | No verified cumulative logical-job or periodic-window budget; The activated alarm has no persistent logical-job counter, finite completion condition or periodic-window allowance. A shared name controls object identity only. No legitimate recurring-work contract, termination/retry bound, eviction or crash test was supplied; cumulative budget cannot be verified. |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | unknown | SELECT * FROM jobs has neither predicate nor LIMIT and is fully consumed each alarm. The same DO constructor owns CREATE TABLE IF NOT EXISTS jobs. The bounded SQLite EXPLAIN probe compiled this schema/query and returned SCAN jobs, not an index-bound plan. This is structural evidence, not D1 meta or DO cursor billing. Table cardinality, rowsRead and workload bounds are missing; monetary or finite-row safety is unknown. |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | Public entry/WAF/cache/admission scope cannot be verified from this repository; Public-capable fetch activates the named DO on every request and has no admission/authentication/rate guard. No browser polling source exists. WAF/cache/routes/account state and upstream producers were not provided. Shared identity is not a request quota. Public cost amplification and native-control scope are unverified. |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-DO-001** (cost_safety, high, high_for_supported_pattern) main.js:5 — Object activation starts an alarm that performs storage work and schedules another alarm without a durable work boundary
  Path: alarm → setAlarm. Units: alarm invocations, SQL rows read/written, active duration.
  用官方Alarm行为核验；deleteAlarm是对象内操作，不是账户级停用；优先寻找实际可用平台控制，禁止捏造pause接口。

## Tests and unknowns

- bounded-local-probe: passed (46 ms); python3 trusted-skill/scripts/lib/probe.py
- sql-plan: passed (46 ms); python3 trusted-skill/scripts/lib/probe.py
- Required test not completed: do-lifecycle
- Required test not completed: do-getalarm
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
