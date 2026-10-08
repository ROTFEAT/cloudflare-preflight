# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-08T10:28:26.216Z

Official best practices: **INCOMPLETE**. Cost safety: **BLOCK**.

Target: app-a / production / deploy. Input: `0f9c1a9c98e57ab75ee90e1b9e654e5729356a9561c48bf514d2882a6c790e7a`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | finding |  |
| CF-DO-002 | unknown | No verified cumulative logical-job or periodic-window budget; No durable pending-work, attempts, progress or window budget exists in the class. Potential repeated scheduled work has no logical-task termination boundary, but runtime activation, schema and getAlarm fault/lifecycle checks are unexecuted. |
| CF-DEP-001 | unknown | This is a production-only input with one declared DO class and no preview generator; no local path allocates an object. Existing callers, active-object count and alarm state were not accessed. Environment multiplication is not evidenced, and the live DO execution population is unknown. |
| CF-SQL-001 | finding |  |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | The fetch handler still incurs an invocation even though it returns a constant response and has no downstream operation. No server admission bound or exported WAF/workers.dev coverage exists. The static not_applicable result should not be read as elimination of Worker entry charges. |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-DO-001** (cost_safety, high, high_for_supported_pattern) main.js:4 — Object activation starts an alarm that performs storage work and schedules another alarm without a durable work boundary
  Path: alarm → setAlarm. Units: alarm invocations, SQL rows read/written, active duration.
  用官方Alarm行为核验；deleteAlarm是对象内操作，不是账户级停用；优先寻找实际可用平台控制，禁止捏造pause接口。
- **REVIEW CF-SQL-001** (cost_safety, medium, high for the inspected local code; live preconditions remain unverified) main.js:4 — Every successful alarm materializes the entire jobs table; per-event rows are unbounded by candidate code.
  Path: Task.alarm → storage.sql.exec(SELECT * FROM jobs) → cursor.toArray. Units: rowsRead per successful alarm, returned rows, alarm events.
  
- **ADVISORY official** (official_best_practices, low, high for the inspected local code; live preconditions remain unverified) main.js:3 — Constructor starts asynchronous setAlarm without attaching completion or rejection to an initialization lifetime.
  Path: Task.constructor → storage.setAlarm. Units: alarm scheduling operations.
  
- **REVIEW official** (official_best_practices, medium, high for the inspected local code; live preconditions remain unverified) main.js:4 — The DO queries jobs but its constructor has no schema initialization; the supplied SQL file is not called by the class.
  Path: Task.constructor → Task.alarm → SELECT * FROM jobs. Units: alarm events, successful SQL scans: unknown.
  

## Tests and unknowns

- bounded-local-probe: passed (48 ms); python3 trusted-skill/scripts/lib/probe.py
- sql-plan: passed (48 ms); python3 trusted-skill/scripts/lib/probe.py
- official_semantic_review_missing:wrangler
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
